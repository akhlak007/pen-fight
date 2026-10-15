# Three.js Pen Fight Web Game Implementation Plan

**Design:** `docs/superpowers/specs/2026-10-15-threejs-3d-web-game-design.md`

**Objective:** Build an installable, responsive Three.js Pen Fight web game in `game-web/` while preserving the current Flutter implementation until web parity is verified.

## Working Rules

- Keep all new production code under `game-web/`; do not delete or relocate Flutter files.
- Implement in vertical slices with a failing test or browser assertion before each behavior change.
- Reuse only project-owned assets and the user-supplied procedural asset pack. Treat `penfight.xyz` as visual reference, not a source repository.
- Keep Three.js, Rapier, DOM UI, storage, and audio behind explicit module boundaries.
- Run targeted tests after each task and the complete verification matrix at each milestone.
- Commit each completed task independently when the working tree permits; stage only files named by that task because unrelated Flutter changes are already present.

## Milestone 1: Web foundation and quality gates

### Task 1.1: Scaffold the isolated Vite application

Create:

- `game-web/package.json`
- `game-web/package-lock.json`
- `game-web/index.html`
- `game-web/tsconfig.json`
- `game-web/vite.config.ts`
- `game-web/playwright.config.ts`
- `game-web/src/main.ts`
- `game-web/src/styles/global.css`
- `game-web/src/vite-env.d.ts`
- `game-web/tests/smoke.spec.ts`

Actions:

