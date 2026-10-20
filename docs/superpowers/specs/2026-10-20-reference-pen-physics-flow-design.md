# Reference-Informed Pen Animation and Physics Design

## Goal

Finish the in-progress Rapier integration in `game-web` so a pen can be grabbed, aimed, flicked from any point along its barrel, spun by an off-centre strike, collided with another pen, settled, and knocked off the desk through one coherent simulation. Preserve the existing visual design, game modes, scoring, AI, and host-authoritative online flow.

The result should reproduce the feel and state flow observed in the deployed `penfight.xyz` game without copying its source or assets. Publicly observable behavior and independently recovered physical parameters are used as validation references.

## Reference Evidence

The deployed application inspected on 20 October 2026 served `assets/main-NZF1ugMT.js`, a 4,247,247-byte immutable bundle with ETag `5965f5d515d018cd7cd65beb91fbb78f`. REA recorded the downloaded application as Evidence `ev_269adfe16ec8b10cd55b683a2144f91aef498e212602e2d81a68861b01a433a0`, rooted at SHA-256 `2e2665dfcdd91fbd63667d782fb46b6af89a8858231b3ebde5502a4d829371ed`.

Static inspection of that shipped bundle established these exact observations:

- Rapier rigid bodies and colliders are present, including its embedded WebAssembly module.
- Simulation configuration uses a 1/120-second fixed step with at most six catch-up steps.
- The baseline pen is 0.145 metres long with a 0.0052-metre radius, density 1120, friction 0.30, restitution 0.38, linear damping 0.06, and angular damping 0.8.
- Pen bodies enable continuous collision detection and normally use capsule colliders; shaped pens can use convex hulls and additional weighted colliders.
- Pull power uses a 12-pixel dead zone, a viewport-relative maximum pull, and a power exponent of 1.45.
- A flick applies an impulse at a point along the pen rather than directly assigning a velocity. Impulse magnitude adapts to body mass.
- Motion is considered stable only after linear and angular speeds remain below thresholds for a sustained interval, with a timeout safety bound.
- Pens become out when their body drops below a configured vertical threshold.
- The render loop accumulates frame time, advances fixed physics steps, and retains a fractional remainder for rendering.

Runtime observation confirmed a canvas-based mobile interface and the instruction sequence “Touch your pen. Pull back. Release.” The Cloudflare verification overlay prevented an automated live match, so claims about exact feel and timing beyond the shipped code remain inference, not runtime observation. The REA semantic pass also timed out after five minutes on the large minified bundle; its retained evidence is partial and is not treated as proof of complete application behavior.

## Chosen Approach

Complete the existing Rapier adapter rather than replacing the current work or permanently maintaining two physics engines. Once Rapier is ready, it is the only authority for pen position, orientation, velocity, collision, and sleep state. The old kinematic calculations remain only as a temporary initialization fallback and are never allowed to update a body in the same frame as Rapier.

This approach fits the existing code, preserves the current modes and protocol, and avoids importing the reference game's much broader trajectory-packet and pen-variant systems.

## Component Responsibilities

### Physics adapter

`src/game/desk-physics.ts` owns the Rapier world, desk and floor colliders, pen bodies, fixed-step accumulator, collision event queue, previous/current poses, motion measurements, and body lifecycle.

Its public interface should remain game-oriented:

- synchronize or reset active pens from scene transforms;
- apply a normalized shot to a selected pen;
- step by elapsed time and return semantic impact events;
- interpolate simulated poses onto render objects;
- report whether active bodies are settled or outside the play surface;
- disable or sleep bodies during round transitions.

Rapier-specific objects must not escape this adapter.

### Input and rendering

`src/rendering/game-renderer.ts` owns pointer capture, raycasting, drag measurement, touch-edge charging, haptic feedback, keyboard input, camera framing, and drawing. Input is converted into a normalized shot description and forwarded to the scene. The renderer does not move a pen as a substitute for simulation.

Power uses a dead zone followed by a nonlinear curve, keeping short drags controllable while preserving a decisive full-strength shot. The selected point along the pen maps to a signed strike value: the centre produces little spin, while either end produces angular motion of the appropriate sign.

### Scene and game flow

`src/scene/classroom.ts` owns visual pen objects, aiming guides, effects, AI decisions, and coordination with `SoloTurnController`. It starts the physics adapter asynchronously, synchronizes bodies at round setup, passes shots into it, applies interpolated poses each frame, and converts physics events into sound, particles, camera trauma, and game-state transitions.

The scene must not perform legacy capsule collision response while Rapier is active. Visual fall presentation may temporarily take over a body only after the physics layer has declared that pen out.

