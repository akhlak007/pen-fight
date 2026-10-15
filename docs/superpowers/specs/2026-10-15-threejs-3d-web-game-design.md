# Three.js Pen Fight Web Game Design

## Goal

Replace the flat, Flutter-first presentation with a web-first, real-time 3D Pen Fight experience. The result must match the visual ambition of the supplied classroom reference: the classroom is the interface, the central desk is a physical play space, the blackboard carries live game information, and tactile notebook-paper panels appear only when a decision requires focused UI.

The new version must preserve the current playable product flow—splash, player naming, Home, solo play, local play, settings, scoring, and saved progress—while materially improving depth, lighting, motion, responsiveness, and interaction quality. The existing Flutter implementation remains intact until the web version reaches feature parity and passes its acceptance checks.

## Product Direction

The application becomes an installable web game built with HTML, CSS, TypeScript, and Three.js. It uses the supplied `Pen Fight 3D asset pack.html` as the source for original procedural classroom geometry and uses `penfight.xyz` only as a quality and interaction reference. No code or proprietary assets are copied from the reference site.

The visual identity combines stylized low-poly forms with physically believable lighting and materials. It should feel handcrafted and nostalgic rather than photorealistic: warm worn wood, soft classroom daylight, chalk dust, painted metal, faded notebooks, scuffed tiles, and slightly exaggerated pen highlights. The 3D scene carries atmosphere and spatial interaction; semantic HTML/CSS carries menus, forms, dialogs, and accessibility.

## Scope and Migration Strategy

Development begins in a new `game-web/` directory. This isolates the Vite application from Flutter's existing `web/` directory and avoids destabilizing the current game. The Flutter source, tests, and assets are not deleted or reorganized during the migration.

The migration has three milestones:

1. **Visual shell:** loading sequence, player naming, 3D classroom Home, interactive desk, mode selector, settings, responsive cameras, audio unlock, and graphics profiles.
2. **Playable match:** Rapier-driven solo and same-device local matches, flick input, collisions, round resolution, scoring, blackboard HUD, pause, and results.
3. **Parity and polish:** solo progression, pen collection and unlocking, save migration, adaptive performance, PWA installation, browser compatibility, final audio/visual effects, and production builds.

The Three.js application becomes the primary shipped version only when the parity checklist is complete. Online Friend and Instant modes remain visible but explicitly unavailable; implementing networking, accounts, or matchmaking is outside this migration.

## Technology

- **Vite and TypeScript** provide the build system, module boundaries, development server, and production bundling.
- **Three.js** owns WebGL rendering, cameras, lights, materials, scene animation, picking, and post-processing.
- **Rapier 3D** owns rigid-body simulation, collision detection, impulses, sleeping, and deterministic game-facing collision events.
- **HTML and CSS** render the splash, name form, mode selector, settings, pause, results, accessibility text, and fallback screens.
- **Web Audio API** manages classroom ambience, music, UI sounds, spatial impacts, and browser audio-unlock behavior.
- **localStorage** stores versioned player settings and progress. IndexedDB is not required for the initial migration because all persisted state is small structured data.
- **Service worker and web manifest** provide installable PWA behavior and cache the production shell and essential opening assets.
- **Vitest** covers pure game and storage logic. **Playwright** covers browser flow, responsive UI, accessibility, and visual snapshots.

The initial implementation uses no front-end framework. The UI is small enough for typed DOM components and a central store; adding React or another framework would increase runtime and architectural cost without solving a current requirement.

## Application Architecture

The `game-web/src/` source tree is divided by responsibility:

