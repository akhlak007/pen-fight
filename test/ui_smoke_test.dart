import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pen_fight/core/settings_controller.dart';
import 'package:pen_fight/core/theme.dart';
import 'package:pen_fight/features/home/home_screen.dart';

void main() {
  testWidgets('home opens a playable solo match', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1440, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      MaterialApp(
        theme: buildAppTheme(),
        home: HomeScreen(settings: SettingsController()),
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
}