1. Initialize Vite with TypeScript without a UI framework.
2. Add runtime dependencies `three` and `@dimforge/rapier3d-compat`.
3. Add development dependencies for TypeScript, Vite, Vitest, Playwright, ESLint, and Three.js types.
4. Add scripts for `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, and `test:e2e`.
5. Write a Playwright smoke test that expects a labelled game application shell and canvas.
6. Add the minimum shell required to pass the smoke test.

Verify:

```powershell
Set-Location game-web
npm ci
npm run typecheck
npm run test
npm run build
```

### Task 1.2: Establish application state and lifecycle boundaries

Create:

- `game-web/src/app/app-store.ts`
- `game-web/src/app/app-state.ts`
- `game-web/src/app/lifecycle.ts`
- `game-web/src/app/app-store.test.ts`

Actions:

1. Define typed phases: booting, naming, home, selectingMode, match, paused, result, and fatalError.
2. Define immutable settings, player, load-progress, and match snapshots.
3. Implement explicit commands and subscribe/unsubscribe behavior.
4. Test legal and illegal phase transitions, listener cleanup, visibility pause, and resume.

Verify:

```powershell
npm run test -- app-store
npm run typecheck
```

## Milestone 2: Loading, persistence, and accessible UI

### Task 2.1: Implement versioned storage

Create:

- `game-web/src/storage/schema.ts`
- `game-web/src/storage/storage-service.ts`
- `game-web/src/storage/migrations.ts`
- `game-web/src/storage/storage-service.test.ts`

Actions:

1. Define schema version 1 with player name, settings, progression, unlocked pens, local match, and last mode.
2. Validate every field independently and apply safe defaults.
3. Import compatible legacy keys when the web schema does not yet exist.
4. Add pure migrations and a reset-progress operation that preserves accessibility/audio preferences.
5. Test empty, valid, partial, corrupt, future-version, migrated, and reset data.

Verify:

```powershell
npm run test -- storage-service
```

### Task 2.2: Build tactile DOM surfaces

Create:

- `game-web/src/ui/ui-root.ts`
- `game-web/src/ui/paper-panel.ts`
- `game-web/src/ui/splash-view.ts`
- `game-web/src/ui/name-view.ts`
- `game-web/src/ui/focus-manager.ts`
- `game-web/src/styles/tokens.css`
- `game-web/src/styles/paper.css`
- `game-web/src/styles/controls.css`
- `game-web/tests/onboarding.spec.ts`

Actions:

1. Load local Patrick Hand, Kalam, Anton, and Gloria Hallelujah fonts from copied project-owned assets.
2. Implement the torn-paper loading panel with real progress and failure/retry states.
3. Implement required first-run name entry, whitespace validation, 18-character limit, and saved-name bypass.
4. Add semantic dialog roles, labelled controls, keyboard focus trapping, escape rules, and visible focus.
5. Test first launch, invalid name, saved name, editing, keyboard navigation, and responsive phone layout.

Verify:

```powershell
npm run test
npm run test:e2e -- onboarding.spec.ts
```

## Milestone 3: Three.js rendering platform

### Task 3.1: Create renderer and quality profiles

Create:

- `game-web/src/rendering/renderer.ts`
- `game-web/src/rendering/capabilities.ts`
- `game-web/src/rendering/quality-profile.ts`
- `game-web/src/rendering/post-processing.ts`
- `game-web/src/rendering/quality-profile.test.ts`

Actions:

1. Configure sRGB output, ACES tone mapping, physically correct lights, context loss handling, and safe pixel-ratio caps.
2. Define Ultra, High, and Performance profile values for shadows, antialiasing, ambient occlusion, bloom, particles, reflections, and pixel ratio.
3. Implement automatic profile selection from WebGL capabilities, device hints, and a renderer warm-up result.
4. Preserve manual override and reduced-motion settings.
5. Test deterministic profile selection and fallback behavior without requiring WebGL in unit tests.

Verify:

```powershell
npm run test -- quality-profile
npm run typecheck
```

### Task 3.2: Build asset loading and failure recovery

Create:

- `game-web/src/assets/asset-manifest.ts`
- `game-web/src/assets/asset-loader.ts`
- `game-web/src/assets/asset-loader.test.ts`
- `game-web/src/rendering/context-recovery.ts`

Actions:

1. Divide assets into essential and deferred preload groups.
2. Emit byte/item progress to the application store.
3. Support neutral material, silent audio, and suppressed-effect fallbacks for optional assets.
4. Fail essential groups with named categories and retry commands.
5. Handle one WebGL context restoration attempt before requesting reload.

Verify:

```powershell
npm run test -- asset-loader
```

## Milestone 4: Procedural classroom and premium materials

### Task 4.1: Port the supplied procedural geometry

Create:

- `game-web/src/scene/factories/desk.ts`
- `game-web/src/scene/factories/bench.ts`
- `game-web/src/scene/factories/pen.ts`
- `game-web/src/scene/factories/blackboard.ts`
- `game-web/src/scene/factories/backpack.ts`
- `game-web/src/scene/factories/props.ts`
- `game-web/src/scene/factories/floor.ts`
- `game-web/src/scene/classroom.ts`
- `game-web/src/scene/dispose.ts`
- `game-web/src/scene/classroom.test.ts`

Actions:

1. Port each standalone factory from the supplied HTML into typed, parameterized modules.
2. Add named object groups and interaction metadata.
3. Reuse geometry/material instances and use instancing for repeated furniture where it improves draw calls.
4. Add deterministic disposal for geometries, textures, materials, render targets, and event hooks.
5. Test required object names, dimensions, collider anchors, and cleanup.

Verify:

```powershell
npm run test -- classroom
npm run typecheck
```

### Task 4.2: Upgrade geometry and PBR materials

Create:

- `game-web/src/scene/materials/material-library.ts`
- `game-web/src/scene/materials/wood-material.ts`
- `game-web/src/scene/materials/chalkboard-material.ts`
- `game-web/src/scene/materials/pen-material.ts`
- `game-web/src/scene/materials/fabric-material.ts`
- `game-web/src/scene/materials/tile-material.ts`
- `game-web/src/scene/textures/procedural-textures.ts`
- `game-web/src/scene/geometry/bevelled-box.ts`

Actions:

1. Add bevelled silhouettes to close-up geometry.
2. Generate or load project-owned base-color, normal, roughness, wear, scratch, paper, chalk, fabric, and tile textures.
3. Apply physically plausible roughness, metalness, transparency, environment intensity, and anisotropy.
4. Build pens with translucent barrel, ink tube, grip, cap, clip, and metallic nib.
5. Add contact-shadow-ready geometry and quality-profile-controlled material features.

Verify:

```powershell
npm run typecheck
npm run build
```

### Task 4.3: Author lighting, atmosphere, and blackboard text

Create:

- `game-web/src/scene/lighting.ts`
- `game-web/src/scene/atmosphere.ts`
- `game-web/src/scene/blackboard-texture.ts`
- `game-web/src/scene/environment-controller.ts`
- `game-web/src/scene/blackboard-texture.test.ts`

Actions:

1. Add motivated window/sun lighting, readable hemisphere fill, soft desk shadows, and classroom practical lights.
2. Add profile-scaled dust, subtle light variation, paper movement, bag movement, and pen glints.
3. Render escaped player names, score, turn, opponent, and progress marks to a canvas-backed blackboard texture.
4. Ensure environmental animation pauses for hidden pages and respects reduced motion.
5. Test text normalization and update invalidation.

Verify:

```powershell
npm run test -- blackboard-texture
npm run build
```

## Milestone 5: Cameras, responsive Home, and mode selection

### Task 5.1: Implement authored camera poses and transitions

Create:

- `game-web/src/rendering/camera-rig.ts`
- `game-web/src/rendering/camera-poses.ts`
- `game-web/src/rendering/responsive-framing.ts`
- `game-web/src/rendering/responsive-framing.test.ts`

Actions:

1. Author Arrival, Home, Desk focus, Match, and Result poses.
2. Define desktop 16:9, ultrawide, tablet landscape, phone landscape, and phone portrait offsets.
3. Interpolate position, target, field of view, and exposure.
4. Replace spatial movement with fades or immediate changes under reduced motion.
5. Test breakpoint selection, desk visibility bounds, and pose completion.

Verify:

```powershell
npm run test -- responsive-framing
```

### Task 5.2: Make the classroom the Home interface

Create:

- `game-web/src/scene/interaction-controller.ts`
- `game-web/src/ui/home-hud.ts`
- `game-web/src/ui/mode-selector.ts`
- `game-web/src/ui/settings-view.ts`
- `game-web/src/styles/home.css`
- `game-web/src/styles/notebook.css`
- `game-web/tests/home.spec.ts`

Actions:

1. Raycast the central desk and pens for mouse, touch, focus, and keyboard activation.
2. Add restrained hover/touch light response, glint, parallax, and accessible action text.
3. Implement desktop top navigation and compact mobile navigation.
4. Transition to Desk focus and open the two-page mode selector.
5. Wire Solo, Local, Tournament alias, Friend unavailable, Instant unavailable, Settings, and player-name editing.
6. Test every action, focus return, responsive composition, and reduced-motion behavior.

Verify:

```powershell
npm run test:e2e -- home.spec.ts
npm run build
```

## Milestone 6: Rapier pen-fight simulation

### Task 6.1: Implement pure match rules first

Create:

- `game-web/src/game/match-state.ts`
- `game-web/src/game/match-rules.ts`
- `game-web/src/game/match-rules.test.ts`
- `game-web/src/game/exit-resolution.ts`
- `game-web/src/game/exit-resolution.test.ts`

Actions:

1. Port best-of-five scoring, alternating turns, round/match completion, restart, and messages.
2. Define desk-exit and near-simultaneous replay semantics independent of Rapier.
3. Cover both winners, double exits, invalid commands, and reset behavior.

Verify:

```powershell
npm run test -- match-rules
```

### Task 6.2: Build the fixed-step physics world

Create:

- `game-web/src/physics/physics-world.ts`
- `game-web/src/physics/pen-body.ts`
- `game-web/src/physics/desk-colliders.ts`
- `game-web/src/physics/fixed-step.ts`
- `game-web/src/physics/physics-events.ts`
- `game-web/src/physics/fixed-step.test.ts`

Actions:

1. Initialize Rapier once and create desk/pen rigid bodies and colliders.
2. Use fixed timesteps with accumulator limits and render interpolation.
3. Apply linear/angular damping, sleep thresholds, collision groups, restitution, and friction tuned for readable pen fights.
4. Emit normalized collision, settle, and exit events without coupling to UI.
5. Test fixed-step accumulation, pause, clamping, settle logic, and event ordering.

Verify:

```powershell
npm run test -- fixed-step
npm run typecheck
```

### Task 6.3: Implement normalized flick input

Create:

- `game-web/src/game/aim-controller.ts`
- `game-web/src/game/aim-math.ts`
- `game-web/src/game/aim-math.test.ts`
- `game-web/src/scene/aim-visual.ts`

Actions:

1. Raycast only the active pen and capture one pointer safely.
2. Convert screen drag to desk-plane world direction and normalized power.
3. Clamp legal impulse and torque ranges.
4. Render a profile-aware projected aim line and power feedback.
5. Cancel cleanly on pause, pointer loss, visibility loss, or phase change.
6. Test screen-size independence, direction reversal, minimum/maximum power, and cancellation.

Verify:

```powershell
npm run test -- aim-math
```

### Task 6.4: Integrate match orchestration and solo AI

Create:

- `game-web/src/game/match-controller.ts`
- `game-web/src/game/solo-ai.ts`
- `game-web/src/game/solo-ai.test.ts`
- `game-web/src/ui/match-hud.ts`
- `game-web/tests/match.spec.ts`

Actions:

1. Connect input, physics events, pure rules, blackboard, pause, result, and persistence.
2. Implement AI candidate impulses using current legal state only.
3. Add difficulty-scaled aim error, turn delay, and legal force limits.
4. Implement same-device Local play using the same match controller.
5. Test a complete match using deterministic physics/test adapters and browser-level start/pause/restart/exit flows.

Verify:

```powershell
npm run test -- solo-ai
npm run test:e2e -- match.spec.ts
```

## Milestone 7: Audio, feedback, results, and progression

### Task 7.1: Add resilient audio and haptics

Create:

- `game-web/src/audio/audio-engine.ts`
- `game-web/src/audio/audio-manifest.ts`
- `game-web/src/audio/impact-router.ts`
- `game-web/src/audio/impact-router.test.ts`
- `game-web/src/audio/haptics.ts`

Actions:

1. Copy and register existing project-owned audio.
2. Create ambience, music, UI, and effects buses with independent settings.
3. Unlock on valid gesture and recover gracefully from rejected playback.
4. Route collision magnitude to soft, medium, or hard impacts with cooldowns.
5. Add optional spatial positioning and supported vibration patterns.
6. Test routing thresholds, cooldowns, mute settings, and unsupported APIs.

Verify:

```powershell
npm run test -- impact-router
```

### Task 7.2: Add physical feedback and result presentation

Create:

- `game-web/src/scene/effects/impact-effects.ts`
- `game-web/src/scene/effects/confetti.ts`
- `game-web/src/scene/effects/camera-impulse.ts`
- `game-web/src/ui/pause-view.ts`
- `game-web/src/ui/result-view.ts`
- `game-web/tests/results.spec.ts`

Actions:

1. Add profile-scaled dust, sparks, desk vibration, rim light, chalk animation, and confetti.
2. Update blackboard score before presenting results.
3. Add accessible pause and result paper panels with resume, next round, replay, and exit.
4. Disable camera impulses and large page motion in reduced-motion mode.
5. Test focus, commands, score ordering, and reduced-motion output.

Verify:

```powershell
npm run test:e2e -- results.spec.ts
```

### Task 7.3: Add solo progression and pen unlocks

Create:

- `game-web/src/game/progression.ts`
- `game-web/src/game/progression.test.ts`
- `game-web/src/game/pen-catalog.ts`
- `game-web/src/ui/progression-view.ts`

Actions:

1. Define twelve solo steps and map existing original pen art/metadata to unlocks.
2. Persist wins and unlocked pen IDs.
3. Present progress on the blackboard and result card.
4. Keep collection interaction small; a full store is outside this migration.
5. Test no duplicate unlocks, maximum progress, and reset behavior.

Verify:

```powershell
npm run test -- progression
```

## Milestone 8: PWA, performance, and production verification

### Task 8.1: Add installable PWA behavior

Create:

- `game-web/public/manifest.webmanifest`
- `game-web/public/icons/`
- `game-web/src/app/service-worker-registration.ts`
- `game-web/src/service-worker.ts`
- `game-web/tests/pwa.spec.ts`

Actions:

1. Add app metadata, icons, landscape preference, theme colors, and standalone display.
2. Cache the production shell and essential opening assets using versioned cache names.
3. Keep dynamic/secondary assets network-first with safe fallback.
4. Show a non-blocking update-ready prompt rather than replacing a running match.
5. Test manifest validity, registration, offline shell, and update behavior.

Verify:

```powershell
npm run build
npm run test:e2e -- pwa.spec.ts
```

### Task 8.2: Enforce performance and cleanup budgets

Create:

- `game-web/src/rendering/performance-monitor.ts`
- `game-web/src/rendering/performance-monitor.test.ts`
- `game-web/scripts/check-bundle-budget.mjs`

Actions:

1. Record rolling frame time and recommend a lower automatic profile after sustained slow frames.
2. Never override a manual profile without confirmation.
3. Track renderer calls, triangles, textures, and geometries in development.
4. Dispose scene resources and event listeners during transitions/reloads.
5. Enforce documented JavaScript, essential-asset, and deferred-asset budgets after measuring the first release build.

Verify:

```powershell
npm run test -- performance-monitor
npm run build
node scripts/check-bundle-budget.mjs
```

### Task 8.3: Complete the cross-browser acceptance matrix

Update:

- `game-web/tests/visual.spec.ts`
- `game-web/tests/accessibility.spec.ts`
- `game-web/README.md`
- root `README.md`

Actions:

1. Capture Loading, Home, Desk focus, Match, Pause, and Result snapshots at the approved viewport matrix.
2. Verify Chrome, Edge, Firefox, Android-sized touch emulation, keyboard navigation, and contrast/focus behavior.
3. Record Ultra, High, and Performance frame-time results on available representative hardware.
4. Verify essential failure, optional fallback, context loss, audio denial, visibility pause, and offline shell.
5. Document setup, commands, browser requirements, architecture, quality profiles, and known fallbacks.
6. Compare every acceptance criterion in the design specification and record pass/fail evidence.

Final verification:

```powershell
Set-Location game-web
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## Completion Gate

Do not redirect the repository's primary launch instructions from Flutter to `game-web/` until:

- the full final verification command passes;
- visual snapshots have been reviewed at all target sizes;
- Solo and Local matches are playable with mouse and touch;
- persistence migration has been exercised against representative existing data;
- High mode meets the 60 FPS target on a representative modern desktop and phone;
- Performance mode remains at or above the 30 FPS floor;
- all ten acceptance criteria in the design specification are evidenced;
- the user has approved the finished web experience.
