import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { AccountSnapshot, LeaderboardEntry, LeaderboardPage } from '../src/account/account-types';
import type { ProfileSnapshot } from '../src/app/app-state';
import { AVATARS, DEFAULT_AVATAR_ID, DEFAULT_DESK_ID, DEFAULT_FLAG_CODE, DEFAULT_PEN_ID, DESKS, PENS, validFlagCode } from '../src/profile/profile-catalog';
import { levelForXp } from '../src/profile/progression';

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME = /^[A-Za-z0-9_]{3,18}$/;
const SAFE_ID = /^[a-z0-9-]{1,40}$/;
const MAX_PROFILE_DELTA = Object.freeze({ xp: 1000, wins: 10, matches: 10 });
const avatarIds = new Set(AVATARS.map((item) => item.id));
const penIds = new Set(PENS.map((item) => item.id));
const deskIds = new Set(DESKS.map((item) => item.id));
const cosmeticIds = new Set([...penIds, ...deskIds]);

interface PlayerRow {
  id: string;
  username: string;
  password_hash: string;
  password_salt: string;
  avatar_id: string;
  flag_code: string;
  selected_pen_id: string;
  selected_desk_id: string;
  xp: number;
  wins: number;
  matches: number;
  unlocked_json: string;
  awarded_json: string;
  created_at: number;
}

interface RankedRow extends PlayerRow { rank: number }

export class AccountError extends Error {
  constructor(readonly code: string, message: string, readonly status = 400) {
    super(message);
    this.name = 'AccountError';
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function passwordHash(password: string, salt: string): string {
  return scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
}

function safeNatural(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new AccountError('invalid_profile', 'Profile progress is invalid.');
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value));
}

function safeIds(value: unknown, allowed: ReadonlySet<string>, max: number): string[] {
  if (!Array.isArray(value)) throw new AccountError('invalid_profile', 'Profile items are invalid.');
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && SAFE_ID.test(item) && allowed.has(item)))].slice(-max);
}

function safeAwardedIds(value: unknown): string[] {
  if (!Array.isArray(value)) throw new AccountError('invalid_profile', 'Match history is invalid.');
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && SAFE_ID.test(item)))].slice(-100);
}

function sanitizeProfile(value: ProfileSnapshot): ProfileSnapshot {
  const xp = safeNatural(value.xp);
  const wins = safeNatural(value.wins);
  const matches = safeNatural(value.matches);
  if (wins > matches) throw new AccountError('invalid_profile', 'Wins cannot exceed matches.');
  const level = levelForXp(xp);
  const unlockedCosmeticIds = safeIds(value.unlockedCosmeticIds, cosmeticIds, cosmeticIds.size);
  if (!unlockedCosmeticIds.includes(DEFAULT_PEN_ID)) unlockedCosmeticIds.unshift(DEFAULT_PEN_ID);
  const selectedPen = PENS.find((item) => item.id === value.selectedPenId && (item.unlockLevel <= level || unlockedCosmeticIds.includes(item.id)));
  const selectedDesk = DESKS.find((item) => item.id === value.selectedDeskId && (item.unlockLevel <= level || unlockedCosmeticIds.includes(item.id)));
  return {
    avatarId: avatarIds.has(value.avatarId) ? value.avatarId : DEFAULT_AVATAR_ID,
    flagCode: typeof value.flagCode === 'string' && validFlagCode(value.flagCode) ? value.flagCode.toUpperCase() : DEFAULT_FLAG_CODE,
    selectedPenId: selectedPen?.id ?? DEFAULT_PEN_ID,
    selectedDeskId: selectedDesk?.id ?? DEFAULT_DESK_ID,
    xp,
    wins,
    matches,
    unlockedCosmeticIds,
    awardedMatchIds: safeAwardedIds(value.awardedMatchIds),
  };
}

