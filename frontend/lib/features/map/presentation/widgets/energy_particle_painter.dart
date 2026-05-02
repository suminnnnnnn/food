import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Phase 5: 데이터-드리븐 파티클 레이어
/// energyLevel (0~3)에 따라 마커 주변 파티클 밀도와 글로우 강도가 달라진다.
/// trendTags.length → energyLevel 매핑:
///   0~1 tags  → Level 0 (마커만)
///   2~3 tags  → Level 1 (4 파티클, 느린 궤도)
///   4~5 tags  → Level 2 (8 파티클, 더 큰 글로우)
///   6+  tags  → Level 3 (16 파티클, 태양처럼 빛남)
class EnergyParticlePainter extends CustomPainter {
  final double angle;       // 현재 회전각 (0 ~ 2π)
  final int energyLevel;    // 0~3
  final Color baseColor;
  final double pulse;       // 0.85~1.15 맥동 배율
  final bool isSelected;

  static const _levelConfig = [
    _EnergyConfig(particleCount: 0,  orbitRadius: 0,  particleSize: 0,  glowStrength: 0.0),
    _EnergyConfig(particleCount: 4,  orbitRadius: 20, particleSize: 3,  glowStrength: 0.3),
    _EnergyConfig(particleCount: 8,  orbitRadius: 24, particleSize: 3.5, glowStrength: 0.5),
    _EnergyConfig(particleCount: 16, orbitRadius: 28, particleSize: 4,  glowStrength: 0.8),
  ];

  EnergyParticlePainter({
    required this.angle,
    required this.energyLevel,
    required this.baseColor,
    required this.pulse,
    required this.isSelected,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final lvl = energyLevel.clamp(0, 3);
    final cfg = _levelConfig[lvl];
    if (cfg.particleCount == 0) return;

    final center = Offset(size.width / 2, size.height / 2);
    final orbit = cfg.orbitRadius * pulse;

    // ── 태양 후광 (Level 3) ──
    if (lvl == 3) {
      _drawSolarFlare(canvas, center, orbit);
    }

    // ── 파티클 궤도 ──
    for (int i = 0; i < cfg.particleCount; i++) {
      final particleAngle = angle + (i * 2 * math.pi / cfg.particleCount);
      // 두 번째 궤도 (Level 2+): 역방향 회전, 반경 다름
      final isOuterRing = lvl >= 2 && i >= cfg.particleCount ~/ 2;
      final ringRadius = isOuterRing ? orbit * 1.45 : orbit;
      final ringAngle = isOuterRing ? -angle + (i * 2 * math.pi / (cfg.particleCount ~/ 2)) : particleAngle;

      final dx = math.cos(ringAngle) * ringRadius;
      final dy = math.sin(ringAngle) * ringRadius;
      final pos = center + Offset(dx, dy);

      // 파티클 크기: Level에 비례, 외부 링은 살짝 작게
      final pSize = cfg.particleSize * (isOuterRing ? 0.7 : 1.0) * pulse;

      // 파티클 색상: Level이 높을수록 더 밝게 (흰색에 가까워짐)
      final colorT = lvl / 3.0;
      final pColor = Color.lerp(baseColor, Colors.white, colorT * 0.4)!;

      // ── 파티클 글로우 ──
      final glowPaint = Paint()
        ..color = pColor.withOpacity(cfg.glowStrength * 0.4)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, pSize * 1.8);
      canvas.drawCircle(pos, pSize * 2.2, glowPaint);

      // ── 파티클 코어 ──
      final corePaint = Paint()
        ..color = pColor.withOpacity(0.9)
        ..style = PaintingStyle.fill;
      canvas.drawCircle(pos, pSize, corePaint);
    }

    // ── 선택 상태: 에너지 빔 (Level 2+ 선택 시 마커에서 광선 방출) ──
    if (isSelected && lvl >= 2) {
      _drawEnergyBeams(canvas, center, orbit, cfg.particleCount);
    }
  }

  void _drawSolarFlare(Canvas canvas, Offset center, double orbit) {
    // 뒤에서 퍼져나가는 빛 후광
    for (int ray = 0; ray < 8; ray++) {
      final rayAngle = angle * 0.5 + (ray * math.pi / 4);
      final rayLen = orbit * 1.8 + math.sin(angle * 2 + ray) * 6;
      final rayEnd = center + Offset(math.cos(rayAngle) * rayLen, math.sin(rayAngle) * rayLen);
      final rayPaint = Paint()
        ..color = baseColor.withOpacity(0.12)
        ..strokeWidth = 1.5
        ..style = PaintingStyle.stroke
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3);
      canvas.drawLine(center, rayEnd, rayPaint);
    }

    // 배경 후광 원
    final haloPaint = Paint()
      ..color = baseColor.withOpacity(0.08)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, orbit * 0.8);
    canvas.drawCircle(center, orbit * 1.6, haloPaint);
  }

  void _drawEnergyBeams(Canvas canvas, Offset center, double orbit, int count) {
    final beamPaint = Paint()
      ..strokeWidth = 0.8
      ..style = PaintingStyle.stroke;
    for (int i = 0; i < 4; i++) {
      final beamAngle = angle * 1.5 + (i * math.pi / 2);
      final beamLen = orbit * 0.6;
      final beamEnd = center + Offset(math.cos(beamAngle) * beamLen, math.sin(beamAngle) * beamLen);
      final opacity = 0.3 + math.sin(angle * 3 + i) * 0.2;
      beamPaint.color = Colors.white.withOpacity(opacity.clamp(0.1, 0.5));
      canvas.drawLine(center, beamEnd, beamPaint);
    }
  }

  @override
  bool shouldRepaint(EnergyParticlePainter old) =>
      old.angle != angle || old.pulse != pulse || old.isSelected != isSelected;
}

class _EnergyConfig {
  final int particleCount;
  final double orbitRadius;
  final double particleSize;
  final double glowStrength;
  const _EnergyConfig({
    required this.particleCount,
    required this.orbitRadius,
    required this.particleSize,
    required this.glowStrength,
  });
}

/// energyLevel 계산 유틸
int computeEnergyLevel(int tagCount) {
  if (tagCount >= 6) return 3;
  if (tagCount >= 4) return 2;
  if (tagCount >= 2) return 1;
  return 0;
}
