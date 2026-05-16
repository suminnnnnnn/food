import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' as ll;
import 'package:vector_map_tiles/vector_map_tiles.dart';
import 'package:vector_tile_renderer/vector_tile_renderer.dart' hide TileLayer;
import 'package:vector_map_tiles_pmtiles/vector_map_tiles_pmtiles.dart';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/services.dart' show rootBundle;
import '../providers/map_providers.dart';
import '../widgets/trend_dial_button.dart';
import '../widgets/shimmer_card.dart';
import '../widgets/detail_bottom_sheet.dart';
import '../widgets/living_marker.dart';
import '../widgets/gesture_card.dart';
import '../widgets/map_time_theme.dart';
import '../widgets/energy_particle_painter.dart';
import '../widgets/spatial_video_preview.dart';
import '../widgets/spatial_filter_bar.dart';

/// 메인 지도 통합 화면
/// Phase 1: Living Marker System
/// Phase 3: Time-Aware Map Atmosphere
/// Phase 4: Sensory Gesture Navigation
/// Phase 6: Liquid Bottom Interface
class MainMapScreen extends ConsumerStatefulWidget {
  const MainMapScreen({super.key});

  @override
  ConsumerState<MainMapScreen> createState() => _MainMapScreenState();
}

class _MainMapScreenState extends ConsumerState<MainMapScreen>
    with TickerProviderStateMixin {
  final MapController _mapController = MapController();
  late PageController _pageController;
  late AnimationController _fadeController;
  late Animation<double> _fadeAnimation;

  // Phase 3: 시간 기반 테마 (앱 시작 시 고정, 실시간 변경 원한다면 Timer 추가)
  late MapTimeTheme _timeTheme;

  // Phase 3: 테마 전환 애니메이션
  late AnimationController _themeCtrl;
  MapTimeTheme? _prevTheme;

  // Phase 6: 드래그 가능 바텀 패널
  late AnimationController _panelCtrl;
  late Animation<double> _panelAnim;
  bool _isPanelExpanded = false;

  VectorTileLayer? _vectorTileLayer;
  static const _initialCameraTarget = ll.LatLng(37.4979, 127.0276);

  final _random = math.Random(42);
  final List<double> _markerPhaseOffsets = [];

  // Phase 4: 현재 표시 중인 videos 캐시 (Dismiss 후 제외하기 위함)
  List<dynamic> _dismissedIndices = [];

  // Phase 7: 글래스모피즘 공간 필터 상태
  String _selectedCategory = '전체';
  final List<String> _categories = ['전체', '고기/구이', '오마카세', '해산물', '카페/디저트', '일식'];

  // Phase 2: 인라인 비디오 오버레이
  OverlayEntry? _previewOverlay;

  @override
  void initState() {
    super.initState();
    _timeTheme = MapTimeTheme.fromHour(DateTime.now().hour);

    _pageController = PageController(viewportFraction: 0.88);
    _fadeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _fadeAnimation =
        CurvedAnimation(parent: _fadeController, curve: Curves.easeOut);

    _themeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..value = 1.0;

    // Phase 6: Panel drag
    _panelCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
    _panelAnim = CurvedAnimation(parent: _panelCtrl, curve: Curves.easeOutCubic);

    _initVectorMap();
  }

  Future<void> _initVectorMap() async {
    // Protomaps Vector tiles often crash Flutter Web CanvasKit.
    // We will use the CartoDB Dark raster tiles instead.
  }

  @override
  void dispose() {
    _previewOverlay?.remove();
    _pageController.dispose();
    _fadeController.dispose();
    _themeCtrl.dispose();
    _panelCtrl.dispose();
    _mapController.dispose();
    super.dispose();
  }

  void _showVideoPreview(dynamic video, Offset markerOffset, Size markerSize, int pageIndex) {
    if (_previewOverlay != null) return;

    _previewOverlay = OverlayEntry(
      builder: (context) {
        return SpatialVideoPreview(
          video: video,
          markerOffset: markerOffset,
          markerSize: markerSize,
          onClose: () {
            _previewOverlay?.remove();
            _previewOverlay = null;
          },
          onDetailsTap: () {
            // 해당 페이지로 이동 후 0.3초 뒤 바텀 시트 열기 (자연스러운 전환)
            _pageController.animateToPage(
              pageIndex,
              duration: const Duration(milliseconds: 350),
              curve: Curves.easeOutCubic,
            );
            Future.delayed(const Duration(milliseconds: 300), () {
              if (!mounted) return;
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (_) => DetailBottomSheet(videoId: video.id),
              );
            });
          },
        );
      },
    );

    Overlay.of(context).insert(_previewOverlay!);
  }

  double _getPhaseOffset(int index) {
    while (_markerPhaseOffsets.length <= index) {
      _markerPhaseOffsets.add(_random.nextDouble());
    }
    return _markerPhaseOffsets[index];
  }

  void _togglePanel() {
    setState(() => _isPanelExpanded = !_isPanelExpanded);
    if (_isPanelExpanded) {
      _panelCtrl.forward();
    } else {
      _panelCtrl.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final videoListAsync = ref.watch(videoListProvider);
    final screenH = MediaQuery.of(context).size.height;

    ref.listen(videoListProvider, (prev, next) {
      if (next.hasValue && next.value != null) {
        _fadeController.forward(from: 0.0);
      }
    });

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // ── L1: 지도 ──
          _buildMapLayer(videoListAsync),

          // ── L2: 상단 그라데이션 (Phase 3 테마 반영) ──
          Positioned(
            top: 0, left: 0, right: 0, height: 150,
            child: IgnorePointer(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 900),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [_timeTheme.skyTop, Colors.transparent],
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                  ),
                ),
              ),
            ),
          ),

          // ── L3: 상단 HUD (Phase 3 시간 배지 + 트렌드 다이얼) ──
          Positioned(
            top: 56, left: 20, right: 20,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Phase 3: 시간대 배지
                _buildTimeBadge(),
                const TrendDialButton(),
              ],
            ),
          ),

          // ── Phase 7: 글래스모피즘 공간 필터 ──
          Positioned(
            top: 112,
            left: 20,
            right: 0,
            child: SizedBox(
              height: 52,
              child: SpatialFilterBar(
                categories: _categories,
                selectedCategory: _selectedCategory,
                onCategorySelected: (cat) {
                  setState(() => _selectedCategory = cat);
                  // TODO: 실제 필터링 로직 구현 (현재는 UI 시뮬레이션)
                  // 필터링 시 모든 마커가 날아갔다 다시 오는 물리 효과를 연출하기 위해
                  // provider를 갱신하거나 opacity 애니메이션 트리거
                  _fadeController.reverse().then((_) {
                    _fadeController.forward();
                  });
                },
              ),
            ),
          ),

          // ── L4: Phase 6 리퀴드 바텀 패널 ──
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: _buildLiquidBottomPanel(videoListAsync, screenH),
          ),

          // ── L5: Phase 6 패널 드래그 핸들 ──
          Positioned(
            bottom: _panelBaseHeight(screenH) + 8,
            left: 0, right: 0,
            child: GestureDetector(
              onVerticalDragEnd: (d) {
                if (d.velocity.pixelsPerSecond.dy < -300) {
                  if (!_isPanelExpanded) _togglePanel();
                } else if (d.velocity.pixelsPerSecond.dy > 300) {
                  if (_isPanelExpanded) _togglePanel();
                }
              },
              onTap: _togglePanel,
              child: Center(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  width: _isPanelExpanded ? 40 : 60,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Phase 3: 시간대 배지 ──
  Widget _buildTimeBadge() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 900),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: _timeTheme.cardBg.withOpacity(0.85),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: _timeTheme.accentColor.withOpacity(0.3), width: 1),
        boxShadow: [
          BoxShadow(
              color: _timeTheme.accentColor.withOpacity(0.15),
              blurRadius: 12,
              spreadRadius: 1),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(_timeTheme.emoji, style: const TextStyle(fontSize: 14)),
          const SizedBox(width: 6),
          Text(
            '${_timeTheme.name} · ${DateTime.now().hour.toString().padLeft(2,'0')}:${DateTime.now().minute.toString().padLeft(2,'0')}',
            style: TextStyle(
              color: _timeTheme.accentColor,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  // ── Phase 6 패널 기본 높이 계산 ──
  double _panelBaseHeight(double screenH) => screenH * 0.30;
  double _panelExpandedHeight(double screenH) => screenH * 0.55;

  // ── Phase 6: 리퀴드 바텀 패널 ──
  Widget _buildLiquidBottomPanel(
      AsyncValue<List<dynamic>> videoListAsync, double screenH) {
    return AnimatedBuilder(
      animation: _panelAnim,
      builder: (context, child) {
        final base = _panelBaseHeight(screenH);
        final expanded = _panelExpandedHeight(screenH);
        final h = base + (expanded - base) * _panelAnim.value;

        return SizedBox(
          height: h,
          child: Column(
            children: [
              // ── Liquid Fade Connector (Phase 6) ──
              SizedBox(
                height: 72,
                child: IgnorePointer(
                  child: Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.transparent, _timeTheme.cardBg],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        stops: const [0.0, 0.85],
                      ),
                    ),
                  ),
                ),
              ),
              // ── Card Area ──
              Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 900),
                  color: _timeTheme.cardBg,
                  child: child,
                ),
              ),
            ],
          ),
        );
      },
      child: _buildCardArea(videoListAsync),
    );
  }

  Widget _buildCardArea(AsyncValue<List<dynamic>> videoListAsync) {
    return videoListAsync.when(
      data: (allVideos) {
        final videos = allVideos
            .whereType<dynamic>()
            .toList()
            .asMap()
            .entries
            .where((e) => !_dismissedIndices.contains(e.key))
            .map((e) => e.value)
            .toList();

        if (videos.isEmpty) {
          return Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white10),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.search_off, color: Colors.white54),
                  SizedBox(width: 10),
                  Text('필터에 해당하는 맛집이 없습니다',
                      style: TextStyle(color: Colors.white, fontSize: 15)),
                ],
              ),
            ),
          );
        }

        return FadeTransition(
          opacity: _fadeAnimation,
          child: PageView.builder(
            controller: _pageController,
            itemCount: videos.length,
            onPageChanged: (index) {
              ref.read(currentCardIndexProvider.notifier).state = index;
              final v = videos[index];
              _mapController.move(ll.LatLng(v.lat, v.lng), 15.5);
            },
            itemBuilder: (_, index) {
              final video = videos[index];
              return GestureCard(
                key: ValueKey('card_${video.id}'),
                video: video,
                theme: _timeTheme,
                onTap: () => DetailBottomSheet.show(context, video.id),
                onDismiss: () {
                  // Phase 4: 패스 처리
                  final originalIdx = allVideos.indexWhere((v) => v.id == video.id);
                  if (originalIdx != -1) {
                    setState(() {
                      _dismissedIndices = [..._dismissedIndices, originalIdx];
                    });
                  }
                },
              );
            },
          ),
        );
      },
      loading: () => PageView(
        controller: PageController(viewportFraction: 0.88),
        children: const [ShimmerCard(), ShimmerCard()],
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  Widget _buildMapLayer(AsyncValue<List<dynamic>> videoListAsync) {
    final selectedIdx = ref.watch(currentCardIndexProvider);

    return FlutterMap(
      mapController: _mapController,
      options: const MapOptions(
        initialCenter: _initialCameraTarget,
        initialZoom: 15.0,
      ),
      children: [
        TileLayer(
          urlTemplate:
              'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          subdomains: const ['a', 'b', 'c', 'd'],
          userAgentPackageName: 'com.example.harness_map',
        ),
        videoListAsync.when(
          data: (allVideos) {
            final videos = allVideos
                .asMap()
                .entries
                .where((e) => !_dismissedIndices.contains(e.key))
                .toList();
            final markers = List.generate(videos.length, (i) {
              final entry = videos[i];
              final video = entry.value;
              final isSelected = selectedIdx == i;
              return Marker(
                point: ll.LatLng(video.lat, video.lng),
                width: 64,
                height: 64,
                child: LivingMarker(
                  key: ValueKey('marker_${video.id}'),
                  isSelected: isSelected,
                  pulsePhaseOffset: _getPhaseOffset(entry.key),
                  energyLevel: computeEnergyLevel(video.trendTags.length),
                  onLongPress: (offset, size) => _showVideoPreview(video, offset, size, i),
                  onTap: () => _pageController.animateToPage(i,
                      duration: const Duration(milliseconds: 350),
                      curve: Curves.easeOutCubic),
                ),
              );
            });
            return MarkerLayer(markers: markers);
          },
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),
      ],
    );
  }
}

/// Phase 1: Living Marker 에너지 레벨 계산
/// 태그 개수가 많을수록(트렌디할수록) 마커가 더 강하게 박동한다. (0~3 레벨)
int computeEnergyLevel(int tagCount) {
  if (tagCount >= 3) return 3; // Ultra High
  if (tagCount >= 2) return 2; // High
  if (tagCount >= 1) return 1; // Medium
  return 0; // Idle
}
