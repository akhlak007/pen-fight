# Responsive Pen Fight Implementation Plan

## Milestone 1: Runnable project foundation

- Scaffold Flutter for Android and web at the repository root.
- Register the supplied fonts, classroom art, desk art, pen sprites, UI assets, and audio.
- Add Flame, audio, and local persistence dependencies.
- Establish the app theme, routes, shared models, and responsive orientation policy.

## Milestone 2: Reference-quality menu

- Build the full-viewport classroom shell and responsive notebook surface.
- Implement desktop navigation, compact mobile controls, campaign card, mode rows, and settings sheet.
- Wire Solo and Local actions into match setup.
- Give Friend and Instant honest coming-soon dialogs.

## Milestone 3: Playable match

- Implement a fixed-coordinate Flame arena with two pen components.
- Add pointer/touch drag-to-aim, trajectory feedback, normalized power, impulses, drag, pen-to-pen collision, desk-edge elimination, and settling.
- Implement match/round state, alternating turns, best-of-five scoring, pause, restart, and results.
- Add a fair solo opponent and shared-device local mode.

## Milestone 4: Feedback and persistence

- Connect existing impact, flick, fall, UI, and result sounds with browser-safe audio start.
- Add particles, contact shadows, current-player highlight, impact feedback, and reduced-motion behavior.
- Persist settings, solo wins, and resumable local score.

## Milestone 5: Verification

- Add unit tests for match scoring, aim power, collision helpers, and save-data fallbacks.
- Add responsive widget smoke tests.
- Run formatter, analyzer, tests, web release build, and Android debug build.
- Inspect rendered desktop and mobile layouts and correct clipping or readability issues.
