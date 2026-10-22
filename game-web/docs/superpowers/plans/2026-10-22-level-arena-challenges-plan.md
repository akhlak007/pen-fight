# Level-Based Quick Match Arena Challenges Implementation Plan

**Source specification:** `docs/superpowers/specs/2026-10-22-level-arena-challenges-design.md`

**Delivery rule:** Commit locally as needed, but do not push until the user tests and explicitly approves.

## Task 1: Deterministic challenge catalog

**Files**

- Create `src/game/arena-challenges.ts`
- Create `src/game/arena-challenges.test.ts`

**Work**

1. Define the standard arena dimensions and the typed `ArenaChallenge`, obstacle, friction-zone, tremor, and spawn contracts.
2. Write failing tests covering all levels 1–99, clamping, deterministic output, tier boundaries, unique IDs, supported dimensions, safe spawn clearance, obstacle containment, open corridors, force/speed caps, and monotonic aggregate difficulty.
3. Implement ten curated tier generators with level-specific deterministic values.
4. Implement validation and standard fallback without runtime randomness.
5. Confirm the current standard dimensions and spawn layout remain exact for non-Quick modes.

**Verification**

- `npx vitest run src/game/arena-challenges.test.ts`
- `npm run typecheck`

## Task 2: Configurable table bounds and stable pen recovery

**Files**

- Modify `src/game/desk-physics.ts`
- Modify `src/game/desk-physics.test.ts`

**Work**

1. Add failing tests for dynamic table dimensions, support-zone checks, interior recovery, legitimate knockout detection, and maximum-power motion on narrow/short desks.
2. Replace hard-coded bounds in support and knockout calculations with an immutable arena-bounds input while retaining current defaults.
3. Track and safely replace arena colliders only between match resets.
4. Keep the four existing pen bodies, interpolation, CCD, visibility, overlap handling, and release behavior intact.
5. Add tests that repeatedly overlap/impact pens on representative arena sizes and assert they do not vanish inside the tabletop.

**Verification**

- `npx vitest run src/game/desk-physics.test.ts src/game/pen-rules.test.ts`

## Task 3: Physical hazard implementation

**Files**

- Modify `src/game/desk-physics.ts`
- Modify `src/game/desk-physics.test.ts`

**Work**

1. Add fixed obstacle colliders with stable simple shapes.
2. Add visible-zone-compatible friction colliders for slick patches.
3. Add deterministic kinematic blocker movement driven by the fixed 120 Hz physics step.
4. Add capped post-shot tremor activation that cannot run during aiming or after settlement.
5. Return hazard events/state needed by the scene without leaking Rapier objects.
6. Test representative levels from each physical tier, force caps, timing, collision response, and clean arena reconfiguration.

**Verification**

- `npx vitest run src/game/arena-challenges.test.ts src/game/desk-physics.test.ts`

## Task 4: Scene geometry, AI, and match locking

**Files**

- Modify `src/scene/classroom.ts`
- Modify `src/scene/classroom.test.ts`
- Modify `src/rendering/game-renderer.ts`
- Modify `src/rendering/arena-camera.ts`
- Modify `src/rendering/arena-camera.test.ts`

**Work**

1. Extend the scene match boundary to accept an optional challenge, defaulting to the exact standard challenge.
2. Build table surface, edge, obstacle, slick-zone, and moving-blocker meshes from the same challenge used by physics.
3. Lock the challenge until the next match/rematch initialization and never reconfigure during an active shot.
4. Apply bounded AI accuracy/strength from the challenge while preserving normal turn rules and shared physics.
5. Frame configured table bounds on desktop and portrait/landscape phones without changing standard-arena framing.
6. Keep reduced-motion behavior physical but suppress decorative camera/table shake.
7. Test standard modes, challenge locking, AI bounds, geometry/physics agreement, and fallback on invalid configuration.

**Verification**

- `npx vitest run src/scene/classroom.test.ts src/rendering/arena-camera.test.ts`

## Task 5: Quick Match wiring and level banner

**Files**

- Modify `src/main.ts`
- Modify `src/ui/ui-root.ts`
- Modify `src/styles/global.css`
- Modify relevant UI unit tests
- Create or modify `tests/level-challenges.spec.ts`

**Work**

1. Derive the challenge from the existing `levelForXp(profile.xp)` only when starting or rematching Quick Match.
2. Pass the standard challenge for Practice, Local, and Online.
3. Add an accessible, non-blocking in-match banner showing level and hazard label.
4. Keep the existing HUD positions and controls unchanged, including narrow-phone safe areas.
5. Ensure the banner clears when leaving the match and remains stable across rounds.
6. Add browser coverage for low, middle, and high level challenges; unchanged standard modes; full-power input; mobile framing; and match-round stability.

**Verification**

- `npx vitest run src`
- `npx playwright test tests/level-challenges.spec.ts tests/physics-flow.spec.ts tests/responsive.spec.ts`

## Task 6: Full regression and review

**Work**

1. Run type checking, lint, the full unit suite, production build, and all Playwright tests.
2. Distinguish any existing unrelated lint failures from introduced failures; do not modify unrelated code without evidence.
3. Request an independent code review focused on physics safety, deterministic behavior, mobile framing, mode isolation, and network regression.
4. Fix every Critical or Important finding and rerun focused/full verification.
5. Start the local application for the user's manual check.
6. Report the local URL, implemented tiers, verification evidence, commit(s), and any known limitations.
7. Do not push. Wait for explicit user approval after their manual test.

**Final verification commands**

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
- `git status --short`
