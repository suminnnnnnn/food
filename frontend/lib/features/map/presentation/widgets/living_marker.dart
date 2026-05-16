import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'energy_particle_painter.dart';

/// Phase 1 + Phase 5: 살아있는 마커 + 데이터-드리븐 파티클 레이어
///
/// [energyLevel] 0~3: trendTags.length 기반 에너지 강도
///   Level 0 → 마커만
///   Level 1 → 4 파티클 궤도
///   Level 2 → 8 파티클 이중 궤도 + 확장 글로우
///   Level 3 → 16 파티클 + 태양 후광 + 빔
class LivingMarker extends StatefulWidget {
  final bool isSelected;
  final double pulsePhaseOffset;
  final int energyLevel;          // Phase 5: 0~3
  final VoidCallback onTap;
  final void Function(Offset, Size)? onLongPress; // Phase 2: 롱프레스 콜백

  const LivingMarker({
    super.key,
    required this.isSelected,
    required this.onTap,
    this.pulsePhaseOffset = 0.0,
    this.energyLevel = 0,
    this.onLongPress,
  });

  @override
  State<LivingMarker> createState() => _LivingMarkerState();
}

class _LivingMarkerState extends State<LivingMarker>
    with TickerProviderStateMixin {

  // ── Phase 1: 기본 맥동 ──
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  // ── Phase 1: 선택 팽창 ──
  late AnimationController _expandCtrl;
  late Animation<double> _expandAnim;

  // ── Phase 1: 궤도 링 ──
  late AnimationController _orbitCtrl;
  late Animation<double> _orbitAnim;

  // ── Phase 1: 색상 전환 ──
  late AnimationController _colorCtrl;
  late Animation<double> _colorAnim;

  // ── Phase 5: 파티클 회전 (에너지 레벨에 따라 속도 차등) ──
  late AnimationController _particleCtrl;
  late Animation<double> _particleAngleAnim;

  @override
  void initState() {
    super.initState();

    // 1. Pulse — 마커마다 다른 주기
    final pulseDuration = Duration(
        milliseconds: 1800 + (widget.pulsePhaseOffset * 600).toInt());
    _pulseCtrl = AnimationController(vsync: this, duration: pulseDuration)
      ..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.85, end: 1.15).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );

    // 2. Expand
    _expandCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _expandAnim =
        CurvedAnimation(parent: _expandCtrl, curve: Curves.elasticOut);

    // 3. Orbit Ring (방출 링)
    _orbitCtrl = AnimationController(
        vsync: this, duration: const Duration(seconds: 3));
    _orbitAnim =
        Tween<double>(begin: 0, end: 2 * math.pi).animate(_orbitCtrl);

    // 4. Color
    _colorCtrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 350));
    _colorAnim =
        CurvedAnimation(parent: _colorCtrl, curve: Curves.easeOut);

    // 5. Phase 5: 파티클 회전
    //    Level이 높을수록 빠르게 회전 (에너지 느낌)
    final speedMs = _particleSpeedMs(widget.energyLevel, widget.pulsePhaseOffset);
    _particleCtrl = AnimationController(
        vsync: this, duration: Duration(milliseconds: speedMs))
      ..repeat();
    _particleAngleAnim =
        Tween<double>(begin: 0, end: 2 * math.pi).animate(_particleCtrl);

    // 초기 상태
    if (widget.isSelected) {
      _expandCtrl.value = 1.0;
      _colorCtrl.value = 1.0;
      _orbitCtrl.repeat();
    }
    _pulseCtrl.value = widget.pulsePhaseOffset;
  }

  int _particleSpeedMs(int level, double offset) {
    // Level 0: 4000ms, Level 1: 3200ms, Level 2: 2400ms, Level 3: 1600ms
    // + 개별 offset으로 마커마다 살짝 다름
    final base = 4000 - (level * 800);
    final variation = (offset * 400).toInt();
    return (base + variation).clamp(800, 5000);
  }

  @override
  void didUpdateWidget(LivingMarker oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (widget.isSelected != oldWidget.isSelected) {
      if (widget.isSelected) {
        _expandCtrl.forward();
        _colorCtrl.forward();
        _orbitCtrl.repeat();
      } else {
        _expandCtrl.reverse();
        _colorCtrl.reverse();
        _orbitCtrl.stop();
        _orbitCtrl.reset();
      }
    }

    // energyLevel이 바뀌면 파티클 속도 갱신
    if (widget.energyLevel != oldWidget.energyLevel) {
      final speedMs =
          _particleSpeedMs(widget.energyLevel, widget.pulsePhaseOffset);
      _particleCtrl.duration = Duration(milliseconds: speedMs);
      _particleCtrl.repeat();
    }
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _expandCtrl.dispose();
    _orbitCtrl.dispose();
    _colorCtrl.dispose();
    _particleCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onLongPress: () {
        if (widget.onLongPress == null) return;
        final renderBox = context.findRenderObject() as RenderBox;
        final offset = renderBox.localToGlobal(Offset.zero);
        widget.onLongPress!(offset, renderBox.size);
      },
      child: RepaintBoundary(  // Phase 5: 파티클 레이어를 지도와 분리
        child: AnimatedBuilder(
          animation: Listenable.merge([
            _pulseAnim,
            _expandAnim,
            _orbitAnim,
            _colorAnim,
            _particleAngleAnim,
          ]),
          builder: (context, _) {
            final pulse = _pulseAnim.value;
            final expand = _expandAnim.value;
            final orbit = _orbitAnim.value;
            final colorT = _colorAnim.value;
            final particleAngle = _particleAngleAnim.value;

            // 에너지 레벨에 따른 색상 보간:
            // Level 0: 보라  Level 1: 딥퍼플  Level 2: 시안  Level 3: 골드-화이트
            final levelColors = [
              const Color(0xFF7C4DFF), // purple
              const Color(0xFF9C6FFF), // mid purple
              const Color(0xFF00E5FF), // cyan
              const Color(0xFFFFD740), // gold
            ];
            final lvl = widget.energyLevel.clamp(0, 3);
            final energyColor = Color.lerp(
              levelColors[lvl],
              widget.isSelected ? const Color(0xFF00E5FF) : levelColors[lvl],
              colorT,
            )!;

            // 코어 크기
            final baseSize = 18.0 + (expand * 10.0);
            final coreSize = baseSize * pulse;
            final glowRadius = 8.0 + (expand * 16.0) + (lvl * 4.0);

            return SizedBox(
              width: 64,
              height: 64,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // ── Phase 5: 에너지 파티클 레이어 (CustomPainter) ──
                  if (lvl > 0)
                    CustomPaint(
                      size: const Size(64, 64),
                      painter: EnergyParticlePainter(
                        angle: particleAngle,
                        energyLevel: lvl,
                        baseColor: energyColor,
                        pulse: pulse,
                        isSelected: widget.isSelected,
                      ),
                    ),

                  // ── Phase 1: 선택 시 방출 링 ──
                  if (widget.isSelected)
                    _buildEmissionRing(orbit, energyColor, coreSize),

                  // ── 외부 글로우 ──
                  _buildGlowRing(coreSize, energyColor, glowRadius, lvl),

                  // ── 코어 ──
                  _buildCore(coreSize, energyColor, lvl),

                  // ── 하이라이트 ──
                  _buildHighlight(coreSize, lvl),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildEmissionRing(double orbit, Color color, double coreSize) {
    final t = (orbit / (2 * math.pi)) % 1.0;
    final ringSize = coreSize + (t * 30);
    final opacity = (1.0 - t) * 0.5;
    return Container(
      width: ringSize,
      height: ringSize,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color.withOpacity(opacity), width: 1.5),
      ),
    );
  }

  Widget _buildGlowRing(double size, Color color, double glowRadius, int lvl) {
    // Level 3에서는 이중 글로우
    final outerOpacity = 0.2 + (_expandAnim.value * 0.2) + (lvl * 0.05);
    return Container(
      width: size + glowRadius,
      height: size + glowRadius,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(outerOpacity),
            blurRadius: glowRadius * 2.0,
            spreadRadius: glowRadius * 0.3,
          ),
          if (lvl >= 3)
            BoxShadow(
              color: color.withOpacity(0.1),
              blurRadius: glowRadius * 4.0,
              spreadRadius: glowRadius * 0.5,
            ),
        ],
      ),
    );
  }

  Widget _buildCore(double size, Color color, int lvl) {
    // Level 3: 코어 배경을 살짝 채워 태양처럼 보임
    final fillOpacity = widget.isSelected
        ? 0.15
        : (lvl == 3 ? 0.1 : 0.0);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withOpacity(fillOpacity),
        shape: BoxShape.circle,
        border: Border.all(
          color: color,
          width: widget.isSelected ? 3.0 : (lvl >= 2 ? 2.5 : 2.0),
        ),
      ),
    );
  }

  Widget _buildHighlight(double coreSize, int lvl) {
    // Level이 높을수록 하이라이트 더 크고 밝음
    final highlightSize = coreSize * (0.25 + lvl * 0.05);
    return Container(
      width: highlightSize,
      height: highlightSize,
      decoration: BoxDecoration(
        color: lvl == 3 ? Colors.amber.shade100 : Colors.white,
        shape: BoxShape.circle,
        boxShadow: lvl >= 2
            ? [BoxShadow(color: Colors.white.withOpacity(0.5), blurRadius: 4)]
            : null,
      ),
    );
  }
}
