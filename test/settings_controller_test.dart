import 'package:flutter_test/flutter_test.dart';
import 'package:pen_fight/core/settings_controller.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('corrupt local score falls back safely', () async {
    SharedPreferences.setMockInitialValues({
      'save.version': 1,
      'match.localScore': ['not-a-score', '2'],
    });
    final settings = SettingsController();
    await settings.load();

    expect(settings.localScore, isNull);
  });

  test('local match and last mode survive reload', () async {
    SharedPreferences.setMockInitialValues({});
    final first = SettingsController();
    await first.load();
    await first.saveLocalMatch([1, 2]);
    await first.setLastMode('local');

    final reloaded = SettingsController();
    await reloaded.load();
    expect(reloaded.localScore, [1, 2]);
    expect(reloaded.lastMode, 'local');
  });
}
