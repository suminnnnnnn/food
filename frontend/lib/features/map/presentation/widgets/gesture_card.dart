import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/video_model.dart';
import '../../presentation/providers/map_providers.dart';
import 'mini_video_player.dart';
import 'map_time_theme.dart';

/// Phase 4: 감각 제스처 + Phase 6: 리퀴드 바텀 통합 카드
/// - 위로 빠르게 스와이프 → 패스(Dismiss)
/// - 아래로 드래그 → 카드 높이 확장
/// - 더블 탭 → 즐겨찾기 하트 폭발
class GestureCard extends ConsumerStatefulWidget {
  final VideoData video;
  final VoidCallback onTap;
  final VoidCallback? onDismiss;
  final MapTimeTheme theme;

  const GestureCard({
    super.key,
    required this.video,
    required this.onTap,
    required this.theme,
    this.onDismiss,
  });

  @override
  ConsumerState<GestureCard> createState() => _GestureCardState();
}

class _GestureCardState extends ConsumerState<GestureCard>
    with TickerProviderStateMixin {
  // ── Phase 4: 스와이프 제스처용 ──
  late AnimationController _swipeCtrl;
  late Animation<Offset> _swipeAnim;
  late AnimationController _scaleCtrl;
  late Animation<double> _scaleAnim;

  // ── Phase 4: 하트 파티클 폭발 ──
  late AnimationController _heartCtrl;
  late Animation<double> _heartAnim;
  bool _showHearts = false;
  Offset _heartOrigin = Offset.zero;

  // ── 드래그 상태 ──
  double _dragDy = 0;

  @override
  void initState() {
    super.initState();

    _swipeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );
    _swipeAnim = Tween<Offset>(begin: Offset.zero, end: const Offset(0, -2))
        .animate(CurvedAnimation(parent: _swipeCtrl, curve: Curves.easeInCubic));

    _scaleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 120),
    );
    _scaleAnim = Tween<double>(begin: 1.0, end: 0.96)
        .animate(CurvedAnimation(parent: _scaleCtrl, curve: Curves.easeOut));

    _heartCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _heartAnim =
        CurvedAnimation(parent: _heartCtrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _swipeCtrl.dispose();
    _scaleCtrl.dispose();
    _heartCtrl.dispose();
    super.dispose();
  }

  void _handleVerticalDragUpdate(DragUpdateDetails d) {
    setState(() => _dragDy += d.delta.dy);
    if (_dragDy < -5) _scaleCtrl.forward();
  }

  void _handleVerticalDragEnd(DragEndDetails d) {
    final vy = d.velocity.pixelsPerSecond.dy;
    if (vy < -700 || _dragDy < -80) {
      // ── 빠른 위 스와이프 → Dismiss ──
      _swipeCtrl.forward().then((_) => widget.onDismiss?.call());
    } else {
      // ── 원위치 복귀 ──
      setState(() => _dragDy = 0);
      _scaleCtrl.reverse();
    }
  }

  void _handleDoubleTap(TapDownDetails d) {
    setState(() {
      _showHearts = true;
      _heartOrigin = d.localPosition;
    });
    _heartCtrl.forward(from: 0).then((_) {
      if (mounted) setState(() => _showHearts = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onDoubleTapDown: _handleDoubleTap,
      onDoubleTap: () {},
      onVerticalDragUpdate: _handleVerticalDragUpdate,
      onVerticalDragEnd: _handleVerticalDragEnd,
      child: AnimatedBuilder(
        animation: Listenable.merge([_swipeAnim, _scaleAnim, _heartAnim]),
        builder: (context, child) {
          return SlideTransition(
            position: _swipeAnim,
            child: Transform.scale(
              scale: _scaleAnim.value,
              child: Stack(
                children: [
                  child!,
                  if (_showHearts) _buildHeartParticles(),
                ],
              ),
            ),
          );
        },
        child: _buildCard(),
      ),
    );
  }

  Widget _buildCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.65),
            blurRadius: 28,
            spreadRadius: 2,
            offset: const Offset(0, 14),
          ),
          BoxShadow(
            color: widget.theme.accentColor.withOpacity(0.12),
            blurRadius: 45,
            spreadRadius: -4,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          children: [
            // ── Background Video ──
            MiniVideoPlayer(videoUrl: widget.video.videoUrl, autoPlay: true),

            // ── Phase 6: Glassmorphism Overlay ──
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: ClipRect(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(20, 28, 20, 22),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          widget.theme.cardBg.withOpacity(0.85),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                      border: Border(
                        top: BorderSide(
                            color: Colors.white.withOpacity(0.07), width: 0.8),
                      ),
                    ),
                    child: _buildMeta(),
                  ),
                ),
              ),
            ),

            // ── Dismiss Hint (위 스와이프 중 표시) ──
            if (_dragDy < -20)
              Positioned(
                top: 16,
                right: 20,
                child: AnimatedOpacity(
                  opacity: ((-_dragDy - 20) / 60).clamp(0.0, 1.0),
                  duration: const Duration(milliseconds: 80),
                  child: Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withOpacity(0.85),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.close, color: Colors.white, size: 14),
                        SizedBox(width: 4),
                        Text('패스',
                            style: TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
              ),

            // ── Card Border Glow ──
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                      color: Colors.white.withOpacity(0.07), width: 1.2),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMeta() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Restaurant Name
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: Colors.amber.withOpacity(0.2),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.amber.withOpacity(0.45),
                      blurRadius: 10,
                      spreadRadius: 1),
                ],
              ),
              child: const Icon(Icons.location_on, color: Colors.amber, size: 15),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                widget.video.restaurantName,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 23,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                  shadows: [
                    Shadow(color: Colors.black54, blurRadius: 6, offset: Offset(0, 2)),
                  ],
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        // YouTuber & Distance
        Row(
          children: [
            Text(
              '@${widget.video.youtuberName}',
              style: TextStyle(
                  color: Colors.white.withOpacity(0.75),
                  fontSize: 15,
                  fontWeight: FontWeight.w500),
            ),
            if (widget.video.distanceM != null) ...[
              const SizedBox(width: 10),
              Container(
                  width: 3,
                  height: 3,
                  decoration:
                      const BoxDecoration(color: Colors.white38, shape: BoxShape.circle)),
              const SizedBox(width: 10),
              Text(
                '${widget.video.distanceM!.toInt()}m',
                style: const TextStyle(color: Colors.white38, fontSize: 13),
              ),
            ],
          ],
        ),
        const SizedBox(height: 14),
        // Neon Tags
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: widget.video.trendTags.map((tag) {
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
              decoration: BoxDecoration(
                color: widget.theme.accentColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(30),
                border: Border.all(
                    color: widget.theme.accentColor.withOpacity(0.35), width: 1),
                boxShadow: [
                  BoxShadow(
                      color: widget.theme.accentColor.withOpacity(0.08),
                      blurRadius: 6),
                ],
              ),
              child: Text('#$tag',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700)),
            );
          }).toList(),
        ),
        // ── Phase 4: 스와이프 힌트 ──
        const SizedBox(height: 10),
        Center(
          child: Text(
            '↑ 위로 튕기면 패스  •  두 번 탭하면 ❤️',
            style: TextStyle(
                color: Colors.white.withOpacity(0.3),
                fontSize: 11,
                letterSpacing: 0.2),
          ),
        ),
      ],
    );
  }

  // ── Phase 4: 하트 파티클 폭발 ──
  Widget _buildHeartParticles() {
    return Positioned.fill(
      child: IgnorePointer(
        child: CustomPaint(
          painter: _HeartParticlePainter(
            progress: _heartAnim.value,
            origin: _heartOrigin,
          ),
        ),
      ),
    );
  }
}

