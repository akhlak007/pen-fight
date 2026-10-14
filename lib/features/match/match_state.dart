enum GameMode { solo, local }

enum MatchPhase { ready, aiming, moving, roundOver, matchOver, paused }

class MatchSnapshot {
  const MatchSnapshot({
    required this.phase,
    required this.currentPlayer,
    required this.score,
    this.roundWinner,
    this.message = 'Drag your pen back and release',
  });

  final MatchPhase phase;
  final int currentPlayer;
  final List<int> score;
  final int? roundWinner;
  final String message;

  bool get matchFinished => score.any((value) => value >= 3);

  MatchSnapshot copyWith({
    MatchPhase? phase,
    int? currentPlayer,
    List<int>? score,
    int? roundWinner,
    bool clearRoundWinner = false,
    String? message,
  }) {
    return MatchSnapshot(
      phase: phase ?? this.phase,
      currentPlayer: currentPlayer ?? this.currentPlayer,
      score: List.unmodifiable(score ?? this.score),
      roundWinner: clearRoundWinner ? null : roundWinner ?? this.roundWinner,
      message: message ?? this.message,
    );
  }
}

class MatchScorer {
  MatchScorer({this.target = 3, List<int>? initialScore}) {
    if (initialScore != null && initialScore.length == 2) {
      score[0] = initialScore[0].clamp(0, target - 1);
      score[1] = initialScore[1].clamp(0, target - 1);
    }
  }

  final int target;
  final List<int> score = [0, 0];

  bool award(int player) {
    score[player] += 1;
    return score[player] >= target;
  }

  void reset() {
    score[0] = 0;
    score[1] = 0;
  }
}