- `app/`: boot sequence, route/state orchestration, capability detection, and application lifecycle.
- `rendering/`: renderer creation, cameras, lights, shadows, post-processing, resize behavior, and quality profiles.
- `scene/`: classroom construction, object factories, materials, interaction targets, environmental animation, and scene transitions.
- `physics/`: Rapier initialization, pen rigid bodies, desk colliders, impulses, collision events, and world stepping.
- `game/`: match state machine, turns, best-of-five rules, solo opponent decisions, progression, and immutable snapshots.
- `ui/`: typed DOM views for splash, player name, mode selection, settings, pause, results, unsupported-device, and load failure.
- `audio/`: loading, unlock, buses, ambience, music, spatial effects, throttling, and lifecycle pause/resume.
- `storage/`: schema versions, validation, migration, defaults, reads, writes, and reset behavior.
- `assets/`: stable asset manifest and preload groups.

A single typed application store is the boundary between systems. Commands such as `startMatch`, `beginAim`, `releaseFlick`, `pause`, and `setGraphicsProfile` enter through explicit methods. Renderers and UI subscribe to immutable snapshots. DOM components never mutate Three.js objects directly, and scene objects never write to storage directly.

The update loop uses a fixed physics timestep with interpolation for rendering. Physics remains independent of monitor refresh rate and momentary frame drops. Visibility loss and pause stop physics and mute appropriate audio buses.

## Asset and Material Pipeline

The procedural functions in the supplied HTML are separated into reusable TypeScript factories for the desk, bench, pen, pencil box, notebooks, paper and pencil, blackboard, backpacks, floor, and complete classroom.

The original primitives are upgraded without changing their recognizable style:

- Beveled desk, bench, board-frame, pencil-box, and backpack edges catch highlights and avoid perfectly sharp computer-generated silhouettes.
- Reusable UV-mapped materials replace per-object flat colors.
- Wood uses base color, normal, and roughness detail with scratches, carved names, edge wear, and restrained variation between desks.
- Pens use translucent barrels, metallic nibs, molded plastic, internal ink tubes, contact shadows, and distinct player colors.
- Tiles, painted walls, chalkboard, paper, cloth, and metal each use physically plausible roughness and reflectance ranges.
- Classroom props reuse geometry and materials through instancing where practical.
- Text that changes at runtime—the player name, score, opponent, turn, and progression—is drawn to canvas textures and applied to the blackboard.

Opening assets are split into an essential preload group: classroom geometry, central desk, default pens, core materials, fonts, and Home ambience. Secondary pens, particles, mode-specific audio, and collection content load after Home becomes interactive.

## Rendering and Visual Quality

The renderer uses physically correct lighting, sRGB color management, ACES filmic tone mapping, soft shadows, and resolution limits appropriate to the selected profile. The scene uses a hemisphere or environment contribution for readable fill plus motivated window/sun and classroom light sources.

Post-processing is restrained and ordered as follows:

1. Scene render with tone mapping.
2. Screen-space ambient occlusion where supported.
3. Selective, low-intensity bloom for pen highlights and celebratory effects.
4. Color grading and a subtle vignette.
5. Optional anti-aliasing appropriate to the device.

Depth of field is permitted only in non-interactive cinematic transitions. Gameplay keeps the full desk readable. Motion blur is excluded because it harms input clarity and mobile performance.

Three graphics profiles control pixel ratio, shadow size, shadow type, post-processing, particle count, environment detail, and reflection quality:

- **Ultra:** desktop-class GPU, full post-processing, high-resolution soft shadows, richer particles, and full environment animation.
- **High:** default for capable desktops and modern phones, moderate shadows and ambient occlusion with limited bloom.
- **Performance:** capped pixel ratio, simplified shadows, no ambient occlusion or bloom, reduced particles, and minimal environmental animation.

Capability detection chooses an initial profile from WebGL support, screen density, device memory when exposed, and a short renderer warm-up. A manual setting always overrides automatic selection. The target is stable 60 FPS on typical modern devices and a stable 30 FPS floor in Performance mode.

## Cameras and Responsive Composition

The application uses named camera poses rather than free navigation:

