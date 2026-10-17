import 'package:flame/game.dart';
import 'package:flutter/material.dart';

import '../../core/paper.dart';
import '../../core/settings_controller.dart';
import '../../core/theme.dart';
import 'match_state.dart';
import 'pen_fight_game.dart';

class MatchScreen extends StatefulWidget {
  const MatchScreen({super.key, required this.mode, required this.settings});

  final GameMode mode;
  final SettingsController settings;

  @override
  State<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends State<MatchScreen> with WidgetsBindingObserver {
  late final PenFightGame _game;
  bool _recordedCurrentWin = false;
  List<int> _lastSavedScore = const [-1, -1];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _game = PenFightGame(
      mode: widget.mode,
      settings: widget.settings,
      initialScore: widget.mode == GameMode.local
          ? widget.settings.localScore
          : null,
    );
    _game.snapshot.addListener(_onSnapshot);
  }

  void _onSnapshot() {
    final state = _game.snapshot.value;
    if (state.phase != MatchPhase.matchOver) {
      _recordedCurrentWin = false;
    }
    if (!_recordedCurrentWin &&
        widget.mode == GameMode.solo &&
        state.phase == MatchPhase.matchOver &&
        state.roundWinner == 0) {
      _recordedCurrentWin = true;
      widget.settings.recordSoloWin();
    }
    if (widget.mode == GameMode.local &&
        !_sameScore(state.score, _lastSavedScore)) {
      _lastSavedScore = List.unmodifiable(state.score);
      if (state.phase == MatchPhase.matchOver) {
        widget.settings.clearLocalMatch();
      } else {
        widget.settings.saveLocalMatch(state.score);
      }
    }
  }

  bool _sameScore(List<int> a, List<int> b) =>
      a.length == b.length &&
      a.asMap().entries.every((entry) => entry.value == b[entry.key]);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _game.onForeground();
    } else {
      _game.onBackground();
    }
    if (state != AppLifecycleState.resumed &&
        _game.snapshot.value.phase != MatchPhase.paused) {
      _game.togglePause();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _game.snapshot.removeListener(_onSnapshot);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    if (media.size.width < media.size.height && media.size.width < 700) {
      return _RotatePrompt(onBack: () => Navigator.pop(context));
    }
    final compact = media.size.width < 840;
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            Assets.classroom,
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
          ),
          const DecoratedBox(
            decoration: BoxDecoration(color: Color(0x18000000)),
          ),
          SafeArea(
            child: Stack(
              children: [
                Center(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      compact ? 78 : 18,
                      8,
                      compact ? 78 : 18,
                      8,
                    ),
                    child: AspectRatio(
                      aspectRatio:
                          PenFightGame.worldWidth / PenFightGame.worldHeight,
                      child: DecoratedBox(
                        decoration: const BoxDecoration(
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x99000000),
                              blurRadius: 24,
                              offset: Offset(0, 14),
                            ),
                          ],
                        ),
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onPanStart: (details) =>
                              _game.aimStart(details.localPosition),
                          onPanUpdate: (details) =>
                              _game.aimUpdate(details.localPosition),
                          onPanEnd: (_) => _game.aimEnd(),
                          onPanCancel: _game.aimEnd,
                          child: GameWidget(game: _game),
                        ),
                      ),
                    ),
                  ),
                ),
                Positioned(
                  left: 10,
                  top: 8,
                  child: _RoundIconButton(
                    icon: Icons.arrow_back_rounded,
                    tooltip: 'Exit match',
                    onPressed: () => _confirmExit(context),
                  ),
                ),
                Positioned(
                  right: 10,
                  top: 8,
                  child: _RoundIconButton(
                    icon: Icons.pause_rounded,
                    tooltip: 'Pause',
                    onPressed: _game.togglePause,
                  ),
                ),
                Positioned(
                  top: 8,
                  left: compact ? 74 : 90,
                  right: compact ? 74 : null,
                  width: compact ? null : 330,
                  child: ValueListenableBuilder<MatchSnapshot>(
                    valueListenable: _game.snapshot,
                    builder: (context, state, _) => _ChalkHud(
                      mode: widget.mode,
                      state: state,
                      playerName: widget.settings.playerName,
                    ),
                  ),
                ),
                Positioned(
                  left: 14,
                  bottom: 12,
                  child: ValueListenableBuilder<MatchSnapshot>(
                    valueListenable: _game.snapshot,
                    builder: (context, state, _) => _TurnCard(
                      state: state,
                      mode: widget.mode,
                      playerName: widget.settings.playerName,
                    ),
                  ),
                ),
                ValueListenableBuilder<MatchSnapshot>(
                  valueListenable: _game.snapshot,
                  builder: (context, state, _) {
                    if (state.phase == MatchPhase.roundOver ||
                        state.phase == MatchPhase.matchOver ||
                        state.phase == MatchPhase.paused) {
                      return _MatchOverlay(
                        state: state,
                        mode: widget.mode,
                        onPrimary: state.phase == MatchPhase.paused
                            ? _game.togglePause
                            : state.phase == MatchPhase.matchOver
                            ? _game.restartMatch
                            : _game.nextRound,
                        onExit: () => Navigator.pop(context),
                      );
                    }
                    return const SizedBox.shrink();
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmExit(BuildContext context) async {
    final exit = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Leave this desk?'),
        content: Text(
          widget.mode == GameMode.local
              ? 'Your local match score will be saved for later.'
              : 'Your current solo match will end.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('KEEP PLAYING'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('LEAVE'),
          ),
        ],
      ),
    );
    if (exit == true && context.mounted) Navigator.pop(context);
  }
}

