import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pen_fight/core/settings_controller.dart';
import 'package:pen_fight/core/theme.dart';
import 'package:pen_fight/app.dart';
import 'package:pen_fight/features/home/home_screen.dart';
import 'package:pen_fight/features/match/match_screen.dart';
import 'package:pen_fight/features/match/match_state.dart';

void main() {
  testWidgets('home opens a playable solo match', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1440, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final settings = SettingsController()..playerName = 'Akhlaq';
    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: HomeScreen(settings: settings),
      ),
    );
    await tester.pump(const Duration(seconds: 1));

    expect(find.text('START SOLO'), findsOneWidget);
    await tester.tap(find.text('START SOLO'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));

    expect(find.text('PEN FIGHT  ·  BEST OF 5'), findsOneWidget);
    expect(find.textContaining('TURN'), findsOneWidget);
  });

  testWidgets('launch shows splash before home', (tester) async {
    await tester.binding.setSurfaceSize(const Size(900, 600));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final settings = SettingsController()..playerName = 'Riya';

    await tester.pumpWidget(PenFightApp(settings: settings));
    expect(find.text('FINDING YOUR SEAT.'), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 2300));
    expect(find.text('RIYA'), findsOneWidget);
  });

  testWidgets('first-time player can set and later edit their name', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(900, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final settings = SettingsController();

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: HomeScreen(settings: settings),
      ),
    );
    await tester.pump();
    expect(find.text('CLAIM YOUR SEAT'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('player-name-field')), 'Riya');
    await tester.tap(find.text('TAKE MY SEAT'));
    await tester.pumpAndSettle();
    expect(find.text('RIYA'), findsOneWidget);

    await tester.tap(find.byKey(const Key('edit-player-name')));
    await tester.pumpAndSettle();
    expect(find.text('CHANGE YOUR NAME'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('player-name-field')), 'Dev');
    await tester.tap(find.text('SAVE NAME'));
    await tester.pumpAndSettle();
    expect(settings.playerName, 'Dev');
    expect(find.text('DEV'), findsOneWidget);
  });

  testWidgets('maximum-length player name fits a narrow phone', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(() {
      tester.view.resetDevicePixelRatio();
      tester.view.resetPhysicalSize();
    });
    final settings = SettingsController()..playerName = 'WWWWWWWWWWWWWWWWWW';

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: HomeScreen(settings: settings),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.byKey(const Key('edit-player-name')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('portrait phone asks for landscape without clipping', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(() {
      tester.view.resetDevicePixelRatio();
      tester.view.resetPhysicalSize();
    });

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: MatchScreen(mode: GameMode.local, settings: SettingsController()),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('TURN YOUR DESK'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