### Turn controller

`src/game/solo-turn-controller.ts` remains the authority for whose turn it is and which high-level phase is active. A released shot moves the phase from ready to moving. The next turn begins only after all surviving pens remain below the settle thresholds for the settle duration, or after the safety timeout. A knockout interrupts ordinary turn advancement and enters the existing falling/result flow.

### Multiplayer boundary

The existing host-authoritative model remains unchanged. Input intents include normalized direction, power, and strike position. The host simulates the shot and publishes arena snapshots; the guest predicts input locally and reconciles to host snapshots. This design does not introduce deterministic lockstep or the reference game's pre-simulated trajectory packets.

## State and Data Flow

1. At round setup, scene transforms are copied into Rapier bodies with zero velocity.
2. Pointer down must select the active pen. The ray intersection supplies the strike position along its barrel.
3. Pointer movement produces direction and nonlinear power, updates the aiming guide, and sends throttled online aim intents when applicable.
4. Pointer release creates one shot. The adapter applies an impulse at the selected world-space strike point and wakes the body.
5. Each animation frame contributes elapsed time to the accumulator. Rapier advances in 1/120-second increments, capped at six substeps; excess backlog is discarded to avoid a spiral of death.
6. Collision-start events produce one semantic hit event with relative speed. The scene uses it for sound, sparks, haptics, and camera shake.
7. Previous and current rigid-body poses are interpolated for smooth Three.js rendering.
8. The scene monitors support/out state and settling. A fallen pen enters the scoring presentation; otherwise the controller advances to the next player after sustained quiet.
9. Round reset re-enables active bodies, restores spawn poses, clears velocities, and returns control to the chosen server.

## Physical Model

Use scene-scaled equivalents of the observed reference parameters rather than mixing real-world metres with the existing classroom scale. Preserve the meaningful ratios and behaviors:

- fixed step: 1/120 second;
- maximum substeps: six;
- pen collider: capsule aligned to the rendered barrel;
- pen friction: 0.30;
- pen restitution: 0.38;
- desk friction: 0.33;
- desk restitution: 0.10;
- linear damping: 0.06;
- angular damping: 0.80;
- strike range: 90% of the half-length;
- mass-adaptive impulse exponent: 0.90;
- CCD enabled for moving pens.

The current scene uses oversized stylized pens, so absolute density and impulse values remain tuned in scene units. Tests should protect resulting behavior instead of asserting that scene-unit mass equals the reference's kilogram mass.

## Failure Handling

- If Rapier fails to load, gameplay remains available through the existing kinematic fallback and reports a non-blocking diagnostic in development.
- A frame delta is capped before entering the accumulator. Reaching the substep limit clears stale backlog.
- Invalid shots—missing active body, near-zero direction, or zero power—are ignored without changing the turn.
- Pointer cancellation restores the pre-aim pose and clears guides.
- Snapshot reconciliation clears incompatible local motion before applying the authoritative pose.
- Round reset always clears linear and angular velocity to prevent motion leaking into the next point.

## Testing and Acceptance

### Unit and integration tests

- power shaping, dead zone, edge charging, and screen-size normalization;
- centre versus tip strike position and resulting angular motion;
- mass-adaptive impulse bounds;
- fixed-step accumulation and maximum-substep behavior;
- collision events and momentum transfer between pens;
- sustained settling versus a one-frame low-speed reading;
- desk support, partial overhang, complete knockout, and double fall;
- reset, sleep, disable, and re-enable behavior;
- online intent serialization of strike position and snapshot reconciliation.

### Browser checks

- desktop mouse and keyboard play;
- portrait touch aiming, screen-edge charging, and haptic-safe behavior;
- solo AI, two-player local, and host/guest online turns;
- rapid repeated input cannot flick twice during one turn;
- a pen visibly spins from a tip strike, collides without tunnelling, falls under gravity, and stops cleanly;
- reduced-motion mode suppresses camera trauma without changing physics.

### Completion criteria

- all unit and integration tests pass;
- TypeScript build and ESLint pass;
- Playwright gameplay checks pass at desktop and phone viewports;
- no frame performs both Rapier and legacy movement/collision integration;
- all supported modes reach scoring and the next round after a physical knockout;
- the existing UI, storage, audio, and networking flows remain compatible.

## Out of Scope

- copying proprietary source or art from the reference site;
- adding every reference pen shape, weighted grip, or surface variant;
- replacing snapshot networking with deterministic lockstep or trajectory packages;
- redesigning menus, progression, authentication, or monetization;
- changing the Flutter application.
