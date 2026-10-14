import 'dart:math' as math;
import 'dart:ui';

import 'package:flame/components.dart' show Anchor;
import 'package:flame/game.dart';
import 'package:flame/sprite.dart';
import 'package:flutter/foundation.dart';

import '../../core/game_audio.dart';
import '../../core/settings_controller.dart';
import 'match_state.dart';

class PenFightGame extends FlameGame {
  PenFightGame({required this.mode, required this.settings})
    : audio = GameAudio(enabled: () => settings.sound);

  static const worldWidth = 900.0;
  static const worldHeight = 1600.0;
  static const _edge = 48.0;

  final GameMode mode;
  final SettingsController settings;
  final GameAudio audio;
  final snapshot = ValueNotifier<MatchSnapshot>(
    const MatchSnapshot(
      phase: MatchPhase.ready,
      currentPlayer: 0,
      score: [0, 0],
    ),
  );

  final MatchScorer scorer = MatchScorer();
  final math.Random _random = math.Random();
  final List<_Spark> _sparks = [];
  late final List<_PenBody> _pens;
  late Sprite _desk;
  late Sprite _bluePen;
  late Sprite _redPen;
  Vector2? _aimPoint;
  Vector2? _aimPull;
  double _settleTime = 0;
  double _aiDelay = 0;
  bool _roundResolved = false;
  bool _wasPaused = false;

