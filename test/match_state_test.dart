import 'package:flutter_test/flutter_test.dart';
import 'package:pen_fight/features/match/match_state.dart';

void main() {
  group('MatchScorer', () {
    test('wins a best-of-five match at three rounds', () {
      final scorer = MatchScorer();

      expect(scorer.award(0), isFalse);
      expect(scorer.award(0), isFalse);
      expect(scorer.award(0), isTrue);
      expect(scorer.score, [3, 0]);
    });

    test('tracks both players and resets cleanly', () {
      final scorer = MatchScorer();
      scorer.award(0);
      scorer.award(1);
      scorer.reset();

      expect(scorer.score, [0, 0]);
    });
  });

  test('match snapshot reports completion', () {
    const snapshot = MatchSnapshot(
      phase: MatchPhase.matchOver,
      currentPlayer: 1,
      score: [1, 3],
      roundWinner: 1,
    );

    expect(snapshot.matchFinished, isTrue);
  });
}
