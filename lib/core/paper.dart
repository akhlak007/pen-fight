import 'package:flutter/material.dart';

import 'theme.dart';

class NotebookPaper extends StatelessWidget {
  const NotebookPaper({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(28),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.paper,
        borderRadius: BorderRadius.circular(6),
        boxShadow: const [
          BoxShadow(
            color: Color(0x88000000),
            blurRadius: 30,
            offset: Offset(0, 16),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: CustomPaint(
          painter: const _PaperPainter(),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

class _PaperPainter extends CustomPainter {
  const _PaperPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final rule = Paint()
      ..color = AppColors.rule
      ..strokeWidth = 1;
    for (double y = 68; y < size.height; y += 32) {
      canvas.drawLine(Offset.zero.translate(0, y), Offset(size.width, y), rule);
    }
    final margin = Paint()
      ..color = AppColors.margin
      ..strokeWidth = 1.3;
    canvas.drawLine(const Offset(38, 0), Offset(38, size.height), margin);
    final grain = Paint()..color = const Color(0x0b5d4822);
    for (double y = 13; y < size.height; y += 43) {
      for (double x = 17 + (y % 7); x < size.width; x += 61) {
        canvas.drawCircle(Offset(x, y), .7, grain);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class InkButton extends StatelessWidget {
  const InkButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.secondary = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool secondary;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: secondary ? AppColors.ink : AppColors.red,
          foregroundColor: Colors.white,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
          elevation: 5,
          shadowColor: Colors.black54,
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontFamily: 'Anton',
            fontSize: 18,
            letterSpacing: 1.2,
          ),
        ),
      ),
    );
  }
}