  @override
  Color backgroundColor() => const Color(0x00000000);

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    _desk = await Sprite.load('desk/desk.png');
    _bluePen = await Sprite.load('pens/pen_starter_blue.png');
    _redPen = await Sprite.load('pens/pen_monitor_red.png');
    _pens = [
      _PenBody(position: Vector2(450, 1160), angle: 0),
      _PenBody(position: Vector2(450, 440), angle: math.pi),
    ];
  }

  Vector2 _world(Offset local) {
    if (size.x == 0 || size.y == 0) return Vector2.zero();
    return Vector2(
      local.dx * worldWidth / size.x,
      local.dy * worldHeight / size.y,
    );
  }

  void aimStart(Offset local) {
    final state = snapshot.value;
    if (state.phase != MatchPhase.ready ||
        (mode == GameMode.solo && state.currentPlayer == 1)) {
      return;
    }
    final point = _world(local);
    final active = _pens[state.currentPlayer];
    if (point.distanceTo(active.position) > 145) return;
    _aimPoint = point;
    _aimPull = Vector2.zero();
    _emit(
      state.copyWith(
        phase: MatchPhase.aiming,
        message: 'Pull back · release to flick',
      ),
    );
  }

  void aimUpdate(Offset local) {
    if (snapshot.value.phase != MatchPhase.aiming || _aimPoint == null) return;
    final pull = _aimPoint! - _world(local);
    if (pull.length > 270) pull.scaleTo(270);
    _aimPull = pull;
  }

  void aimEnd() {
    if (snapshot.value.phase != MatchPhase.aiming) return;
    final pull = _aimPull ?? Vector2.zero();
    _aimPoint = null;
    _aimPull = null;
    if (pull.length < 22) {
      _emit(
        snapshot.value.copyWith(
          phase: MatchPhase.ready,
          message: 'Try a longer pull',
        ),
      );
      return;
    }
    _shoot(
      snapshot.value.currentPlayer,
      pull.normalized() * (pull.length * 5.2),
    );
  }

  void _shoot(int player, Vector2 velocity) {
    final pen = _pens[player];
    pen.velocity.setFrom(velocity);
    pen.angle = math.atan2(velocity.y, velocity.x);
    _settleTime = 0;
    _roundResolved = false;
    _emit(
      snapshot.value.copyWith(
        phase: MatchPhase.moving,
        message: 'Pens in motion',
      ),
    );
    audio.play(velocity.length > 1050 ? 'flick_hard.wav' : 'flick.wav');
  }

  @override
  void update(double dt) {
    super.update(dt);
    if (!isLoaded ||
        snapshot.value.phase == MatchPhase.paused ||
        snapshot.value.phase == MatchPhase.roundOver ||
        snapshot.value.phase == MatchPhase.matchOver) {
      return;
    }
    final safeDt = dt.clamp(0, 1 / 30).toDouble();
    _updateSparks(safeDt);

    if (snapshot.value.phase == MatchPhase.moving) {
      for (final pen in _pens) {
        pen.position.add(pen.velocity * safeDt);
        final speed = pen.velocity.length;
        if (speed > 5) {
          final targetAngle = math.atan2(pen.velocity.y, pen.velocity.x);
          pen.angle +=
              _angleDelta(pen.angle, targetAngle) * math.min(1, safeDt * 4);
        }
        pen.velocity.scale(math.exp(-1.85 * safeDt));
        if (pen.velocity.length < 13) pen.velocity.setZero();
      }
      _resolveCollision();
      _checkEdges();
      if (_roundResolved) return;

      if (_pens.every((pen) => pen.velocity.isZero())) {
        _settleTime += safeDt;
        if (_settleTime > .5) _finishTurn();
      } else {
        _settleTime = 0;
      }
    } else if (mode == GameMode.solo &&
        snapshot.value.currentPlayer == 1 &&
        snapshot.value.phase == MatchPhase.ready) {
      _aiDelay += safeDt;
      if (_aiDelay > .85) {
        _aiDelay = 0;
        _takeAiShot();
      }
    }
  }

  double _angleDelta(double from, double to) =>
      (to - from + math.pi) % (math.pi * 2) - math.pi;

  void _resolveCollision() {
    final a = _pens[0];
    final b = _pens[1];
    final delta = b.position - a.position;
    final distance = delta.length;
    const radius = 92.0;
    if (distance <= 0 || distance >= radius * 2) return;
    final normal = delta / distance;
    final relative = (a.velocity - b.velocity).dot(normal);
    final overlap = radius * 2 - distance;
    a.position.sub(normal * (overlap / 2));
    b.position.add(normal * (overlap / 2));
    if (relative <= 0) return;
    final impulse = normal * (relative * .91);
    a.velocity.sub(impulse);
    b.velocity.add(impulse);
    final hitPoint = (a.position + b.position) / 2;
    for (var i = 0; i < 7; i++) {
      _sparks.add(
        _Spark(
          hitPoint.clone(),
          Vector2.random(_random) * 110 - Vector2.all(55),
        ),
      );
    }
    audio.play(
      relative > 580 ? 'pen_hit_hard.wav' : 'pen_hit.wav',
      volume: .65,
    );
  }

  void _checkEdges() {
    final out = <int>[];
    for (var i = 0; i < _pens.length; i++) {
      final p = _pens[i].position;
      if (p.x < _edge ||
          p.x > worldWidth - _edge ||
          p.y < _edge ||
          p.y > worldHeight - _edge) {
        out.add(i);
      }
    }
    if (out.isEmpty) return;
    if (out.length == 2) {
      _roundResolved = true;
      audio.play('pen_fall.wav');
      _emit(
        snapshot.value.copyWith(
          phase: MatchPhase.roundOver,
          clearRoundWinner: true,
          message: 'Double fall · replay the round',
        ),
      );
      return;
    }
    _resolveRound(1 - out.single);
  }

  void _resolveRound(int winner) {
    _roundResolved = true;
    final finished = scorer.award(winner);
    audio.play(
      winner == 0
          ? (finished ? 'match_win.wav' : 'round_win.wav')
          : (finished ? 'match_lose.wav' : 'round_lose.wav'),
    );
    _emit(
      MatchSnapshot(
        phase: finished ? MatchPhase.matchOver : MatchPhase.roundOver,
        currentPlayer: winner,
        score: List.unmodifiable(scorer.score),
        roundWinner: winner,
        message: finished
            ? '${_name(winner)} owns the desk!'
            : '${_name(winner)} takes the round',
      ),
    );
  }

  void _finishTurn() {
    final next = 1 - snapshot.value.currentPlayer;
    _emit(
      snapshot.value.copyWith(
        phase: MatchPhase.ready,
        currentPlayer: next,
        message: '${_name(next)} · drag back to aim',
      ),
    );
  }

  void _takeAiShot() {
    final ai = _pens[1];
    final target = _pens[0].position;
    final direction = target - ai.position;
    final error = (_random.nextDouble() - .5) * .28;
    direction.rotate(error);
    final power = 880 + _random.nextDouble() * 260;
    _shoot(1, direction.normalized() * power);
  }

  String _name(int player) => player == 0
      ? 'Akhlaq'
      : mode == GameMode.solo
      ? 'Priya'
      : 'Player 2';

  void nextRound() {
    _resetPens();
    final next = snapshot.value.roundWinner == null
        ? 0
        : 1 - snapshot.value.roundWinner!;
    _emit(
      MatchSnapshot(
        phase: MatchPhase.ready,
        currentPlayer: next,
        score: List.unmodifiable(scorer.score),
        message: '${_name(next)} starts',
      ),
    );
  }

  void restartMatch() {
    scorer.reset();
    _resetPens();
    _emit(
      const MatchSnapshot(
        phase: MatchPhase.ready,
        currentPlayer: 0,
        score: [0, 0],
      ),
    );
  }

  void _resetPens() {
    _pens[0]
      ..position.setValues(450, 1160)
      ..velocity.setZero()
      ..angle = 0;
    _pens[1]
      ..position.setValues(450, 440)
      ..velocity.setZero()
      ..angle = math.pi;
    _sparks.clear();
    _roundResolved = false;
    _settleTime = 0;
    _aiDelay = 0;
  }

  void togglePause() {
    final state = snapshot.value;
    if (state.phase == MatchPhase.paused) {
      _emit(
        state.copyWith(
          phase: _wasPaused ? MatchPhase.moving : MatchPhase.ready,
          message: 'Back to the desk',
        ),
      );
    } else if (state.phase == MatchPhase.ready ||
        state.phase == MatchPhase.moving ||
        state.phase == MatchPhase.aiming) {
      _wasPaused = state.phase == MatchPhase.moving;
      _emit(state.copyWith(phase: MatchPhase.paused, message: 'Match paused'));
    }
  }

  void _emit(MatchSnapshot value) => snapshot.value = value;

  void _updateSparks(double dt) {
    for (final spark in _sparks) {
      spark.position.add(spark.velocity * dt);
      spark.life -= dt;
    }
    _sparks.removeWhere((spark) => spark.life <= 0);
  }

  @override
  void render(Canvas canvas) {
    super.render(canvas);
    if (!isLoaded) return;
    canvas.save();
    canvas.scale(size.x / worldWidth, size.y / worldHeight);
    _desk.render(canvas, size: Vector2(worldWidth, worldHeight));

    final vignette = Paint()
      ..shader = Gradient.radial(
        const Offset(worldWidth / 2, worldHeight / 2),
        worldHeight * .65,
        const [Color(0x00000000), Color(0x33000000)],
        const [.55, 1],
      );
    canvas.drawRect(
      const Rect.fromLTWH(0, 0, worldWidth, worldHeight),
      vignette,
    );

    if (_aimPull != null && _aimPull!.length > 2) {
      _renderAim(
        canvas,
        _pens[snapshot.value.currentPlayer].position,
        _aimPull!,
      );
    }
    for (var i = 0; i < _pens.length; i++) {
      _renderPen(
        canvas,
        _pens[i],
        i == snapshot.value.currentPlayer,
        i == 0 ? _bluePen : _redPen,
      );
    }
    for (final spark in _sparks) {
      canvas.drawCircle(
        Offset(spark.position.x, spark.position.y),
        6 * spark.life / .45,
        Paint()..color = const Color(0xffffd158),
      );
    }
    canvas.restore();
  }

  void _renderPen(Canvas canvas, _PenBody body, bool active, Sprite sprite) {
    canvas.save();
    canvas.translate(body.position.x, body.position.y);
    canvas.rotate(body.angle);
    canvas.drawOval(
      Rect.fromCenter(center: const Offset(8, 13), width: 370, height: 42),
      Paint()
        ..color = const Color(0x55000000)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7),
    );
    if (active && snapshot.value.phase == MatchPhase.ready) {
      canvas.drawOval(
        Rect.fromCenter(center: Offset.zero, width: 390, height: 75),
        Paint()
          ..color = const Color(0x332d71ff)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 13),
      );
    }
    sprite.render(
      canvas,
      position: Vector2.zero(),
      size: Vector2(370, 46),
      anchor: Anchor.center,
    );
    canvas.restore();
  }

  void _renderAim(Canvas canvas, Vector2 origin, Vector2 pull) {
    final direction = pull.normalized();
    final power = pull.length / 270;
    final paint = Paint()
      ..color = Color.lerp(
        const Color(0xff2a5ab5),
        const Color(0xffd03a2c),
        power,
      )!;
    for (var i = 1; i <= 6; i++) {
      final point = origin + direction * (70 + i * 48);
      canvas.drawCircle(Offset(point.x, point.y), 7 - i * .55, paint);
    }
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(64, worldHeight - 74, 772 * power, 18),
        const Radius.circular(9),
      ),
      paint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(64, worldHeight - 74, 772, 18),
        const Radius.circular(9),
      ),
      Paint()
        ..color = const Color(0x22000000)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  void onRemove() {
    snapshot.dispose();
    audio.dispose();
    super.onRemove();
  }
}

class _PenBody {
  _PenBody({required this.position, required this.angle});
  final Vector2 position;
  final Vector2 velocity = Vector2.zero();
  double angle;
}

class _Spark {
  _Spark(this.position, this.velocity);
  final Vector2 position;
  final Vector2 velocity;
  double life = .45;
}
