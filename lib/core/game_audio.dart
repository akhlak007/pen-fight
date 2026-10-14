import 'package:audioplayers/audioplayers.dart';

class GameAudio {
  GameAudio({required this.enabled});

  final bool Function() enabled;
  final List<AudioPlayer> _effects = List.generate(3, (_) => AudioPlayer());
  final AudioPlayer _music = AudioPlayer();
  int _nextEffect = 0;

  Future<void> play(String file, {double volume = .75}) async {
    if (!enabled()) return;
    try {
      final player = _effects[_nextEffect++ % _effects.length];
      await player.play(AssetSource('audio/$file'), volume: volume);
    } catch (_) {
      // Audio is optional; browsers may reject playback before interaction.
    }
  }

  Future<void> startMusic() async {
    try {
      await _music.setReleaseMode(ReleaseMode.loop);
      await _music.play(AssetSource('audio/music_loop.ogg'), volume: .22);
    } catch (_) {
      // Music is optional and can be blocked until browser interaction.
    }
  }

  Future<void> stopMusic() => _music.stop();

  Future<void> pauseAll() async {
    await _music.pause();
    for (final player in _effects) {
      await player.pause();
    }
  }

  Future<void> resumeMusic() async {
    try {
      await _music.resume();
    } catch (_) {}
  }

  Future<void> dispose() async {
    await _music.dispose();
    for (final player in _effects) {
      await player.dispose();
    }
  }
}
