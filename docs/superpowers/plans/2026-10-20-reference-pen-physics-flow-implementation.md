# Reference-Informed Pen Physics Implementation Plan

## Objective

Complete and stabilize the existing Rapier-based pen physics without replacing the current UI, turn controller, or host-authoritative networking model. Work test-first and preserve all pre-existing uncommitted changes.

## Task 1: Protect the render/physics transform boundary

Files:

- `game-web/src/game/desk-physics.ts`
- `game-web/src/game/desk-physics.test.ts`

Steps:

1. Add failing tests proving that a horizontal rendered pen becomes a horizontal Rapier capsule and round-trips to the same render quaternion.
2. Introduce explicit render-to-physics and physics-to-render quaternion conversion helpers using a fixed capsule basis rotation.
3. Use those helpers during body synchronization and pose application.
4. Calculate the strike point from the rendered pen axis represented by the rigid body, not from an axis invalidated by the capsule basis.
5. Run the focused physics tests.

## Task 2: Make fixed stepping and settling explicit

Files:

- `game-web/src/game/desk-physics.ts`
- `game-web/src/game/desk-physics.test.ts`
- `game-web/src/game/solo-turn-controller.ts`
- `game-web/src/game/solo-turn-controller.test.ts`

Steps:

1. Add tests for accumulator behavior, substep capping, and sustained quiet time.
2. Return structured step information containing impacts, total motion, simulated substeps, and settled state.
3. Track linear and angular thresholds for active, non-released pens.
4. Keep the controller responsible for the sustained settle duration and safety transition.
5. Ensure stale accumulated time is discarded after the substep cap.

## Task 3: Enforce one motion authority in the scene

Files:

- `game-web/src/scene/classroom.ts`
- `game-web/src/scene/classroom.test.ts`

Steps:

1. Add regression tests for horizontal body motion, centre/tip strike behavior, single-shot gating, and turn completion.
2. Keep legacy integration and collision response behind the `desk === null` fallback only.
3. Avoid full-world resynchronization during an ordinary shot; synchronize only at setup/reset and apply the impulse to the existing active body.
4. Consume structured physics results for effects and turn settling.
5. Disable or sleep physics bodies when the manual fall presentation takes control.
6. Use consistent pen dimensions for support and knockout checks.

## Task 4: Preserve responsive input and multiplayer intent flow

Files:

- `game-web/src/game/pen-rules.ts`
- `game-web/src/game/pen-rules.test.ts`
- `game-web/src/rendering/game-renderer.ts`
- `game-web/src/network/protocol.ts`
- `game-web/src/network/protocol.test.ts`
- `game-web/src/main.ts`

Steps:

1. Retain pointer dead-zone, nonlinear power shaping, edge charging, centre dead band, and axial efficiency.
2. Validate strike values as normalized values in the network protocol instead of accepting arbitrary finite numbers.
3. Confirm aim throttling and the final flick both carry the same strike position.
4. Confirm keyboard and legacy callers still produce a centre strike.
5. Run focused rule and protocol tests.

## Task 5: Verify complete gameplay behavior

Files:

- `game-web/tests/physics-flow.spec.ts`
- existing unit and browser tests as required

Steps:

1. Add a browser scenario that starts a match, performs a drag, and verifies the input/turn UI progresses without duplicate flicks.
2. Run the full Vitest suite.
3. Run TypeScript build and ESLint.
4. Run relevant Playwright tests at desktop and phone-sized viewports.
5. Inspect the final diff for overlap with unrelated user changes and confirm only approved physics-flow work was added.

## Acceptance Evidence

- focused physics tests prove quaternion round-tripping and horizontal capsule behavior;
- unit tests prove power shaping, off-centre spin, settling, and protocol validation;
- build and lint complete successfully;
- browser evidence shows a shot enters motion and eventually reaches the next valid turn or knockout flow;
- no simulated frame runs both Rapier and legacy collision integration.
