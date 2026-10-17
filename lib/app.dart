import 'package:flutter/material.dart';

import 'core/settings_controller.dart';
import 'core/theme.dart';
import 'features/home/home_screen.dart';
import 'features/splash/splash_screen.dart';

class PenFightApp extends StatefulWidget {
  const PenFightApp({super.key, required this.settings});

  final SettingsController settings;

  @override
  State<PenFightApp> createState() => _PenFightAppState();
}

class _PenFightAppState extends State<PenFightApp> {
  bool _showSplash = true;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 1800), () {
      if (mounted) setState(() => _showSplash = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Pen Fight',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      home: AnimatedSwitcher(
        duration: widget.settings.reducedMotion
            ? Duration.zero
            : const Duration(milliseconds: 450),
        child: _showSplash
            ? const SplashScreen(key: ValueKey('splash'))
            : HomeScreen(
                key: const ValueKey('home'),
                settings: widget.settings,
              ),
      ),
    );
  }
}
