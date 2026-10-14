import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsController extends ChangeNotifier {
  static const _musicKey = 'settings.music';
  static const _soundKey = 'settings.sound';
  static const _hapticsKey = 'settings.haptics';
  static const _motionKey = 'settings.reducedMotion';
  static const _winsKey = 'progress.soloWins';

  bool music = true;
  bool sound = true;
  bool haptics = true;
  bool reducedMotion = false;
  int soloWins = 0;

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    music = prefs.getBool(_musicKey) ?? true;
    sound = prefs.getBool(_soundKey) ?? true;
    haptics = prefs.getBool(_hapticsKey) ?? true;
    reducedMotion = prefs.getBool(_motionKey) ?? false;
    soloWins = (prefs.getInt(_winsKey) ?? 0).clamp(0, 12);
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

  Future<void> _setBool(String key, bool value, VoidCallback apply) async {
    apply();
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }
}
