import 'package:audioplayers/audioplayers.dart';

class GameAudio {
  GameAudio({required this.enabled});

  final bool Function() enabled;
  final AudioPlayer _effects = AudioPlayer();

  Future<void> play(String file, {double volume = .75}) async {
    if (!enabled()) return;
    try {
      await _effects.stop();
      await _effects.play(AssetSource('audio/$file'), volume: volume);
    } catch (_) {
      // Audio is optional; browsers may reject playback before interaction.
    }
  }

  Future<void> dispose() => _effects.dispose();
}
