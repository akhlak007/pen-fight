# Responsive Pen Fight Game Design

## Goal

Turn the existing Desk Flick asset and Flutter UI kit into a runnable, polished pen-flick game for web and Android. The finished experience should closely match the supplied classroom reference: a warm, stylized schoolroom surrounds a central desk arena, while navigation appears on tactile notebook paper. Gameplay must work equally well with a mouse or touch.

The first release is a self-contained vertical slice. Solo and same-device local play are functional. Online-facing Friend and Instant choices remain visible for visual parity, but are clearly labelled as coming soon and do not simulate connectivity.

## Product Direction

The game uses a 2.5D presentation rather than real-time 3D. Pre-rendered perspective classroom art provides the depth and atmosphere; a deterministic top-down physics arena provides readable, responsive play. Dynamic pen sprites, shadows, particles, impact feedback, and subtle camera motion make the desk feel physical without the performance and asset cost of a full 3D pipeline.

Landscape is the preferred gameplay orientation on phones and the primary desktop layout. Menu screens remain usable in portrait. On a portrait phone, starting a match presents a friendly rotate-device prompt rather than compressing the arena into an unreadable view.

## Technology

- Flutter is the application shell and UI framework.
- Flame provides the update/render loop, component lifecycle, input routing, and effects.
- Forge2D integration provides rigid-body pen movement and collisions if it compiles cleanly against the current Flutter/Flame versions. A small Flame-native impulse/collision implementation is the fallback and preserves the same game-facing interface.
- Shared Preferences stores local settings, campaign progress, and resumable local scores.
- Flame Audio handles sound effects and looping music.

The build targets Chrome-compatible browsers and Android from one project. The app must not require a server for the playable modes in this release.

## Application Structure

The project will be scaffolded as a normal Flutter application around the existing assets. Source responsibilities are separated as follows:

- `app/`: application root, routing, responsive shell, orientation behavior.
- `core/`: theme, asset paths, audio service, persistence service, and reusable models.
- `features/home/`: classroom landing screen and notebook menu.
- `features/match/`: Flame game, physics adapter, match state machine, HUD, pause and result overlays.
- `features/local/`: local match setup and saved-game continuation.
- `shared/`: paper panels, buttons, navigation pills, and other reusable presentation widgets.

Game simulation owns pen position, velocity, collisions, turn state, and round resolution. Flutter overlays own navigation, score presentation, dialogs, accessibility, and lifecycle controls. Communication between them uses immutable match snapshots and explicit commands, avoiding widget code that reaches into physics components.

## Screens and Visual Design

### Home

The home screen fills the viewport with the supplied classroom scene. A warm dim layer separates the UI from the background. Desktop and tablet layouts show a centered open-notebook panel with a subtle spine, ruled paper, imperfect rotation, and ink-blue typography. Phone portrait uses a single-page scroll layout while retaining the paper texture and margin line.

The main panel contains:

- Pen Fight wordmark and player identity.
- Solo journey card with progress and a prominent start/continue action.
- Local match action with saved-score status.
- Friend and Instant rows marked `COMING SOON`.
- Settings for music, effects, haptics, and reduced motion.

The classroom remains visible around the panel to preserve the reference composition. Desktop navigation pills appear in the upper-right. Smaller devices collapse them into a menu button.

### Match

The supplied classroom background frames the active desk. The desk is the only collision arena. Pens are drawn with directional sprites, soft contact shadows, a glow or outline on the current player, and short impact particles. A chalkboard HUD shows player names, round score, current turn, and best-of-five status.

During aiming, dragging backward from the active pen displays a dotted ink trajectory and power meter. Releasing applies the opposite impulse. The camera gives a small, reduced-motion-aware bump on strong impacts. UI stays outside the important play area.

### Results and Pause

Pause and results use taped paper cards over a dimmed match. Results show the round winner, updated match score, replay/next-round action, and an exit-to-classroom action. The final match result celebrates with brief confetti and unlock/progress feedback without blocking input for a long animation.

