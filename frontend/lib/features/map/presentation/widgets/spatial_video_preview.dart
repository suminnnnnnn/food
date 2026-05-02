import 'dart:ui';
import 'package:flutter/material.dart';
import '../../data/models/video_model.dart';
import 'mini_video_player.dart';

/// Phase 2: 맵 위 인라인 비디오 프리뷰 (Spatial Video Preview)
/// 마커를 롱프레스하면 해당 위치에서 팽창하며 등장하는 비디오 카드
class SpatialVideoPreview extends StatefulWidget {
  final VideoData video;
  final Offset markerOffset;
  final Size markerSize;
  final VoidCallback onClose;
  final VoidCallback onDetailsTap;

  const SpatialVideoPreview({
    super.key,
    required this.video,
    required this.markerOffset,
    required this.markerSize,
    required this.onClose,
    required this.onDetailsTap,
  });

  @override
  State<SpatialVideoPreview> createState() => _SpatialVideoPreviewState();
}

class _SpatialVideoPreviewState extends State<SpatialVideoPreview>
    with SingleTickerProviderStateMixin {
  late AnimationController _animCtrl;
  late Animation<double> _scaleAnim;
  late Animation<double> _opacityAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 350),
    );

    _scaleAnim = CurvedAnimation(
      parent: _animCtrl,
      curve: Curves.elasticOut,
    );

    _opacityAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animCtrl,
        curve: const Interval(0.0, 0.5, curve: Curves.easeIn),
      ),
    );

    _animCtrl.forward();
  }

  Future<void> _close() async {
    await _animCtrl.reverse();
    widget.onClose();
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 마커의 중심 좌표 계산
    final markerCenter = Offset(
      widget.markerOffset.dx + widget.markerSize.width / 2,
      widget.markerOffset.dy + widget.markerSize.height / 2,
    );

    // 카드의 크기
    const double cardWidth = 220;
    const double cardHeight = 320;

    // 카드가 화면 밖으로 나가지 않도록 조정
    final screenSize = MediaQuery.of(context).size;
    
    // 기본적으로 마커 바로 위에 배치
    double left = markerCenter.dx - cardWidth / 2;
    double top = markerCenter.dy - cardHeight - 15;

    // 화면 경계 체크
    if (left < 20) left = 20;
    if (left + cardWidth > screenSize.width - 20) {
      left = screenSize.width - cardWidth - 20;
    }
    if (top < 100) {
      // 위로 공간이 부족하면 마커 아래에 배치
      top = markerCenter.dy + 15;
    }

    return Stack(
      children: [
        // 뒷배경 터치 시 닫기 (흐릿한 오버레이)
        Positioned.fill(
          child: GestureDetector(
            onTap: _close,
            child: AnimatedBuilder(
              animation: _opacityAnim,
              builder: (context, child) {
                return Container(
                  color: Colors.black.withOpacity(0.3 * _opacityAnim.value),
                );
              },
            ),
          ),
        ),

        // 비디오 카드
        Positioned(
          left: left,
          top: top,
          width: cardWidth,
          height: cardHeight,
          child: AnimatedBuilder(
            animation: _animCtrl,
            builder: (context, child) {
              // 마커에서부터 커지는 느낌을 주기 위해 TransformOrigin을 마커 쪽으로 설정해야 하지만,
              // 심플하게 중앙에서 커지는 걸로 해도 Spring 물리 특성상 괜찮음.
              return Transform.scale(
                scale: _scaleAnim.value,
                alignment: Alignment.bottomCenter,
                child: Opacity(
                  opacity: _opacityAnim.value,
                  child: child,
                ),
              );
            },
            child: GestureDetector(
              onTap: () {
                _close();
                widget.onDetailsTap();
              },
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.5),
                      blurRadius: 30,
                      spreadRadius: 5,
                      offset: const Offset(0, 10),
                    ),
                    BoxShadow(
                      color: const Color(0xFF00E5FF).withOpacity(0.2),
                      blurRadius: 20,
                      spreadRadius: -2,
                    ),
                  ],
                  border: Border.all(
                    color: Colors.white.withOpacity(0.15),
                    width: 1.5,
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(22),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // 비디오 재생
                      MiniVideoPlayer(
                        videoUrl: widget.video.videoUrl,
                        autoPlay: true,
                      ),
                      
                      // 정보 오버레이 (하단 글래스모피즘)
                      Positioned(
                        bottom: 0,
                        left: 0,
                        right: 0,
                        child: ClipRect(
                          child: BackdropFilter(
                            filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Colors.transparent,
                                    Colors.black.withOpacity(0.8),
                                  ],
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    widget.video.restaurantName,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold,
                                      shadows: [
                                        Shadow(
                                          color: Colors.black,
                                          blurRadius: 4,
                                        ),
                                      ],
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.play_circle_fill,
                                        color: Color(0xFF00E5FF),
                                        size: 14,
                                      ),
                                      const SizedBox(width: 4),
                                      Text(
                                        '@${widget.video.youtuberName}',
                                        style: TextStyle(
                                          color: Colors.white.withOpacity(0.9),
                                          fontSize: 12,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
