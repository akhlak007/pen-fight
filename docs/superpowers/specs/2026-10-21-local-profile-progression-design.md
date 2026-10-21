# Local Profile and Progression Design

Date: 2026-10-21
Status: Approved design

## Objective

Add a local-first Player Passport to Pen Fight without replacing the existing application, storage, rendering, networking, or visual systems. The feature gives players an identity, levels 1–99, match statistics, and cosmetic pen and desk unlocks. It must work offline, remain fair in online matches, and preserve existing saves.

Authenticated cloud profiles, global leaderboards, match-picture sharing, 2v2 teams, and daily or weekly missions are intentionally outside this implementation. The data identifiers introduced here must remain suitable for those later systems.

## Existing Foundation

The project already has:

- a versioned `StorageService` and save schema;
- dormant wins, matches, XP, and unlocked-pen fields;
- an `AppStore` that owns application and match state;
- a `UiRoot` built around paper, notebook, ink-blue, orange, and classroom styling;
- a Three.js classroom and Rapier pen simulation;
- Quick, Practice, same-device Local, and two-player Online Friend modes;
- WebSocket room codes, invite links, reconnect support, and rematches.

The profile feature extends these components rather than creating a parallel application framework.

## Product Rules

### Eligible Matches

Only completed Quick and Online Friend matches award progression.

| Mode | Completion XP | Winner bonus | Maximum |
| --- | ---: | ---: | ---: |
| Quick | 60 | 40 | 100 |
| Online Friend | 80 | 60 | 140 |
| Practice | 0 | 0 | 0 |
| Same-device Local | 0 | 0 | 0 |

Leaving before the result phase awards nothing. Practice and Local result screens explicitly explain that no XP is awarded. A completed eligible match increments `matches`; a local-player victory also increments `wins`.

Each result is recorded exactly once. A rematch receives a new reward-tracking identifier. Reconnecting to an online match or receiving a repeated result message must not duplicate rewards.

### Levels

Levels are calculated from total XP and are never stored independently. This prevents the level and XP fields from diverging.

The cumulative XP required for level `L` is:

```text
(L - 1) × (100 + 10 × (L - 2))
```

Level is clamped to the range 1–99. XP may continue accumulating at level 99, but the displayed level remains 99.

Reference thresholds:

| Level | Total XP |
| ---: | ---: |
| 1 | 0 |
| 2 | 100 |
| 5 | 520 |
| 10 | 1,620 |
| 20 | 5,320 |
| 50 | 28,420 |
| 99 | 104,860 |

### Cosmetics and Fairness

Pens are cosmetic only. Every pen uses the same collider, mass, friction, restitution, impulse, damping, and power rules. A cosmetic can change material, color, accent, and presentation name, but not physics.

Desk cosmetics change the visible tabletop and surrounding classroom treatment only. They do not change table bounds, camera framing, collision geometry, or gameplay rules.

Nine pens unlock at levels 1, 5, 10, 15, 25, 35, 50, 70, and 90. Three desks unlock at levels 1, 20, and 50. Catalog entries use stable string identifiers so future cloud profiles can reuse them.

## Player Passport Experience

The current player-name control in the classroom header becomes the entry point to the Player Passport. The selected design is the Player Passport layout, not a tab-first locker or progression-only dashboard.

### Identity

The identity section includes:

- editable player name using the existing validation and length limit;
- one of twelve classroom-themed avatar badges;
- a searchable country picker rendered with native flag emoji;
- current level and level title.

Avatar and flag choices are local profile data. Public online-room metadata includes only the chosen avatar identifier, flag code, and equipped pen identifier. Private totals such as XP and wins are never sent to a peer.

### Progress

The progress section shows:

- current level;
- current title;
- XP progress within the current level;
- exact XP remaining to the next level;
- wins;
- eligible matches completed;
- win rate.

At level 99, the progress presentation changes to `MAX LEVEL` and does not show a misleading next-level requirement.

### Loadout

The loadout section shows every pen and desk, including locked items. Locked cards display their required level. Unlocked cards can be equipped immediately. The selected cards display `EQUIPPED`.

Mobile uses a single-column passport and horizontally scrollable, snap-aligned cosmetic rows with large touch targets. Desktop uses a two-column passport with compact cosmetic grids. Both layouts use the existing paper surfaces, ink colors, borders, shadows, type scale, safe-area variables, and reduced-motion rules.

Selecting a cosmetic updates the home classroom immediately and all matches started afterward. A selection cannot change an active match.

### Match Results

Eligible result screens show:

- XP earned;
- previous and new XP progress;
- level-up information;
- newly unlocked cosmetics.

Practice and Local result screens show `No XP — practice match` or `No XP — local match`. Unlock presentation respects reduced-motion settings.

## Architecture

### Save Schema Version 2

The save schema advances from version 1 to version 2. It retains the existing player name, settings, progression totals, unlocked pen identifiers, and last mode while adding profile choices and desk information.