## Gameplay Rules

1. Two pens begin at fixed, mirrored positions on the desk.
2. Only the current player's pen accepts an aim gesture.
3. The player presses the pen, drags backward to choose direction and power, and releases to flick.
4. Input power is clamped to prevent impossible shots and is normalized across screen sizes.
5. The turn ends after all bodies remain below a velocity threshold for a short settling period.
6. A pen loses the round when its center and collision body leave the playable desk boundary.
7. If both pens leave during the same shot, the pen that left first loses. Near-simultaneous exits inside a small tolerance replay the round.
8. The first player to three round wins takes the best-of-five match.
9. Pause, app backgrounding, and browser visibility loss freeze simulation and audio safely.

Solo mode uses a simple opponent controller. It evaluates several legal impulse directions, favors contact that pushes the player toward the nearest edge, adds difficulty-scaled aim error, and waits briefly before firing. It does not read future physics states or use impossible power.

Local mode alternates control on the same device. The UI makes the active player unmistakable through color, chalkboard text, and pen highlighting.

## Responsive Input and Layout

Pointer and touch events map to the same world-space aiming controller. Gesture recognition begins only when the active pen is selected, preventing accidental shots while interacting with HUD controls. Mouse users receive hover feedback; touch users get a larger invisible hit target and optional haptic ticks at power thresholds.

The game world uses a fixed logical coordinate system and letterboxes safely when necessary. Decorative classroom cropping may change with aspect ratio, but the full desk boundary and both starting positions must remain visible. Desktop supports common 16:9 and wider windows. Android gameplay supports common phone and tablet landscape ratios.

## State and Persistence

Persisted data is versioned and includes:

- Music, effects, haptics, and reduced-motion settings.
- Solo wins and current opponent/progression marker.
- A resumable local match score and player names.
- Last selected mode.

Corrupt or outdated data falls back to defaults without blocking startup. A reset-progress action requires confirmation.

## Audio and Feedback

The existing original audio pack supplies UI clicks, flicks, impacts, falls, turn changes, round outcomes, and music. Impact sound selection is based on collision strength with a short cooldown to avoid audio spam. Browser audio starts only after user interaction. Android lifecycle events pause and resume audio appropriately.

Visual feedback includes dust/spark particles, current-player glow, aim dots, power fill, score chalk animation, and restrained confetti. Reduced-motion mode disables camera bumps and minimizes large transitions while retaining essential state cues.

## Error Handling

- Missing optional saved data uses safe defaults.
- Audio initialization failure leaves the game fully playable and disables only sound.
- Asset-loading failures surface a readable error screen in debug builds instead of a blank view.
- Unsupported portrait gameplay shows the rotate prompt with a route back to the menu.
- Coming-soon network modes show an explanatory paper dialog and never enter a loading state.

## Verification

Automated checks cover:

- Match state transitions, score progression, best-of-five completion, double exits, and turn settling.
- Power clamping and screen-to-world aim conversion.
- Persistence defaults, migrations, and corrupt-data fallback.
- Responsive widget layouts at representative phone portrait, phone landscape, tablet, and desktop sizes.

Manual verification covers:

- Mouse and touch aiming feel.
- Web audio unlock behavior and Android pause/resume behavior.
- No desk-edge or HUD clipping at supported aspect ratios.
- Visual comparison against the supplied reference for classroom framing, notebook hierarchy, typography, and warm color grading.

Before delivery, run Flutter formatting, static analysis, unit/widget tests, a web release build, and an Android debug build when the installed SDK permits it.

## Out of Scope for This Release

- Real-time online matchmaking, friend links, accounts, chat, or backend services.
- True 3D models, free camera movement, or networked physics.
- More than one solo opponent AI profile.
- Store publishing and production signing.

The architecture leaves explicit seams for online modes and expanded solo progression without pretending those systems exist in the first playable build.
