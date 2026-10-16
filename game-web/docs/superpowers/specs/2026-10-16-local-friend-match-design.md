# Local Friend Match and Match HUD Design

## Summary

Add a same-device two-player mode to the existing Three.js Pen Fight game and relocate the match scoreboard so it no longer covers the classroom blackboard. Player 1 uses the saved profile name and blue pen. Player 2 enters a name before the match and uses the red pen. Both players share the same pointer, touch, and keyboard controls and alternate turns.

The implementation will extend the existing match, physics, and scoring pipeline. It will not create a separate local-game engine or add online networking.

## Goals

- Keep the classroom blackboard visually unobstructed during matches.
- Make the Friend option on the notebook home functional.
- Require a Player 2 name before starting a local match.
- Alternate control between the blue and red pens on the same device.
- Preserve the existing first-to-three scoring and knockout rules.
- Keep Quick Match and Practice behavior unchanged.
- Support mouse, touch, and keyboard input for either active pen.

## Non-goals

- Online rooms, invite links, matchmaking, accounts, or networking.
- More than two local players.
- Multiple control devices or simultaneous turns.
- Persisting Player 2 as a permanent profile.

## User Flow

1. The player enters or confirms their name on the notebook home.
2. The Friend row is enabled and labeled as same-device play.
3. Selecting Friend opens a local-match setup sheet.
4. The setup sheet shows Player 1's saved name and requires a Player 2 name of 1–18 trimmed characters.
5. A blank Player 2 name produces an inline error and does not start a match.
6. Starting the match opens the existing arena in `local` mode with scores at 0–0 and Player 1 active.
7. Player 1 flicks the blue pen. After motion settles, control passes to Player 2.
8. Player 2 flicks the red pen. After motion settles, control passes back to Player 1.
9. A knockout awards the point to the surviving pen's player, resets both pens, and starts the next point with Player 1.
10. The first player to three points reaches the existing result flow. Rematch retains both names and local mode.

## State Model

Add `settingUpLocal` to `AppPhase` and `local` to the match-mode union.

`MatchSnapshot` gains an optional `rivalName`. It is required by construction for local matches and omitted for Quick Match and Practice. `AppStore` exposes a local-match start method that trims and validates Player 2's name before publishing a match snapshot.

The local rival name is session state, not persisted profile data. Existing storage remains backward compatible; `lastMode` continues to persist only Quick Match or Practice unless explicitly expanded later.

## Turn Controller

Generalize the controller around these concepts:

- A current `activePlayer` (`0` or `1`).
- A human-ready phase.
- A moving phase.
- AI waiting and moving phases used only by Quick Match.
- A falling/reset phase.

Mode-specific handoff after motion settles:

- `quick`: Player 1 → AI → Player 1.
- `practice`: Player 1 → Player 1.
- `local`: Player 1 ↔ Player 2.

The controller remains responsible only for turn timing and ownership. The scene remains responsible for physics, pen selection, aiming, collision, and knockout detection.

## Scene and Input Behavior

The scene derives the active human pen, velocity, and angular velocity from `activePlayer` instead of assuming the blue pen. The following operations use that active set:

- pickup hit testing;
- aim origin and guide placement;
- flick velocity;
- cancel/reset behavior;
- turn-ring position and color.

In Quick Match, the red pen remains AI-controlled. In Local mode, AI waiting and AI launch paths are never entered.

The existing static targeting rule remains in force: aiming changes only the guide and power meter. Neither active pen translates nor rotates until release.

## Match HUD Layout

Replace the top-center scoreboard with a compact bottom-center match console. This keeps the top-center blackboard clear.

Desktop layout:

- Exit remains upper-left.
- Mode label remains upper-right.
- Flick Power remains lower-left.
- The score console sits bottom-center and contains Player 1, live turn status, and Player 2/rival.
- Player names truncate safely, and the active player receives the blue or red highlight.

Narrow layout:

- The score console spans the lower viewport with compact names and scores.
- Flick Power moves immediately above it to avoid overlap.
- Status text shortens before names or scores are hidden.

Quick Match labels the second side `Class Ace`; Local mode uses the entered Player 2 name. Practice retains its current free-play labeling.

## UI Components and Actions

`UiActions` gains actions for opening local setup and starting a local match. The existing Friend home row becomes enabled and invokes the setup action.

The local setup sheet contains:

- a Back button;
- Player 1's saved name in a read-only summary;
- a labeled Player 2 name input;
- an inline validation message;
- a Start Local Match button.

The match UI derives both competitor labels and turn text from the current match snapshot rather than hard-coding `CLASS ACE`.

## Error Handling and Accessibility

- Reject blank Player 2 names with an inline `role="alert"` message and focus the input.
- Escape or Back returns from local setup to the notebook home.
- Inputs have visible focus states and explicit labels.
- The score console retains `aria-label="Match score"`.
- Turn changes remain announced through the existing polite live region.
- Disabled or unavailable online features are not advertised as functional.

## Testing

Unit tests will cover:

- legal transitions into and out of local setup;
- Player 2 name trimming and validation;
- local turn alternation after each settled shot;
- Quick Match AI and Practice behavior remaining unchanged;
- local mode never producing an AI action;
- active-pen selection and static aim behavior for both pens;
- local scoring and rematch state.

Browser tests will cover:

- Friend opening the setup sheet;
- blank Player 2 validation;
- both names appearing in the match score console;
- control handing from blue to red and back;
- the scoreboard not overlapping the blackboard region at desktop size;
- score console and Flick Power not overlapping on a narrow viewport.

The standard typecheck, lint, production build, unit suite, and Playwright suite must pass.

## Chosen Approach

Extend the shared turn controller and scene with explicit active-player ownership. This is preferable to duplicating the game loop because physics, scoring, falls, reset behavior, and aim rules remain single-sourced. It is also preferable to building a generalized online-ready architecture because the approved scope is strictly same-device play.
