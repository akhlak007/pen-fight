import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type { AccountSnapshot, LeaderboardEntry, LeaderboardPage } from '../src/account/account-types';
import type { ProfileSnapshot } from '../src/app/app-state';
import { levelForXp } from '../src/profile/progression';
import type { AccountRepository, SessionResult } from './account-repository';
import {
  AccountError,
  SESSION_MS,
  USERNAME,
  hashToken,
  mergeProfileUpdate,
  passwordHash,
  sanitizeProfile,
} from './account-store';

interface PostgresPlayerRow extends QueryResultRow {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  avatar_id: string;
  flag_code: string;
  selected_pen_id: string;
  selected_desk_id: string;
  xp: string | number;
  wins: string | number;
  matches: string | number;
  unlocked_json: unknown;
  awarded_json: unknown;
  created_at: string | number;
}

const requiredPlayerColumns = ['id', 'username', 'username_key', 'password_hash', 'password_salt', 'avatar_id', 'flag_code', 'selected_pen_id', 'selected_desk_id', 'xp', 'wins', 'matches', 'unlocked_json', 'awarded_json', 'created_at', 'last_active'];
const requiredSessionColumns = ['token_hash', 'player_id', 'created_at', 'last_used', 'expires_at'];

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') {
    try { return list(JSON.parse(value)); } catch { return []; }
  }
  return [];
}

function profileFromRow(row: PostgresPlayerRow): ProfileSnapshot {
  return {
    avatarId: row.avatar_id,
    flagCode: row.flag_code,
    selectedPenId: row.selected_pen_id,
    selectedDeskId: row.selected_desk_id,
    xp: Number(row.xp),
    wins: Number(row.wins),
    matches: Number(row.matches),
    unlockedCosmeticIds: list(row.unlocked_json),
    awardedMatchIds: list(row.awarded_json),
  };
}

function accountFromRow(row: PostgresPlayerRow): AccountSnapshot {
  return { id: row.id, username: row.username, profile: profileFromRow(row) };
}

export interface PostgresAccountStoreOptions {
  readonly pool?: Pool;
  readonly advisoryLock?: boolean;
  readonly validateCatalog?: boolean;
}

export class PostgresAccountStore implements AccountRepository {
  readonly #pool: Pool;
  readonly #advisoryLock: boolean;
  readonly #validateCatalog: boolean;
  #ready?: Promise<void>;

  constructor(connectionString: string, options: PostgresAccountStoreOptions = {}) {
    this.#pool = options.pool ?? new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 });
    this.#advisoryLock = options.advisoryLock ?? true;
    this.#validateCatalog = options.validateCatalog ?? true;
  }

  initialize(): Promise<void> {
    this.#ready ??= this.#migrate();
    return this.#ready;
  }