function parseStringList(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function profileFromRow(row: PlayerRow): ProfileSnapshot {
  return {
    avatarId: row.avatar_id,
    flagCode: row.flag_code,
    selectedPenId: row.selected_pen_id,
    selectedDeskId: row.selected_desk_id,
    xp: row.xp,
    wins: row.wins,
    matches: row.matches,
    unlockedCosmeticIds: parseStringList(row.unlocked_json),
    awardedMatchIds: parseStringList(row.awarded_json),
  };
}

function accountFromRow(row: PlayerRow): AccountSnapshot {
  return { id: row.id, username: row.username, profile: profileFromRow(row) };
}

export class AccountStore {
  readonly #db: DatabaseSync;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    try {
      this.#db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
      this.#migrate();
    } catch (error) {
      this.#db.close();
      throw error;
    }
  }

  #migrate(): void {
    try {
      this.#db.exec('BEGIN IMMEDIATE; CREATE TABLE IF NOT EXISTS schema_meta (version INTEGER NOT NULL);');
      const metadata = this.#db.prepare('SELECT version FROM schema_meta').all() as { version: number }[];
      if (metadata.length > 1 || (metadata[0] && metadata[0].version !== 1)) throw new Error('Unsupported account database schema version.');
      if (!metadata[0]) {
        this.#db.exec(`CREATE TABLE players (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        username_key TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        avatar_id TEXT NOT NULL,
        flag_code TEXT NOT NULL,
        selected_pen_id TEXT NOT NULL,
        selected_desk_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        matches INTEGER NOT NULL DEFAULT 0,
        unlocked_json TEXT NOT NULL DEFAULT '[]',
        awarded_json TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL,
        last_active INTEGER NOT NULL
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        last_used INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS leaderboard_order ON players(xp DESC, wins DESC, created_at ASC, id ASC);
      CREATE INDEX IF NOT EXISTS sessions_player ON sessions(player_id);
      INSERT INTO schema_meta(version) VALUES (1);`);
      } else {
        this.#validateV1Schema();
      }
      this.#db.exec('COMMIT');
    } catch (error) {
      if (this.#db.isTransaction) this.#db.exec('ROLLBACK');
      throw error;
    }
  }

  #validateV1Schema(): void {
    const requiredColumns: Record<string, readonly string[]> = {
      schema_meta: ['version'],
      players: ['id', 'username', 'username_key', 'password_hash', 'password_salt', 'avatar_id', 'flag_code', 'selected_pen_id', 'selected_desk_id', 'xp', 'wins', 'matches', 'unlocked_json', 'awarded_json', 'created_at', 'last_active'],
      sessions: ['token_hash', 'player_id', 'created_at', 'last_used', 'expires_at'],
    };
    for (const [table, required] of Object.entries(requiredColumns)) {
      const columns = this.#db.prepare(`PRAGMA table_info('${table}')`).all() as { name: string }[];
      const names = new Set(columns.map((column) => column.name));
      if (required.some((column) => !names.has(column))) throw new Error(`Account database schema is incomplete (${table}).`);
    }

    const indexes = this.#db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('leaderboard_order', 'sessions_player')").all() as { name: string }[];
    if (indexes.length !== 2) throw new Error('Account database indexes are incomplete.');
    const playerIndexes = this.#db.prepare("PRAGMA index_list('players')").all() as { name: string; unique: number }[];
    const usernameUnique = playerIndexes.some((index) => {
      if (!index.unique) return false;
      const escaped = index.name.replaceAll("'", "''");
      const columns = this.#db.prepare(`PRAGMA index_info('${escaped}')`).all() as { name: string }[];
      return columns.length === 1 && columns[0]?.name === 'username_key';
    });
    if (!usernameUnique) throw new Error('Account username uniqueness constraint is missing.');
    const foreignKeys = this.#db.prepare("PRAGMA foreign_key_list('sessions')").all() as { table: string; from: string; to: string; on_delete: string }[];
    if (!foreignKeys.some((key) => key.table === 'players' && key.from === 'player_id' && key.to === 'id' && key.on_delete.toUpperCase() === 'CASCADE')) {
      throw new Error('Account session foreign key is missing.');
    }
  }

  close(): void { this.#db.close(); }

  healthy(): boolean {
    try {
      const integrity = this.#db.prepare('PRAGMA quick_check(1)').get() as { quick_check?: string } | undefined;
      const schema = this.#db.prepare('SELECT version FROM schema_meta LIMIT 1').get() as { version?: number } | undefined;
      return integrity?.quick_check === 'ok' && schema?.version === 1;
    } catch {
      return false;
    }
  }

  signup(usernameInput: string, password: string, importedProfile: ProfileSnapshot, now = Date.now()): { account: AccountSnapshot; token: string } {
    const username = usernameInput.trim();
    if (!USERNAME.test(username)) throw new AccountError('invalid_username', 'Use 3–18 letters, numbers, or underscores.');
    if (password.length < 8 || password.length > 128) throw new AccountError('invalid_password', 'Password must be 8–128 characters.');
    const profile = sanitizeProfile(importedProfile);
    const id = randomUUID();
    const salt = randomBytes(16).toString('hex');
    const hash = passwordHash(password, salt);
    try {
      this.#db.exec('BEGIN IMMEDIATE');
      this.#db.prepare(`INSERT INTO players (
        id, username, username_key, password_hash, password_salt, avatar_id, flag_code,
        selected_pen_id, selected_desk_id, xp, wins, matches, unlocked_json, awarded_json, created_at, last_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, username, username.toLocaleLowerCase('en-US'), hash, salt, profile.avatarId, profile.flagCode,
        profile.selectedPenId, profile.selectedDeskId, profile.xp, profile.wins, profile.matches,
        JSON.stringify(profile.unlockedCosmeticIds), JSON.stringify(profile.awardedMatchIds), now, now,
      );
      const result = this.#newSession(id, now);
      this.#db.exec('COMMIT');
      return result;
    } catch (error) {
      if (this.#db.isTransaction) this.#db.exec('ROLLBACK');
      if (String(error).includes('UNIQUE')) throw new AccountError('username_taken', 'That username is already taken.', 409);
      throw error;
    }
  }

  login(usernameInput: string, password: string, now = Date.now()): { account: AccountSnapshot; token: string } {
    const key = usernameInput.trim().toLocaleLowerCase('en-US');
    const row = this.#db.prepare('SELECT * FROM players WHERE username_key = ?').get(key) as PlayerRow | undefined;
    if (!row || password.length > 128) throw new AccountError('invalid_credentials', 'Username or password is incorrect.', 401);
    const actual = Buffer.from(passwordHash(password, row.password_salt), 'hex');
    const expected = Buffer.from(row.password_hash, 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new AccountError('invalid_credentials', 'Username or password is incorrect.', 401);
    return this.#newSession(row.id, now);
  }

  #newSession(playerId: string, now: number): { account: AccountSnapshot; token: string } {
    const token = randomBytes(32).toString('hex');
    this.#db.prepare('INSERT INTO sessions(token_hash, player_id, created_at, last_used, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(hashToken(token), playerId, now, now, now + SESSION_MS);
    const row = this.#player(playerId);
    return { account: accountFromRow(row), token };
  }

  accountForSession(token: string | undefined, now = Date.now()): AccountSnapshot | null {
    if (!token) return null;
    const row = this.#db.prepare(`SELECT players.* FROM sessions
      JOIN players ON players.id = sessions.player_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(hashToken(token), now) as PlayerRow | undefined;
    if (!row) return null;
    this.#db.prepare('UPDATE sessions SET last_used = ? WHERE token_hash = ?').run(now, hashToken(token));
    this.#db.prepare('UPDATE players SET last_active = ? WHERE id = ?').run(now, row.id);
    return accountFromRow(row);
  }

  logout(token: string | undefined): void {
    if (token) this.#db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }

  updateProfile(playerId: string, requested: ProfileSnapshot, now = Date.now()): AccountSnapshot {
    const row = this.#player(playerId);
    const previous = profileFromRow(row);
    const profile = sanitizeProfile(requested);
    if (profile.xp < previous.xp || profile.wins < previous.wins || profile.matches < previous.matches) {
      throw new AccountError('progress_conflict', 'Saved progress cannot move backwards.', 409);
    }
    if (profile.xp - previous.xp > MAX_PROFILE_DELTA.xp || profile.wins - previous.wins > MAX_PROFILE_DELTA.wins || profile.matches - previous.matches > MAX_PROFILE_DELTA.matches) {
      throw new AccountError('progress_too_large', 'That progress update is too large.', 422);
    }
    if (profile.wins - previous.wins > profile.matches - previous.matches) {
      throw new AccountError('invalid_profile', 'New wins must belong to new matches.');
    }
    const unlockedCosmeticIds = safeIds([...previous.unlockedCosmeticIds, ...profile.unlockedCosmeticIds], cosmeticIds, cosmeticIds.size);
    const awardedMatchIds = safeAwardedIds([...previous.awardedMatchIds, ...profile.awardedMatchIds]);
    this.#db.prepare(`UPDATE players SET avatar_id = ?, flag_code = ?, selected_pen_id = ?, selected_desk_id = ?,
      xp = ?, wins = ?, matches = ?, unlocked_json = ?, awarded_json = ?, last_active = ? WHERE id = ?`).run(
      profile.avatarId, profile.flagCode, profile.selectedPenId, profile.selectedDeskId,
      profile.xp, profile.wins, profile.matches, JSON.stringify(unlockedCosmeticIds),
      JSON.stringify(awardedMatchIds), now, playerId,
    );
    return accountFromRow(this.#player(playerId));
  }

  leaderboard(offsetInput = 0, limitInput = 50, currentPlayerId?: string): LeaderboardPage {
    const offset = Math.max(0, Math.floor(offsetInput));
    const limit = Math.max(1, Math.min(50, Math.floor(limitInput)));
    const rows = this.#db.prepare(`SELECT *, ROW_NUMBER() OVER (ORDER BY xp DESC, wins DESC, created_at ASC, id ASC) AS rank
      FROM players ORDER BY xp DESC, wins DESC, created_at ASC, id ASC LIMIT ? OFFSET ?`).all(limit, offset) as unknown as RankedRow[];
    const total = Number((this.#db.prepare('SELECT COUNT(*) AS count FROM players').get() as { count: number }).count);
    const current = currentPlayerId
      ? this.#db.prepare(`SELECT rank FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY xp DESC, wins DESC, created_at ASC, id ASC) AS rank FROM players) WHERE id = ?`).get(currentPlayerId) as { rank: number } | undefined
      : undefined;
    const entries: LeaderboardEntry[] = rows.map((row) => ({
      rank: Number(row.rank),
      playerId: row.id,
      username: row.username,
      avatarId: row.avatar_id,
      flagCode: row.flag_code,
      xp: row.xp,
      level: levelForXp(row.xp),
      wins: row.wins,
      matches: row.matches,
      winRate: row.matches > 0 ? Math.round((row.wins / row.matches) * 100) : 0,
    }));
    return { entries, total, offset, limit, ...(current ? { currentRank: Number(current.rank) } : {}) };
  }

  #player(id: string): PlayerRow {
    const row = this.#db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow | undefined;
    if (!row) throw new AccountError('account_missing', 'Account no longer exists.', 404);
    return row;
  }
}