- **Arrival:** a brief establishing view that settles toward the central desk.
- **Home:** the classroom composition from the reference, with surrounding benches, blackboard, bags, and desk visible.
- **Desk focus:** a closer angle used while the mode selector is open.
- **Match:** a readable top-down perspective containing the entire playable surface and both pens.
- **Result:** a short winner-focused camera move that never hides result controls.

Transitions interpolate position, target, field of view, and exposure using reduced-motion-aware durations. Desktop, tablet landscape, phone landscape, and phone portrait use separately authored framing offsets so the important desk and blackboard remain visible. UI safe areas account for notches and browser controls.

## Player Experience

### Loading and Player Name

The classroom begins dimmed behind the torn-paper “Finding your seat” splash. Loading text reflects actual essential-asset progress rather than a decorative timer. If no player name exists, the splash transitions to a required paper name card. The trimmed name is limited to 18 visible characters, saved locally, and rendered on the blackboard.

### Home

Home is the live classroom, not a large menu laid over an image. The camera has subtle breathing motion. Dust moves through motivated light, fluorescent lights vary gently, bags and loose paper receive restrained idle movement, and ambient classroom audio establishes space.

The central desk and pens are the primary Solo action. Hover, focus, or touch produces a small light response, pen glint, and camera parallax cue. Desktop navigation for Friend, Instant, Community, Sign In, and Settings remains minimal in the upper-right. On small screens it collapses without covering the desk or blackboard. Player identity and version remain understated in the lower-left.

Selecting the desk moves the camera to Desk focus and opens a two-page notebook panel with Solo, Local, Tournament, Friend, and Instant choices. Solo and Local are functional. Tournament maps to the existing same-device best-of-five flow until a separate tournament specification exists. Friend and Instant show a clear unavailable message.

### Match

Starting a match transitions the existing camera into the Match pose rather than replacing the scene. The central desk becomes the Rapier arena. The blackboard shows player names, best-of-five score, current turn, and small progress marks.

The player presses or touches the active pen, drags backward to choose direction and power, and releases to apply the opposite impulse. World-space input normalizes across viewport sizes. A projected aim line and power response are visible without obscuring the pens. The current pen has an integrated rim light or chalk-like marker rather than a detached UI glow.

Impact strength selects soft, medium, or hard sounds and drives dust, sparks, desk vibration, and a short camera impulse. Effects have cooldowns to prevent noise. A round resolves only after bodies settle or leave the desk. Near-simultaneous exits inside the defined tolerance replay the round. The first player to three rounds wins.

Solo AI evaluates legal impulses toward contact, favors pushing the player toward the nearest edge, and adds difficulty-scaled error. It does not read future simulation results or use impossible forces.

### Pause and Results

Pause, settings, and results dim the 3D scene and present tactile paper cards with proper HTML focus management. Results update the blackboard before showing the paper card. Match victory adds restrained confetti, chalk animation, crowd audio, and a brief camera move. Reduced-motion mode replaces spatial camera movement with fades and immediate state changes.

## Audio and Haptics

Audio is divided into ambience, music, UI, and effects buses. Browser audio unlock occurs on the first valid user gesture. Classroom ambience uses layered loops and low-volume positional details. Pen impacts and falls use spatial audio relative to the camera. Rapid repeated collisions are throttled.

Existing original WAV and OGG files are reused where appropriate. Additional ambience is optional and must be original or correctly licensed. Mobile vibration uses the Vibration API when available and enabled; unsupported browsers silently continue without haptics.

## State and Persistence

The storage schema includes:

- schema version;
- player name;
- music, ambience, effects, haptics, reduced motion, and graphics profile;
- solo wins, progression marker, and unlocked pens;
- saved local score and player names;
- last selected mode.

Every read is validated. Invalid fields fall back independently rather than discarding the entire save. Migrations are pure functions from one schema version to the next and are tested with representative old and corrupt data. Writes are batched after meaningful state changes instead of occurring every render frame.

