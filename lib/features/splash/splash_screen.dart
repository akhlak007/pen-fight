import 'package:flutter/material.dart';

import '../../core/theme.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return Scaffold(
      backgroundColor: const Color(0xff39352f),
      body: Align(
        alignment: const Alignment(0, -0.25),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 765),
            child: ClipPath(
              clipper: const _TornPaperClipper(),
              child: CustomPaint(
                painter: const _SplashPaperPainter(),
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    width < 600 ? 42 : 44,
                    38,
                    24,
                    30,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Text(
                          'FINDING YOUR SEAT.',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineLarge
                              ?.copyWith(
                                fontSize: width < 600 ? 28 : 40,
                                letterSpacing: 1,
                              ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Your pens will be here in a moment.',
                        style: TextStyle(
                          color: AppColors.ink,
                          fontSize: width < 600 ? 18 : 22,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TornPaperClipper extends CustomClipper<Path> {
  const _TornPaperClipper();

  @override
  Path getClip(Size size) {
    const tear = 9.0;
    final path = Path()..moveTo(0, tear + 2);
    final points = <double>[
      0,
      .05,
      .11,
      .17,
      .24,
      .31,
      .38,
      .45,
      .52,
      .59,
      .66,
      .73,
      .80,
      .87,
      .94,
      1,
    ];
    for (var i = 0; i < points.length; i++) {
      path.lineTo(size.width * points[i], i.isEven ? tear + 2 : 2);
    }
    path.lineTo(size.width, size.height - tear);
    for (var i = points.length - 1; i >= 0; i--) {
      path.lineTo(
        size.width * points[i],
        i.isEven ? size.height - 1 : size.height - tear - 2,
      );
    }
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _SplashPaperPainter extends CustomPainter {
  const _SplashPaperPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = AppColors.paperWarm);
    final rule = Paint()
      ..color = AppColors.rule
      ..strokeWidth = 1.2;
    for (double y = 36; y < size.height; y += 32) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), rule);
    }
    canvas.drawLine(
      const Offset(28, 0),
      Offset(28, size.height),
      Paint()
        ..color = AppColors.margin
        ..strokeWidth = 1.5,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
