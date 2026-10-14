import 'package:flutter/material.dart';

import 'core/settings_controller.dart';
import 'core/theme.dart';
import 'features/home/home_screen.dart';

class PenFightApp extends StatelessWidget {
  const PenFightApp({super.key, required this.settings});

  final SettingsController settings;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pen Fight',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: HomeScreen(settings: settings),
    );
  }
}
