# Level-Based Quick Match Arena Challenges

## Summary

Pen Fight will add deterministic level-based arena challenges to Quick Match. The player's existing profile level (1–99) selects one arena configuration for the entire best-of-three match. Practice, Local, and Online modes retain the current standard arena and behavior.

The feature must preserve existing controls, flick power, scoring, cosmetics, rewards, saved accounts, multiplayer behavior, and mobile usability. It must not introduce new database fields or change the network protocol.

## Goals

- Make each profile level feel progressively harder in Quick Match.
- Introduce table size changes, physical obstacles, surface changes, controlled table tremors, and predictable moving blockers gradually.
- Keep all 99 levels deterministic, fair, physically winnable, and testable.
- Ensure rendered geometry and physics collision geometry always agree.
- Preserve current behavior in Practice, Local, and Online modes.
- Prevent regressions involving disappearing, overlapping, trapped, or prematurely falling pens.

## Non-goals

- Hazards in Practice, Local, or Online matches.
- A separate campaign-save format or database migration.
- Random arena generation during a match.
- Changes to match length, scoring, rewards, flick controls, maximum power, cosmetics, or account progression.
- Ninety-nine separately hand-authored scene implementations.

## Challenge architecture

A pure `challengeForLevel(level)` function will return a validated `ArenaChallenge` description. Invalid or missing levels resolve to level 1. The description contains:

- level and tier identity;
- display name and hazard summary;
- table half-width and half-depth;
- surface/friction zones;
- static and kinematic obstacle definitions;
- post-shot tremor timing and strength;
- safe spawn positions and orientations;
- AI accuracy and strength adjustments.

The generator is deterministic: the same level always produces the same complete description, with no runtime randomness. Ten curated hazard families provide controlled mechanics, while level-specific numeric variations make individual levels distinct.

Quick Match startup derives the current level from profile XP, selects one challenge, and applies it before the opening round. That challenge remains locked for every round and rematch at the same profile level. Practice, Local, and Online explicitly select a standard challenge matching today's arena.

## Scene and physics integration

The classroom scene will expose a challenge-setting boundary alongside its existing match-mode boundary. It will use one `ArenaChallenge` value to configure both visible meshes and Rapier collision geometry.

`DeskWorld` will support controlled arena reconfiguration. Reconfiguration replaces table and hazard colliders while preserving the established pen body, collision, recovery, interpolation, and knockout logic. Dynamic bounds replace hard-coded standard-desk bounds for support recovery and out-of-bounds checks. The standard challenge retains the current dimensions and values exactly.

Static obstacles use fixed colliders. Moving blockers use deterministic kinematic motion driven by the fixed physics step. Slick patches use bounded low-friction colliders that match visible tabletop markings. Tremors apply small capped physical impulses only after a released shot and only while that shot is resolving. They never activate while aiming or after the pens have settled.

No obstacle may overlap a protected spawn zone. Each generated layout must retain a minimum-width route between opposing spawn regions. Rounded or beveled visual geometry will be used where practical, while collider shapes remain simple and stable.

If a challenge fails validation or cannot be configured, the scene logs the failure and falls back to the standard desk rather than failing the match. The existing non-Rapier scene fallback remains intact.

## Difficulty progression

| Levels | Tier | Mechanics |
|---|---|---|
| 1–9 | Training desks | Standard-sized arena, varied safe starts, gradually stronger AI |
| 10–19 | Narrow edges | Table width decreases gradually |
| 20–29 | Center bumper | One fixed rounded obstacle changes position within a safe center band |
| 30–39 | Ruler gates | Two fixed obstacles create angled shot lanes |
| 40–49 | Slick patches | Visible low-friction regions increase sliding distance |
| 50–59 | Desk tremors | Small deterministic post-shot tremors with capped strength |
| 60–69 | Moving chalk | Slow predictable kinematic blockers |
| 70–79 | Short desks | Reduced table depth requires controlled power |
| 80–89 | Mixed trials | Two previously learned mechanics are combined |
| 90–99 | Champion desks | Smaller safe margins, predictable movement, and stronger AI |

Difficulty increases inside each tier through measured changes to dimensions, positions, friction, timing, movement range, tremor intensity, and AI accuracy. Tier transitions must not create an unintended decrease in the aggregate difficulty score.

Level 99 must remain physically winnable. Hazard force is capped below the current maximum player flick force, spawn clearances always exceed the pen footprint, and at least one viable approach lane remains open.

## User interface and accessibility

Quick Match displays a brief non-blocking banner such as `Level 24 · Center Bumper` when the arena starts. The banner does not add another setup screen and does not move or replace the existing match HUD.

The camera frames the complete configured tabletop on desktop, portrait phones, and landscape phones. Mobile pointer-to-table mapping continues to use the actual table plane.

Reduced-motion mode preserves physical challenge timing and fairness but suppresses decorative camera shake and reduces nonessential visual movement. Physical tremor feedback remains readable through subtle table and pen motion without forced camera motion.

## AI behavior

Only Quick Match AI difficulty changes. AI strength and accuracy follow bounded tier values from `ArenaChallenge`. AI targeting accounts for the configured table bounds and uses conservative aim variation; it does not gain extra turns, extra power, or immunity to hazards. The AI and player use the same physical surface and obstacles.

## State, persistence, and networking

The feature derives its input from the existing XP-to-level function. It adds no profile fields, database columns, cookies, or account migration.

Online matches continue to use the standard challenge and current host-authoritative snapshots. No arena fields are added to WebSocket messages. This avoids mixed-level fairness issues and synchronization regressions in the first version.

## Validation and failure handling

Every generated challenge is validated before use:

- finite numeric values and recognized hazard kinds;
- table dimensions inside supported camera and physics limits;
- spawns fully inside the table and outside obstacles;
- obstacle bounds fully inside the playable surface;
- minimum pen clearance around spawns and lanes;
- capped tremor and kinematic speeds;
- unique obstacle identifiers;
- no unsupported hazard combination.

Validation failure selects the standard challenge. Scene reconfiguration is performed only between matches or during a full round reset, never during an active shot.

## Testing strategy

Unit tests will cover:

- deterministic output for all levels 1–99;
- input clamping and standard fallback;
- tier boundaries and monotonic aggregate difficulty;
- table, spawn, corridor, obstacle, force, and movement invariants;
- exact preservation of current standard-desk values;
- dynamic support recovery and out-of-bounds behavior;
- tremor timing restrictions;
- AI parameter bounds.

Physics integration tests will exercise representative levels from every tier, including maximum-power impacts, obstacle collisions, kinematic blockers, slick regions, edge recovery, and repeated pen-to-pen overlap. Tests must confirm that active pens remain visible and recoverable unless they legitimately leave the configured table.

Scene and browser tests will verify:

- Quick Match selects and displays the profile-level challenge;
- the challenge remains stable across best-of-three rounds;
- Practice, Local, and Online retain the standard arena;
- portrait and landscape phones frame the full playable surface and banner;
- maximum-power flick gestures still reach full strength;
- existing account, leaderboard, physics, responsive, and online flows continue to pass.

The acceptance baseline is the existing 119 unit tests and 36 Playwright tests plus the new challenge coverage. Production type checking and build must also pass.

## Delivery constraint

Implementation may be committed locally for review, but it must not be pushed to the remote repository until the user tests it and explicitly approves the push.
