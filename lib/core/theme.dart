import 'package:flutter/material.dart';

abstract final class AppColors {
  static const ink = Color(0xff233e96);
  static const inkSoft = Color(0xff6472a0);
  static const red = Color(0xffc83b2c);
  static const redDark = Color(0xff91271d);
  static const paper = Color(0xfffffbeb);
  static const paperWarm = Color(0xfff5eed4);
  static const rule = Color(0x5591add4);
  static const margin = Color(0x77df6962);
  static const gold = Color(0xffe9ad2f);
  static const chalk = Color(0xfff4f1dc);
  static const board = Color(0xff17372a);
}

abstract final class Assets {
  static const classroom =
      'assets/images/scene/classroom_landscape_1920x1080.jpg';
  static const classroomDim = 'assets/images/scene/classroom_landscape_dim.jpg';
  static const classroomPortraitDim =
      'assets/images/scene/classroom_portrait_dim.jpg';
  static const logo = 'assets/images/ui/logo_menu_ink.png';
  static const badge = 'assets/images/ui/badge_pencil_box.png';
  static const goldPen = 'assets/images/pens/pen_gold_nib_large.png';
  static const players = 'assets/images/icons/icon_players.png';
  static const globe = 'assets/images/icons/icon_globe.png';
  static const link = 'assets/images/icons/icon_link.png';
  static const trophy = 'assets/images/icons/trophy.png';
  static const settings = 'assets/images/icons/settings.png';
}

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    fontFamily: 'PatrickHand',
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.ink,
      primary: AppColors.ink,
      secondary: AppColors.red,
      surface: AppColors.paper,
    ),
    scaffoldBackgroundColor: const Color(0xff202417),
    textTheme: const TextTheme(
      displayLarge: TextStyle(
        fontFamily: 'Kalam',
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
        height: 1,
      ),
      headlineLarge: TextStyle(
        fontFamily: 'Kalam',
        fontWeight: FontWeight.w700,
        color: AppColors.ink,
        height: 1.05,
      ),
      titleLarge: TextStyle(fontSize: 26, color: AppColors.ink),
      bodyLarge: TextStyle(fontSize: 19, color: AppColors.ink),
      bodyMedium: TextStyle(fontSize: 16, color: AppColors.inkSoft),
      labelLarge: TextStyle(fontFamily: 'Anton', letterSpacing: 1.1),
    ),
  );
}
