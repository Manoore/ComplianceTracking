import 'dart:math';
import 'package:flutter/material.dart';

class CompliNowMark extends StatelessWidget {
  final double size;
  const CompliNowMark({super.key, this.size = 48});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _MarkPainter()),
    );
  }
}

class _MarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    final scale = s / 100.0;

    // Rounded rect background
    final bgPaint = Paint()..color = const Color(0xFF1B3260);
    canvas.drawRRect(
      RRect.fromRectAndRadius(Offset.zero & size, Radius.circular(22 * scale)),
      bgPaint,
    );

    final strokePaint = Paint()
      ..color = const Color(0xFF00C4A0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6.5 * scale
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // 270° arc: from (70,70) to (70,30) going counter-clockwise (large arc, sweep CCW)
    // Center is (50,50), radius 28. Start angle at bottom-right, sweep ~270°.
    final center = Offset(50 * scale, 50 * scale);
    final radius = 28.0 * scale;

    // Start: (70,70) → angle = atan2(70-50, 70-50) = 45° = π/4
    // End:   (70,30) → angle = atan2(30-50, 70-50) = -45° = -π/4
    // Arc goes large-arc CCW (A 28 28 0 1 1 in SVG = counterclockwise large arc)
    // SVG sweep-flag=1 means clockwise in SVG coords (y-down), so Flutter angle increases
    const startAngle = pi / 4;       // 45°  → point (70,70)
    const sweepAngle = 3 * pi / 2;   // 270° clockwise

    final arcRect = Rect.fromCircle(center: center, radius: radius);
    final arcPath = Path()..addArc(arcRect, startAngle, sweepAngle);
    canvas.drawPath(arcPath, strokePaint);

    // Checkmark: M 28 50 L 43 64 L 70 34
    final checkPath = Path()
      ..moveTo(28 * scale, 50 * scale)
      ..lineTo(43 * scale, 64 * scale)
      ..lineTo(70 * scale, 34 * scale);
    canvas.drawPath(checkPath, strokePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