The stored profile data includes:

- avatar identifier;
- ISO-style two-letter flag code;
- selected pen identifier;
- selected desk identifier;
- any explicitly earned cosmetic identifiers that are not level-derived.

Level-derived unlock availability is calculated from XP. It is not duplicated as mutable saved state. Existing version-1 unlocked pen identifiers remain preserved for forward compatibility.

Migration behavior:

- preserve valid version-1 name, settings, XP, wins, matches, unlocked pens, and last mode;
- assign the default avatar, default flag, classic blue pen, and classroom desk when fields are absent;
- replace unknown or locked equipped identifiers with unlocked defaults;
- sanitize malformed profile data independently so one bad field does not erase the rest of the save;
- continue rejecting saves produced by an unsupported newer schema version.

### Profile Catalog

A dedicated catalog module defines immutable avatar, flag, pen, desk, title, and unlock metadata. UI and renderer code consume catalog identifiers rather than maintaining separate lists.

Catalog APIs answer:

- whether an identifier exists;
- the level required for an item;
- whether an item is unlocked for a given XP total;
- the safe equipped fallback;
- the public label and visual tokens for each item.

### Progression Module

A pure progression module owns:

- XP thresholds and level calculation;
- progress within a level;
- mode-specific reward calculation;
- match and win increments;
- unlock differences before and after an award;
- level titles.

The module has no DOM, storage, networking, or Three.js dependency.

### Application State and Reward Idempotency

`AppStore` exposes the current profile snapshot and profile-edit operations. Stored data remains the source of truth across reloads.

Each started match receives a client-side match identifier. The current match tracks whether its result has already been recorded. The award operation checks this marker before updating storage. Rematches create new identifiers. Online result replays and reconnect hydration reuse the current identifier and cannot award twice.

### Rendering Integration

`GameRenderer` receives a validated cosmetic loadout before a match begins. It delegates material selection to the classroom scene. Cosmetic application must not modify geometry, rigid-body construction, physics constants, table dimensions, turn flow, or camera calculations.

The selected desk is used for the local classroom presentation. The selected local pen is used in Quick and Online modes. Same-device Local remains color-coded per player for readability and does not award progression.

### Online Metadata

Room create and join messages add optional validated public cosmetic metadata. Joined and peer messages relay it to the other participant. Older or missing metadata falls back to default visuals. The server does not trust, persist, or use cosmetic metadata for match outcomes.

The protocol limits identifiers and validates them against safe length and character constraints. Unknown catalog identifiers are accepted only as transport-safe strings and then converted to local defaults by the client catalog, allowing mixed client versions to fail safely.

## Error Handling

- Storage write failure keeps the in-memory session usable and follows the existing persistence fallback behavior.
- Invalid avatar, flag, pen, or desk values recover independently.
- A locked saved selection falls back to the first unlocked item.
- Missing peer cosmetic metadata never blocks an online room.
- A failed profile edit leaves the previously saved profile visible.
- XP arithmetic accepts only finite, non-negative integers and clamps unsafe input during sanitation.

## Accessibility and Responsive Behavior

- The passport is a labelled dialog or routed surface with a clear close/back action.
- Avatar, flag, pen, and desk choices use radio-style selection semantics and expose selected and locked states.
- Locked cards are readable but not actionable.
- Keyboard focus follows the existing visible-focus treatment.
- Status text communicates successful saves, level changes, and unlocks without relying on color.
- Touch targets remain at least 44 by 44 CSS pixels.
- Phone portrait, phone landscape, tablet, desktop, safe-area insets, and reduced motion are covered by browser tests.

## Verification

Unit coverage includes:

- version-1 to version-2 migration;
- independent sanitation of all profile fields;
- XP thresholds at levels 1, 2, 5, 10, 20, 50, and 99;
- Quick and Online reward values;
- zero rewards for Practice, Local, and abandoned matches;
- duplicate-result protection;
- every cosmetic unlock boundary;
- fallback from unknown and locked equipped identifiers;
- preservation of physics constants across every pen cosmetic;
- public cosmetic protocol parsing and defaults.

Browser coverage includes:

- opening and closing the passport from the existing header;
- editing avatar and flag;
- equipping unlocked pens and desks;
- preventing locked selections;
- immediate home-classroom cosmetic refresh;
- Quick and Online result rewards;
- Practice and Local no-XP messaging;
- level-up and unlock presentation;
- persistence after reload;
- mobile and desktop layout containment;
- keyboard navigation and accessible selection state;
- two online peers seeing the same public pen cosmetics.

The existing unit, browser, online-room, physics, responsive, lint, and production-build checks must continue to pass.

## Delivery Boundary

This implementation is complete when the local Player Passport, progression rules, cosmetic catalogs, rendering integration, online public cosmetic exchange, migration, result rewards, responsive UI, and defined tests are working.

It does not include authentication, cloud synchronization, public leaderboards, match-image generation, teams, missions, purchases, or stat-changing equipment.