  async close(): Promise<void> {
    try { await this.#ready; } finally { await this.#pool.end(); }
  }

  async healthy(): Promise<boolean> {
    try {
      await this.initialize();
      const result = await this.#pool.query<{ version: number }>('SELECT version FROM schema_meta LIMIT 1');
      return Number(result.rows[0]?.version) === 1;
    } catch {
      return false;
    }
  }

  async signup(usernameInput: string, password: string, importedProfile: ProfileSnapshot, now = Date.now()): Promise<SessionResult> {
    await this.initialize();
    const username = usernameInput.trim();
    if (!USERNAME.test(username)) throw new AccountError('invalid_username', 'Use 3–18 letters, numbers, or underscores.');
    if (password.length < 8 || password.length > 128) throw new AccountError('invalid_password', 'Password must be 8–128 characters.');
    const profile = sanitizeProfile(importedProfile);
    const id = randomUUID();
    const salt = randomBytes(16).toString('hex');
    const hash = passwordHash(password, salt);
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO players (
        id, username, username_key, password_hash, password_salt, avatar_id, flag_code,
        selected_pen_id, selected_desk_id, xp, wins, matches, unlocked_json, awarded_json, created_at, last_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15, $15)`, [
        id, username, username.toLocaleLowerCase('en-US'), hash, salt, profile.avatarId, profile.flagCode,
        profile.selectedPenId, profile.selectedDeskId, profile.xp, profile.wins, profile.matches,
        JSON.stringify(profile.unlockedCosmeticIds), JSON.stringify(profile.awardedMatchIds), now,
      ]);
      const result = await this.#newSession(client, id, now);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string }).code === '23505') throw new AccountError('username_taken', 'That username is already taken.', 409);
      throw error;
    } finally {
      client.release();
    }
  }

  async login(usernameInput: string, password: string, now = Date.now()): Promise<SessionResult> {
    await this.initialize();
    const result = await this.#pool.query<PostgresPlayerRow>('SELECT * FROM players WHERE username_key = $1', [usernameInput.trim().toLocaleLowerCase('en-US')]);
    const row = result.rows[0];
    if (!row || password.length > 128) throw new AccountError('invalid_credentials', 'Username or password is incorrect.', 401);
    const actual = Buffer.from(passwordHash(password, row.password_salt), 'hex');
    const expected = Buffer.from(row.password_hash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AccountError('invalid_credentials', 'Username or password is incorrect.', 401);
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      const session = await this.#newSession(client, row.id, now);
      await client.query('COMMIT');
      return session;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async accountForSession(token: string | undefined, now = Date.now()): Promise<AccountSnapshot | null> {
    await this.initialize();
    if (!token) return null;
    const tokenDigest = hashToken(token);
    const result = await this.#pool.query<PostgresPlayerRow>(`SELECT players.* FROM sessions
      JOIN players ON players.id = sessions.player_id
      WHERE sessions.token_hash = $1 AND sessions.expires_at > $2`, [tokenDigest, now]);
    const row = result.rows[0];
    if (!row) return null;
    await this.#pool.query('UPDATE sessions SET last_used = $1 WHERE token_hash = $2', [now, tokenDigest]);
    await this.#pool.query('UPDATE players SET last_active = $1 WHERE id = $2', [now, row.id]);
    return accountFromRow(row);
  }

  async logout(token: string | undefined): Promise<void> {
    await this.initialize();
    if (token) await this.#pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  }

  async updateProfile(playerId: string, requested: ProfileSnapshot, now = Date.now()): Promise<AccountSnapshot> {
    await this.initialize();
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      const locked = await client.query<PostgresPlayerRow>('SELECT * FROM players WHERE id = $1 FOR UPDATE', [playerId]);
      const previousRow = locked.rows[0];
      if (!previousRow) throw new AccountError('account_missing', 'Account no longer exists.', 404);
      const profile = mergeProfileUpdate(profileFromRow(previousRow), requested);
      await client.query(`UPDATE players SET avatar_id = $1, flag_code = $2, selected_pen_id = $3, selected_desk_id = $4,
        xp = $5, wins = $6, matches = $7, unlocked_json = $8::jsonb, awarded_json = $9::jsonb, last_active = $10 WHERE id = $11`, [
        profile.avatarId, profile.flagCode, profile.selectedPenId, profile.selectedDeskId,
        profile.xp, profile.wins, profile.matches, JSON.stringify(profile.unlockedCosmeticIds),
        JSON.stringify(profile.awardedMatchIds), now, playerId,
      ]);
      const account = accountFromRow(await this.#player(playerId, client));
      await client.query('COMMIT');
      return account;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async leaderboard(offsetInput = 0, limitInput = 50, currentPlayerId?: string): Promise<LeaderboardPage> {
    await this.initialize();
    const offset = Math.max(0, Math.floor(offsetInput));
    const limit = Math.max(1, Math.min(50, Math.floor(limitInput)));
    const rows = await this.#pool.query<PostgresPlayerRow>(`SELECT * FROM players
      ORDER BY xp DESC, wins DESC, created_at ASC, id ASC LIMIT $1 OFFSET $2`, [limit, offset]);
    const totalResult = await this.#pool.query<{ count: string | number }>('SELECT COUNT(*) AS count FROM players');
    let currentRank: number | undefined;
    if (currentPlayerId) {
      const rankResult = await this.#pool.query<{ rank: string | number }>(`SELECT 1 + COUNT(*) AS rank FROM players contender
        JOIN players target ON target.id = $1
        WHERE contender.xp > target.xp
          OR (contender.xp = target.xp AND contender.wins > target.wins)
          OR (contender.xp = target.xp AND contender.wins = target.wins AND contender.created_at < target.created_at)
          OR (contender.xp = target.xp AND contender.wins = target.wins AND contender.created_at = target.created_at AND contender.id < target.id)`, [currentPlayerId]);
      if (rankResult.rows[0]) currentRank = Number(rankResult.rows[0].rank);
    }
    const entries: LeaderboardEntry[] = rows.rows.map((row, index) => {
      const profile = profileFromRow(row);
      return {
        rank: offset + index + 1,
        playerId: row.id,
        username: row.username,
        avatarId: profile.avatarId,
        flagCode: profile.flagCode,
        xp: profile.xp,
        level: levelForXp(profile.xp),
        wins: profile.wins,
        matches: profile.matches,
        winRate: profile.matches > 0 ? Math.round((profile.wins / profile.matches) * 100) : 0,
      };
    });
    return { entries, total: Number(totalResult.rows[0]?.count ?? 0), offset, limit, ...(currentRank ? { currentRank } : {}) };
  }

  async #newSession(client: PoolClient, playerId: string, now: number): Promise<SessionResult> {
    const token = randomBytes(32).toString('hex');
    await client.query('INSERT INTO sessions(token_hash, player_id, created_at, last_used, expires_at) VALUES ($1, $2, $3, $3, $4)', [hashToken(token), playerId, now, now + SESSION_MS]);
    return { account: accountFromRow(await this.#player(playerId, client)), token };
  }

  async #player(id: string, client: Pick<PoolClient, 'query'> = this.#pool): Promise<PostgresPlayerRow> {
    const result = await client.query<PostgresPlayerRow>('SELECT * FROM players WHERE id = $1', [id]);
    const row = result.rows[0];
    if (!row) throw new AccountError('account_missing', 'Account no longer exists.', 404);
    return row;
  }

  async #migrate(): Promise<void> {
    const client = await this.#pool.connect();
    try {
      await client.query('BEGIN');
      if (this.#advisoryLock) await client.query('SELECT pg_advisory_xact_lock($1)', [1_347_636_849]);
      await client.query('CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER)');
      const metadata = await client.query<{ version: number }>('SELECT version FROM schema_meta');
      if (metadata.rows.length > 1 || (metadata.rows[0] && Number(metadata.rows[0].version) !== 1)) throw new Error('Unsupported account database schema version.');
      if (!metadata.rows[0]) {
        await client.query(`CREATE TABLE players (
          id UUID CONSTRAINT players_pkey PRIMARY KEY,
          username TEXT NOT NULL,
          username_key TEXT NOT NULL CONSTRAINT players_username_key_unique UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          avatar_id TEXT NOT NULL,
          flag_code TEXT NOT NULL,
          selected_pen_id TEXT NOT NULL,
          selected_desk_id TEXT NOT NULL,
          xp BIGINT NOT NULL DEFAULT 0,
          wins BIGINT NOT NULL DEFAULT 0,
          matches BIGINT NOT NULL DEFAULT 0,
          unlocked_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          awarded_json JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at BIGINT NOT NULL,
          last_active BIGINT NOT NULL,
          CONSTRAINT players_record_valid CHECK (wins <= matches)
        )`);
        await client.query(`CREATE TABLE sessions (
          token_hash TEXT CONSTRAINT sessions_pkey PRIMARY KEY,
          player_id UUID NOT NULL CONSTRAINT sessions_player_fk REFERENCES players(id) ON DELETE CASCADE,
          created_at BIGINT NOT NULL,
          last_used BIGINT NOT NULL,
          expires_at BIGINT NOT NULL
        )`);
        await client.query('INSERT INTO schema_meta(version) VALUES (1)');
      } else {
        await this.#validateSchema(client);
      }
      await client.query('CREATE INDEX IF NOT EXISTS leaderboard_order ON players(xp DESC, wins DESC, created_at ASC, id ASC)');
      await client.query('CREATE INDEX IF NOT EXISTS sessions_player ON sessions(player_id)');
      if (this.#validateCatalog) await this.#validateIndexes(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async #validateSchema(client: PoolClient): Promise<void> {
    const columns = await client.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(`SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('players', 'sessions')`);
    const available = new Map<string, Map<string, { type: string; nullable: string }>>();
    for (const row of columns.rows) {
      const definitions = available.get(row.table_name) ?? new Map<string, { type: string; nullable: string }>();
      definitions.set(row.column_name, { type: row.data_type, nullable: row.is_nullable });
      available.set(row.table_name, definitions);
    }
    if (requiredPlayerColumns.some((name) => !available.get('players')?.has(name)) || requiredSessionColumns.some((name) => !available.get('sessions')?.has(name))) {
      throw new Error('Account database schema is incomplete.');
    }
    if (!this.#validateCatalog) return;
    const expectedTypes: Record<string, string> = {
      id: 'uuid', username: 'text', username_key: 'text', password_hash: 'text', password_salt: 'text',
      avatar_id: 'text', flag_code: 'text', selected_pen_id: 'text', selected_desk_id: 'text',
      xp: 'bigint', wins: 'bigint', matches: 'bigint', unlocked_json: 'jsonb', awarded_json: 'jsonb',
      created_at: 'bigint', last_active: 'bigint', token_hash: 'text', player_id: 'uuid', last_used: 'bigint', expires_at: 'bigint',
    };
    for (const table of available.values()) {
      for (const [name, definition] of table) {
        if (expectedTypes[name] && (definition.type !== expectedTypes[name] || definition.nullable !== 'NO')) {
          throw new Error(`Account database column ${name} has an incompatible definition.`);
        }
      }
    }
    const constraints = await client.query<{ conname: string; definition: string }>(`SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid IN ('players'::regclass, 'sessions'::regclass)
        AND conname IN ('players_pkey', 'players_username_key_unique', 'players_record_valid', 'sessions_pkey', 'sessions_player_fk')`);
    const definitions = new Map(constraints.rows.map((row) => [row.conname, row.definition.toLocaleLowerCase('en-US').replace(/\s+/g, ' ')]));
    if (!definitions.get('players_pkey')?.includes('primary key (id)')
      || !definitions.get('players_username_key_unique')?.includes('unique (username_key)')
      || !definitions.get('players_record_valid')?.includes('wins <= matches')
      || !definitions.get('sessions_pkey')?.includes('primary key (token_hash)')
      || !definitions.get('sessions_player_fk')?.includes('foreign key (player_id) references players(id) on delete cascade')) {
      throw new Error('Account database constraints are incomplete.');
    }
  }

  async #validateIndexes(client: PoolClient): Promise<void> {
    const indexes = await client.query<{ indexname: string; indexdef: string }>(`SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname IN ('leaderboard_order', 'sessions_player')`);
    const definitions = new Map(indexes.rows.map((row) => [row.indexname, row.indexdef.toLocaleLowerCase('en-US').replace(/\s+/g, ' ')]));
    if (!definitions.get('leaderboard_order')?.includes('(xp desc, wins desc, created_at, id)')
      || !definitions.get('sessions_player')?.includes('(player_id)')) {
      throw new Error('Account database indexes are incomplete.');
    }
  }
}
