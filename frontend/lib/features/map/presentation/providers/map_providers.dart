// path: lib/features/map/presentation/providers/map_providers.dart

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/video_model.dart';
import '../../data/repositories/map_repository.dart';

// ---------------------------------------------------------------------------
// 0. Repository Provider — DI 레이어
// ---------------------------------------------------------------------------
final mapRepositoryProvider = Provider<MapRepository>((ref) {
  return MapRepository();
});

// ---------------------------------------------------------------------------
// 1. 트렌드 다이얼 필터 상태
// ---------------------------------------------------------------------------
final selectedTrendProvider = StateProvider<String?>((ref) => null);

// ---------------------------------------------------------------------------
// 2. 스와이프 뷰 현재 카드 인덱스
// ---------------------------------------------------------------------------
final currentCardIndexProvider = StateProvider<int>((ref) => 0);

// ---------------------------------------------------------------------------
// 3. 비디오 리스트 Provider
// ---------------------------------------------------------------------------
final videoListProvider = FutureProvider<List<VideoData>>((ref) async {
  final repository = ref.watch(mapRepositoryProvider);
  final selectedTrend = ref.watch(selectedTrendProvider);
  return repository.fetchNearbyVideos(trend: selectedTrend);
});

// ---------------------------------------------------------------------------
// 4. 비디오 상세 Provider (Family — videoId별 캐싱)
//    바텀시트에서 사용. 카드 탭 시 videoId를 인자로 전달.
// ---------------------------------------------------------------------------
final videoDetailProvider =
    FutureProvider.family<VideoDetail?, String>((ref, videoId) async {
  final repository = ref.watch(mapRepositoryProvider);
  return repository.fetchVideoDetail(videoId);
});

// ---------------------------------------------------------------------------
// 5. 카테고리 목록 Provider — 동적 다이얼 메뉴 구성
// ---------------------------------------------------------------------------
final categoriesProvider = FutureProvider<List<CategoryItem>>((ref) async {
  final repository = ref.watch(mapRepositoryProvider);
  return repository.fetchCategories();
});
