# Local Profile and Progression Implementation Plan

## Objective

Implement the approved local-first Player Passport without replacing the current store, storage, UI, renderer, physics, or networking architecture. Work test-first, preserve all unrelated working-tree changes, and keep every cosmetic physically identical.

Design reference: `docs/superpowers/specs/2026-10-21-local-profile-progression-design.md`

## Task 1: Define progression and cosmetic catalogs

Files:

- `game-web/src/profile/progression.ts`
- `game-web/src/profile/progression.test.ts`
- `game-web/src/profile/profile-catalog.ts`
- `game-web/src/profile/profile-catalog.test.ts`

Steps:

1. Add failing tests for the approved XP rewards, level thresholds, level-99 cap, progress-to-next-level values, level titles, and unlock differences.
2. Implement pure XP threshold, level, reward, progress, and unlock helpers without DOM or storage dependencies.
3. Define immutable catalogs for twelve avatars, country flags, nine cosmetic pens, three cosmetic desks, and level titles.
4. Add catalog validation and safe-fallback helpers for unknown or locked identifiers.
5. Prove that all pen entries expose visual tokens only and contain no physics values.

## Task 2: Migrate and sanitize profile storage

Files:

- `game-web/src/storage/schema.ts`
- `game-web/src/storage/migrations.ts`
- `game-web/src/storage/storage-service.ts`
- `game-web/src/storage/storage-service.test.ts`

Steps:

1. Add failing tests for version-1 migration, version-2 round trips, independent field sanitation, preserved legacy unlocks, and locked/unknown equipped fallbacks.
2. Advance the schema to version 2 and add avatar, flag, selected pen, selected desk, and explicit cosmetic reward fields.
3. Preserve valid name, settings, progression, legacy unlocked pens, and last mode during migration.
4. Derive level-based availability instead of duplicating it in mutable save state.
5. Retain the existing in-memory persistence fallback and newer-version rejection behavior.

## Task 3: Integrate profile state and idempotent rewards

Files:

- `game-web/src/app/app-state.ts`
- `game-web/src/app/app-store.ts`
- `game-web/src/app/app-store.test.ts`
- `game-web/src/main.ts`

Steps:

1. Add failing store tests for loading a profile, editing public identity, equipping unlocked cosmetics, rejecting locked cosmetics, and recording a result once.
2. Extend application state with an immutable profile snapshot and current match reward identifier/status.
3. Add store operations for profile edits, equipped selections, match identifiers, and one-time progression awards.
4. Persist successful profile changes through the existing `StorageService` boundary.
5. Award Quick and Online XP only on completed results; show explicit zero-reward records for Practice and Local.
6. Create a fresh reward identifier for every rematch and prevent reconnect/result replay duplication.

## Task 4: Apply cosmetic pens and desks without changing physics

Files:

- `game-web/src/rendering/game-renderer.ts`
- `game-web/src/scene/classroom.ts`
- `game-web/src/scene/classroom.test.ts`
- `game-web/src/scene/textures.ts`

Steps:

1. Add failing tests proving cosmetic changes update materials while collider dimensions and shot results remain unchanged.
2. Add validated renderer loadout setters that apply only before a match or while in the home classroom.
3. Map pen catalog tokens to existing mesh materials without replacing pen geometry.
4. Map the three desk catalog entries to visual tabletop/classroom treatments without changing bounds, camera targets, or rigid bodies.
5. Keep same-device Local pens player-color coded for readability.

## Task 5: Build the responsive Player Passport

Files:

- `game-web/src/ui/ui-root.ts`
- `game-web/src/styles/global.css`
- `game-web/src/styles/paper.css`
- `game-web/src/main.ts`
- `game-web/tests/profile.spec.ts`

Steps:

1. Add browser tests for opening/closing the passport, identity edits, flag search, unlocked selection, locked selection, reload persistence, and accessible selection state.
2. Turn the existing player-name control into the passport entry point without removing its current home-screen role.
3. Implement the approved identity, progress, statistics, loadout, locked-item, and equipped-item sections using existing paper and classroom tokens.
4. Implement a single-column phone layout with snap-scrolling loadouts and a two-column desktop layout.
5. Preserve visible focus, 44-pixel touch targets, semantic labels, safe areas, and reduced motion.
6. Apply saved cosmetics immediately on the home classroom and on subsequently started matches.

## Task 6: Present match rewards and unlocks

Files:

- `game-web/src/ui/ui-root.ts`
- `game-web/src/styles/global.css`
- `game-web/src/main.ts`
- `game-web/tests/profile.spec.ts`

Steps:

1. Add browser tests for Quick rewards, Practice/Local no-XP messages, level-up output, and newly unlocked cosmetics.
2. Extend the existing result card rather than introducing a separate result route.
3. Show XP earned, previous/new level progress, level changes, and newly unlocked item names.
4. Keep reward presentation static when reduced motion is enabled.
5. Ensure rematch and exit actions retain their existing behavior.

## Task 7: Exchange safe public cosmetics online

Files:

- `game-web/src/network/protocol.ts`
- `game-web/src/network/protocol.test.ts`
- `game-web/src/network/online-session.ts`
- `game-web/src/network/online-session.test.ts`
- `game-web/server/room-server.ts`
- `game-web/server/room-server.test.ts`
- `game-web/src/main.ts`
- `game-web/tests/online-friend.spec.ts`

Steps:

1. Add failing protocol and room tests for optional avatar, flag, and pen identifiers, including malformed and missing metadata.
2. Add optional public cosmetic metadata to create, join, joined, and peer messages while retaining safe defaults for older clients.
3. Relay cosmetics through rooms without persisting them or trusting them for gameplay.
4. Apply both players' public pen visuals consistently on host and guest renderers.
5. Add a two-browser assertion that both peers see the same public cosmetic selections.

## Task 8: Complete regression and visual verification

Files:

- `game-web/tests/profile.spec.ts`
- `game-web/tests/responsive.spec.ts`
- existing tests as affected

Steps:

1. Test the passport at 320×568, 390×844, phone landscape, tablet, and desktop sizes.
2. Verify no horizontal or vertical overflow, safe-area containment, keyboard navigation, and readable locked states.
3. Run the full Vitest suite, relevant Playwright suites, scoped ESLint, TypeScript production build, and `git diff --check`.
4. Confirm Quick, Practice, Local, Online, rematch, reconnect, physics, and mobile table framing still work.
5. Request final code review and resolve all Critical and Important findings before completion.

## Acceptance Evidence

- version-1 saves migrate without data loss;
- profile edits and equipped cosmetics survive reload;
- Quick and Online results award the approved XP exactly once;
- Practice and Local clearly award no XP;
- levels and unlocks match the approved thresholds through level 99;
- every pen cosmetic uses unchanged Rapier geometry and physics constants;
- both online peers receive safe public cosmetic metadata;
- the Player Passport follows the existing visual system on phone and desktop;
- all existing and new automated checks pass.