The initial web schema imports compatible values from the current keys where available. Unsupported Flutter-specific values are ignored. Reset Progress clears match and progression data after confirmation but retains accessibility and audio preferences; changing the player name remains a separate action.

## Failure and Fallback Behavior

- Unsupported WebGL shows a readable page explaining the browser requirement and links back to a non-WebGL support route.
- Essential asset failure names the failed category, provides Retry, and never leaves a blank canvas.
- Optional asset failure substitutes a neutral material, suppresses the missing effect, or uses silence.
- Rapier initialization failure blocks match start with an actionable error while leaving Home and settings usable.
- Audio failure disables affected buses without blocking play.
- A lost WebGL context pauses the game, shows recovery status, and attempts renderer restoration once before asking for reload.
- Visibility loss, page freeze, and navigation pause physics and audio safely.
- Performance monitoring may recommend a lower profile after sustained slow frames, but it does not change a manually selected profile without confirmation.

## Accessibility

All controls use semantic HTML with visible keyboard focus, labels, and logical tab order. Canvas interactions have parallel instructions and named controls. Color is never the only indicator of turn or result. Text and critical controls meet contrast targets over their panels. Reduced motion, muted audio, and graphics settings are available before starting a match.

The match is primarily spatial, but score, turn, power, pause, and result state are exposed in live HTML regions without announcing continuous physics noise. Touch targets meet mobile sizing requirements.

## Verification

### Automated logic tests

- Best-of-five scoring, turn changes, match completion, restart, and near-simultaneous exits.
- Aim normalization, impulse clamping, legal input states, and AI force limits.
- Storage defaults, validation, migrations, reset behavior, and player-name rules.
- Graphics-profile detection, manual override, and reduced-motion behavior.

### Browser and integration tests

- First launch, required name entry, returning launch, name editing, mode selection, match start, pause, result, and reload persistence.
- Mouse, touch-emulated pointer, and keyboard flows.
- Web Audio unlock and graceful denial.
- Lost visibility and resume behavior.
- PWA manifest, service-worker registration, and offline opening shell.

### Visual and performance checks

- Snapshot the Loading, Home, Desk focus, Match, Pause, and Result states at desktop 16:9, ultrawide, tablet landscape, phone landscape, and phone portrait sizes.
- Confirm the full desk, active pens, blackboard score, and primary controls remain visible at every supported composition.
- Compare framing, material response, shadow softness, paper hierarchy, and warm color grade to the approved classroom reference.
- Record frame time on representative Ultra, High, and Performance configurations. High must target 60 FPS; Performance must remain playable at or above 30 FPS.
- Verify Chrome, Edge, Firefox, Android Chrome, and an iOS Safari-compatible fallback path. Safari-specific visual reductions are acceptable when required for stability.

## Acceptance Criteria

The migration is ready to replace the Flutter front end when all of the following are true:

1. The supplied procedural classroom is rendered in real time with upgraded geometry, materials, shadows, and authored lighting.
2. Loading, naming, Home, mode selection, Solo, Local, pause, results, settings, and persistence are complete.
3. Player names and scores update on the physical blackboard.
4. Camera transitions connect Home, selection, gameplay, and results without a disconnected screen cut.
5. Match physics produces stable, understandable flicks and resolves all documented edge cases.
6. Desktop and mobile input are both usable, and critical UI is accessible by keyboard.
7. Automatic quality profiles meet the visual and frame-rate targets without hiding required game state.
8. Essential failures show recoverable UI rather than a blank or frozen canvas.
9. Automated tests, representative visual snapshots, and production builds pass.
10. No code or unlicensed assets from the visual reference site are included.

## Out of Scope

- Real-time online matchmaking, friend links, accounts, chat, community services, or a backend.
- Free-roaming first-person classroom exploration.
- Photorealistic asset production or externally purchased model packs.
- Native Android packaging during the initial web migration; the installable PWA is the mobile delivery target.
- Deleting the Flutter implementation before web parity is accepted.
