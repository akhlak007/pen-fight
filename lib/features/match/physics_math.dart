import 'dart:math' as math;

import 'package:flame/game.dart';

const penHalfLength = 185.0;
const penHalfWidth = 24.0;

class CapsulePose {
  const CapsulePose(this.center, this.angle);

  final Vector2 center;
  final double angle;

  Vector2 get forward => Vector2(math.cos(angle), math.sin(angle));
  Vector2 get side => Vector2(-math.sin(angle), math.cos(angle));
}

class PenContact {
  const PenContact(this.normal, this.penetration);

  final Vector2 normal;
  final double penetration;
}

/// Separating-axis collision for the visible oriented pen rectangles.
PenContact? penContact(CapsulePose a, CapsulePose b) {
  final delta = b.center - a.center;
  final axes = <Vector2>[a.forward, a.side, b.forward, b.side];
  Vector2? bestAxis;
  var bestOverlap = double.infinity;
  for (final axis in axes) {
    final aRadius = _projectedRadius(a, axis);
    final bRadius = _projectedRadius(b, axis);
    final distance = delta.dot(axis).abs();
    final overlap = aRadius + bRadius - distance;
    if (overlap <= 0) return null;
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestAxis = axis.clone();
      if (delta.dot(bestAxis) < 0) bestAxis.negate();
    }
  }
  return PenContact(bestAxis!, bestOverlap);
}

double _projectedRadius(CapsulePose pen, Vector2 axis) {
  return pen.forward.dot(axis).abs() * penHalfLength +
      pen.side.dot(axis).abs() * penHalfWidth;
}

/// A pen is unsupported once most of its collision body has crossed an edge.
bool penHasFallen(
  CapsulePose pen, {
  double left = 48,
  double top = 48,
  double right = 852,
  double bottom = 1552,
}) {
  var supported = 0;
  for (var i = -3; i <= 3; i++) {
    final sample = pen.center + pen.forward * (penHalfLength * i / 3);
    if (sample.x >= left &&
        sample.x <= right &&
        sample.y >= top &&
        sample.y <= bottom) {
      supported++;
    }
  }
  return supported < 4;
}

Vector2 clampAim(Vector2 pull, {double maximum = 270}) {
  if (pull.length <= maximum) return pull;
  return pull.normalized() * maximum;
}

enum ExitDecision { pending, draw, playerZeroWins, playerOneWins }

ExitDecision resolveExitTimes(
  List<double?> times,
  double now, {
  double tolerance = .10,
  double decisionDelay = .12,
}) {
  final exits = times.whereType<double>().toList(growable: false);
  if (exits.isEmpty) return ExitDecision.pending;
  final first = exits.reduce(math.min);
  if (now - first < decisionDelay) return ExitDecision.pending;
  if (times[0] != null &&
      times[1] != null &&
      (times[0]! - times[1]!).abs() <= tolerance) {
    return ExitDecision.draw;
  }
  final loser = times[0] != null && (times[1] == null || times[0]! < times[1]!)
      ? 0
      : 1;
  return loser == 0 ? ExitDecision.playerOneWins : ExitDecision.playerZeroWins;
}