/// 하트 파티클 캔버스 페인터
class _HeartParticlePainter extends CustomPainter {
  final double progress;
  final Offset origin;

  _HeartParticlePainter({required this.progress, required this.origin});

  @override
  void paint(Canvas canvas, Size size) {
    if (progress == 0) return;
    final paint = Paint()..style = PaintingStyle.fill;
    final directions = [
      const Offset(-1, -1.5),
      const Offset(0, -2),
      const Offset(1, -1.5),
      const Offset(-1.5, -0.5),
      const Offset(1.5, -0.5),
      const Offset(-0.5, -2.2),
      const Offset(0.5, -2.2),
    ];

    for (var i = 0; i < directions.length; i++) {
      final dir = directions[i];
      final dist = 55.0 * progress;
      final x = origin.dx + dir.dx * dist;
      final y = origin.dy + dir.dy * dist;
      final opacity = (1.0 - progress).clamp(0.0, 1.0);
      final radius = (6.0 - progress * 4).clamp(0.0, 8.0);
      paint.color = Colors.redAccent.withOpacity(opacity);
      canvas.drawCircle(Offset(x, y), radius, paint);
    }
  }

  @override
  bool shouldRepaint(_HeartParticlePainter old) =>
      old.progress != progress || old.origin != origin;
}
