import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsController extends ChangeNotifier {
  static const _dataVersion = 1;
  static const _versionKey = 'save.version';
  static const _musicKey = 'settings.music';
  static const _soundKey = 'settings.sound';
  static const _hapticsKey = 'settings.haptics';
  static const _motionKey = 'settings.reducedMotion';
  static const _winsKey = 'progress.soloWins';
  static const _localScoreKey = 'match.localScore';
  static const _localNamesKey = 'match.localNames';
  static const _lastModeKey = 'navigation.lastMode';

  bool music = true;
  bool sound = true;
  bool haptics = true;
  bool reducedMotion = false;
  int soloWins = 0;
  List<int>? localScore;
  List<String> localNames = const ['Akhlaq', 'Player 2'];
  String lastMode = 'solo';

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final version = prefs.getInt(_versionKey) ?? _dataVersion;
    if (version > _dataVersion) {
      await _resetUnsupportedData(prefs);
    }
    music = prefs.getBool(_musicKey) ?? true;
    sound = prefs.getBool(_soundKey) ?? true;
    haptics = prefs.getBool(_hapticsKey) ?? true;
    reducedMotion = prefs.getBool(_motionKey) ?? false;
    soloWins = (prefs.getInt(_winsKey) ?? 0).clamp(0, 12);
    lastMode = switch (prefs.getString(_lastModeKey)) {
      'local' => 'local',
      _ => 'solo',
    };
    final encodedScore = prefs.getStringList(_localScoreKey);
    final parsedScore = encodedScore?.map(int.tryParse).toList();
    if (parsedScore != null &&
        parsedScore.length == 2 &&
        parsedScore.every(
          (value) => value != null && value >= 0 && value < 3,
        )) {
      localScore = parsedScore.cast<int>();
    } else {
      localScore = null;
    }
    final names = prefs.getStringList(_localNamesKey);
    if (names != null &&
        names.length == 2 &&
        names.every((name) => name.trim().isNotEmpty)) {
      localNames = names.map((name) => name.trim()).toList(growable: false);
    }
    await prefs.setInt(_versionKey, _dataVersion);
    notifyListeners();
  }

  Future<void> setMusic(bool value) =>
      _setBool(_musicKey, value, () => music = value);
  Future<void> setSound(bool value) =>
      _setBool(_soundKey, value, () => sound = value);
  Future<void> setHaptics(bool value) =>
      _setBool(_hapticsKey, value, () => haptics = value);
  Future<void> setReducedMotion(bool value) =>
      _setBool(_motionKey, value, () => reducedMotion = value);

  Future<void> recordSoloWin() async {
    soloWins = (soloWins + 1).clamp(0, 12);
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_winsKey, soloWins);
  }

  Future<void> setLastMode(String value) async {
    lastMode = value == 'local' ? 'local' : 'solo';
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_lastModeKey, lastMode);
  }

  Future<void> saveLocalMatch(List<int> score, {List<String>? names}) async {
    if (score.length != 2 || score.any((value) => value < 0 || value >= 3)) {
      return;
    }
    localScore = List.unmodifiable(score);
    if (names != null && names.length == 2) {
      localNames = List.unmodifiable(names);
    }
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _localScoreKey,
      score.map((value) => '$value').toList(),
    );
    await prefs.setStringList(_localNamesKey, localNames);
  }

  Future<void> clearLocalMatch() async {
    localScore = null;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_localScoreKey);
  }

  Future<void> resetProgress() async {
    soloWins = 0;
    localScore = null;
    lastMode = 'solo';
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_winsKey);
    await prefs.remove(_localScoreKey);
    await prefs.remove(_lastModeKey);
  }

  Future<void> _resetUnsupportedData(SharedPreferences prefs) async {
    await prefs.remove(_winsKey);
    await prefs.remove(_localScoreKey);
    await prefs.remove(_localNamesKey);
    await prefs.remove(_lastModeKey);
  }

  Future<void> _setBool(String key, bool value, VoidCallback apply) async {
    apply();
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }
}