class _ChalkHud extends StatelessWidget {
  const _ChalkHud({
    required this.mode,
    required this.state,
    required this.playerName,
  });
  final GameMode mode;
  final MatchSnapshot state;
  final String playerName;

  @override
  Widget build(BuildContext context) {
    final second = mode == GameMode.solo ? 'PRIYA' : 'PLAYER 2';
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
      decoration: BoxDecoration(
        color: AppColors.board.withValues(alpha: .94),
        border: Border.all(color: const Color(0xff6f4b27), width: 5),
        boxShadow: const [
          BoxShadow(
            color: Colors.black45,
            blurRadius: 10,
            offset: Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'PEN FIGHT  ·  BEST OF 5',
            style: TextStyle(
              fontFamily: 'GloriaHallelujah',
              fontSize: 12,
              color: Colors.white70,
            ),
          ),
          const SizedBox(height: 4),
          _ScoreLine(
            name: playerName.toUpperCase(),
            value: state.score[0],
            active: state.currentPlayer == 0,
          ),
          _ScoreLine(
            name: second,
            value: state.score[1],
            active: state.currentPlayer == 1,
          ),
        ],
      ),
    );
  }
}

class _ScoreLine extends StatelessWidget {
  const _ScoreLine({
    required this.name,
    required this.value,
    required this.active,
  });
  final String name;
  final int value;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: active ? const Color(0xffffdf5d) : Colors.transparent,
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 7),
        Expanded(
          child: Text(
            name,
            style: TextStyle(
              fontFamily: 'GloriaHallelujah',
              fontSize: 15,
              color: active ? AppColors.chalk : Colors.white54,
            ),
          ),
        ),
        Text(
          '$value',
          style: const TextStyle(
            fontFamily: 'GloriaHallelujah',
            fontSize: 22,
            color: AppColors.chalk,
          ),
        ),
      ],
    );
  }
}

class _TurnCard extends StatelessWidget {
  const _TurnCard({
    required this.state,
    required this.mode,
    required this.playerName,
  });
  final MatchSnapshot state;
  final GameMode mode;
  final String playerName;

  @override
  Widget build(BuildContext context) {
    final name = state.currentPlayer == 0
        ? playerName.toUpperCase()
        : mode == GameMode.solo
        ? 'PRIYA'
        : 'PLAYER 2';
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 230),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.paper.withValues(alpha: .94),
          boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 9)],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$name\'S TURN',
              style: const TextStyle(
                fontFamily: 'Anton',
                color: AppColors.red,
                letterSpacing: .8,
              ),
            ),
            Text(
              state.message,
              maxLines: 2,
              style: const TextStyle(color: AppColors.ink, fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

class _MatchOverlay extends StatelessWidget {
  const _MatchOverlay({
    required this.state,
    required this.mode,
    required this.onPrimary,
    required this.onExit,
  });
  final MatchSnapshot state;
  final GameMode mode;
  final VoidCallback onPrimary;
  final VoidCallback onExit;

  @override
  Widget build(BuildContext context) {
    final paused = state.phase == MatchPhase.paused;
    final finished = state.phase == MatchPhase.matchOver;
    return ColoredBox(
      color: Colors.black54,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: NotebookPaper(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  paused
                      ? Icons.pause_circle_outline
                      : finished
                      ? Icons.emoji_events_outlined
                      : Icons.sports_score,
                  size: 52,
                  color: AppColors.gold,
                ),
                const SizedBox(height: 8),
                Text(
                  paused
                      ? 'MATCH PAUSED'
                      : finished
                      ? 'DESK CHAMPION'
                      : 'ROUND OVER',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineLarge
                      ?.copyWith(color: AppColors.red, fontSize: 34),
                ),
                const SizedBox(height: 5),
                Text(
                  state.message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.ink, fontSize: 20),
                ),
                if (!paused) ...[
                  const SizedBox(height: 7),
                  Text(
                    '${state.score[0]}  —  ${state.score[1]}',
                    style: const TextStyle(
                      fontFamily: 'Anton',
                      fontSize: 28,
                      color: AppColors.ink,
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: InkButton(
                    label: paused
                        ? 'RESUME'
                        : finished
                        ? 'PLAY AGAIN'
                        : 'NEXT ROUND',
                    onPressed: onPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: onExit,
                  child: const Text('BACK TO CLASSROOM'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
  });
  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton.filled(
      tooltip: tooltip,
      onPressed: onPressed,
      style: IconButton.styleFrom(
        backgroundColor: Colors.black54,
        foregroundColor: Colors.white,
      ),
      icon: Icon(icon),
    );
  }
}

class _RotatePrompt extends StatelessWidget {
  const _RotatePrompt({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(Assets.classroomPortraitDim, fit: BoxFit.cover),
          SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: NotebookPaper(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.screen_rotation_rounded,
                        size: 66,
                        color: AppColors.ink,
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'TURN YOUR DESK',
                        style: Theme.of(context).textTheme.headlineLarge
                            ?.copyWith(color: AppColors.red),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Rotate your phone to landscape so the full table and both pens stay visible.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 19, color: AppColors.ink),
                      ),
                      const SizedBox(height: 22),
                      TextButton(
                        onPressed: onBack,
                        child: const Text('BACK TO CLASSROOM'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
