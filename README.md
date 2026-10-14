# Pen Fight

A responsive pen-flick classroom game built with Flutter and Flame. It runs in modern desktop/mobile browsers and on Android from one codebase.

## Play

1. Choose **Solo** to face Priya or **Local** for two players on one device.
2. Press the highlighted pen.
3. Drag backward to set direction and power.
4. Release to flick. Knock the rival pen far enough over the desk edge to take the round.
5. First to three rounds wins the match.

Phone gameplay uses landscape orientation. Menus remain responsive in portrait.

## Run

```sh
flutter pub get
flutter run -d chrome
```

For Android, connect a device or start an emulator and run:

```sh
flutter run -d android
```

## Verify and build

```sh
flutter analyze
flutter test
flutter build web --release
flutter build apk --debug
```

Build outputs:

- Web: `build/web/`
- Android debug APK: `build/app/outputs/flutter-apk/app-debug.apk`

Solo and local matches are implemented. Friend, Instant, Community, accounts, and real online matchmaking are intentionally marked as coming soon.
