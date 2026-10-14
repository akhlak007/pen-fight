import 'dart:math' as math;

import 'package:flame/game.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pen_fight/features/match/physics_math.dart';

void main() {
  test('oriented pen bodies collide where their visible rectangles cross', () {
    final horizontal = CapsulePose(Vector2(450, 800), 0);
    final vertical = CapsulePose(Vector2(450, 800), math.pi / 2);
    final separated = CapsulePose(Vector2(450, 1200), math.pi / 2);

    expect(penContact(horizontal, vertical), isNotNull);
    expect(penContact(horizontal, separated), isNull);
  });

  test('pen support uses its full oriented body', () {
    expect(penHasFallen(CapsulePose(Vector2(450, 800), 0)), isFalse);
    expect(penHasFallen(CapsulePose(Vector2(900, 800), 0)), isTrue);
  });

  test('aim power is clamped without changing direction', () {
    final result = clampAim(Vector2(600, 0));
    expect(result.length, closeTo(270, .001));
    expect(result.y, 0);
  });

  test('exit decisions allow near-simultaneous replay', () {
    expect(resolveExitTimes([1.0, null], 1.05), ExitDecision.pending);
    expect(resolveExitTimes([1.0, 1.07], 1.2), ExitDecision.draw);
    expect(resolveExitTimes([1.0, null], 1.2), ExitDecision.playerOneWins);
  });
}
