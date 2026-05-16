import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/models/video_model.dart';
import '../providers/map_providers.dart';
import 'mini_video_player.dart';

/// Phase 8: 리퀴드 바텀 시트 (Premium Detail Sheet)
/// 패럴랙스 비디오 + 글래스모피즘(BackdropFilter) 백그라운드 적용
class DetailBottomSheet extends ConsumerStatefulWidget {
  final String videoId;

  const DetailBottomSheet({super.key, required this.videoId});

  static void show(BuildContext context, String videoId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DetailBottomSheet(videoId: videoId),
    );
  }

  @override
  ConsumerState<DetailBottomSheet> createState() => _DetailBottomSheetState();
}

class _DetailBottomSheetState extends ConsumerState<DetailBottomSheet> {
  final DraggableScrollableController _scrollController = DraggableScrollableController();
  double _currentExtent = 0.5;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(() {
      setState(() {
        _currentExtent = _scrollController.size;
      });
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _launchURL(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync = ref.watch(videoDetailProvider(widget.videoId));

    return DraggableScrollableSheet(
      controller: _scrollController,
      initialChildSize: 0.5,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      snap: true,
      snapSizes: const [0.5, 0.95],
      builder: (context, scrollController) {
        return ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              decoration: BoxDecoration(
                color: const Color(0xFF0F0F1A).withOpacity(0.75),
                border: Border(
                  top: BorderSide(color: Colors.white.withOpacity(0.15), width: 1.5),
                ),
              ),
              child: detailAsync.when(
                data: (detail) {
                  if (detail == null) {
                    return const Center(
                      child: Text('정보를 불러올 수 없습니다.', style: TextStyle(color: Colors.white70)),
                    );
                  }
                  return _buildContent(context, detail, scrollController);
                },
                loading: () => const Center(
                  child: CircularProgressIndicator(color: Color(0xFF00E5FF)),
                ),
                error: (e, _) => Center(
                  child: Text('오류: $e', style: const TextStyle(color: Colors.redAccent)),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildContent(BuildContext context, VideoDetail detail, ScrollController scrollController) {
    final videoHeight = 240.0 + ((_currentExtent - 0.5) / 0.45 * 160.0).clamp(0.0, 160.0);
    
    return Stack(
      children: [
        CustomScrollView(
          controller: scrollController,
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverAppBar(
              expandedHeight: videoHeight,
              backgroundColor: Colors.transparent,
              automaticallyImplyLeading: false,
              flexibleSpace: FlexibleSpaceBar(
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    MiniVideoPlayer(videoUrl: detail.videoUrl, autoPlay: true),
                    Positioned(
                      bottom: 0, left: 0, right: 0, height: 100,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              const Color(0xFF0F0F1A).withOpacity(0.75),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 16, 24, 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            detail.restaurantName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 28,
                              fontWeight: FontWeight.w800,
                              height: 1.2,
                            ),
                          ),
                        ),
                        const SizedBox(width: 16),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF00E5FF).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: const Color(0xFF00E5FF).withOpacity(0.5)),
                          ),
                          child: Text(
                            detail.category,
                            style: const TextStyle(color: Color(0xFF00E5FF), fontSize: 13, fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(color: Colors.redAccent.withOpacity(0.2), shape: BoxShape.circle),
                          child: const Icon(Icons.play_arrow_rounded, color: Colors.redAccent, size: 16),
                        ),
                        const SizedBox(width: 8),
                        Text('@${detail.youtuberName}', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.location_on_rounded, color: Colors.white54, size: 20),
                        const SizedBox(width: 8),
                        Expanded(child: Text(detail.address, style: const TextStyle(color: Colors.white70, fontSize: 15))),
                      ],
                    ),
                    const Padding(padding: EdgeInsets.symmetric(vertical: 24), child: Divider(color: Colors.white10, height: 1)),
                    Wrap(
                      spacing: 12, runSpacing: 12,
                      children: detail.trendTags.map((tag) {
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF7C4DFF).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(color: const Color(0xFF7C4DFF).withOpacity(0.3)),
                          ),
                          child: Text('#$tag', style: const TextStyle(color: Color(0xFFB388FF), fontSize: 14, fontWeight: FontWeight.w600)),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 32),
                    Text(detail.description, style: TextStyle(color: Colors.white.withOpacity(0.85), fontSize: 16, height: 1.7)),
                  ],
                ),
              ),
            ),
          ],
        ),
        // 상단 핸들 바
        Positioned(
          top: 0, left: 0, right: 0,
          child: Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12),
              width: 48, height: 5,
              decoration: BoxDecoration(color: Colors.white.withOpacity(0.4), borderRadius: BorderRadius.circular(2.5)),
            ),
          ),
        ),
        // 하단 액션 버튼
        _buildActionButtons(detail),
      ],
    );
  }

  Widget _buildActionButtons(VideoDetail detail) {
    final hasReservation = detail.reservationUrl != null && detail.reservationUrl!.isNotEmpty;
    
    return Positioned(
      bottom: 24, left: 24, right: 24,
      child: Row(
        children: [
          Expanded(
            flex: 2,
            child: _buildCTAButton(
              onTap: () => Navigator.pop(context),
              icon: Icons.directions_rounded,
              label: '길찾기',
              colors: [const Color(0xFF00E5FF), const Color(0xFF00B8D4)],
            ),
          ),
          if (hasReservation) ...[
            const SizedBox(width: 12),
            Expanded(
              flex: 3,
              child: _buildCTAButton(
                onTap: () => _launchURL(detail.reservationUrl),
                icon: Icons.calendar_today_rounded,
                label: detail.platformType == 'catchtable' ? '캐치테이블' : '네이버 예약',
                colors: detail.platformType == 'catchtable' 
                    ? [const Color(0xFFFF4D4D), const Color(0xFFD40000)]
                    : [const Color(0xFF2DB400), const Color(0xFF1F7A00)],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCTAButton({required VoidCallback onTap, required IconData icon, required String label, required List<Color> colors}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(gradient: LinearGradient(colors: colors), borderRadius: BorderRadius.circular(20)),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 18),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, color: Colors.black87, size: 20),
                    const SizedBox(width: 8),
                    Text(label, style: const TextStyle(color: Colors.black87, fontSize: 16, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
