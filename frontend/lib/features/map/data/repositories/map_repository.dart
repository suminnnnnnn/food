// path: lib/features/map/data/repositories/map_repository.dart

import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../../core/constants/app_constants.dart';
import '../models/video_model.dart';

/// 백엔드 API와 통신하는 Repository.
/// Provider에서 이 클래스를 호출하여 데이터 소스를 추상화한다.
/// 네트워크 실패 시 폴백 Mock 데이터를 자동 반환한다 (Graceful Degradation).
class MapRepository {
  final http.Client _client;

  MapRepository({http.Client? client}) : _client = client ?? http.Client();

  /// 반경 내 맛집 비디오를 API에서 가져온다.
  Future<List<VideoData>> fetchNearbyVideos({
    double lat = AppConstants.defaultLat,
    double lng = AppConstants.defaultLng,
    int radius = AppConstants.defaultRadius,
    String? trend,
  }) async {
    final queryParams = {
      'lat': lat.toString(),
      'lng': lng.toString(),
      'radius': radius.toString(),
      if (trend != null) 'trend': trend,
    };

    final uri = Uri.parse('${AppConstants.apiBaseUrl}/api/videos/nearby')
        .replace(queryParameters: queryParams);

    try {
      final response = await _client.get(uri).timeout(
            const Duration(seconds: 10),
          );

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = json.decode(response.body) as List;
        return jsonList
            .map((json) => VideoData.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('API 오류: ${response.statusCode}');
      }
    } catch (e) {
      return _fallbackMockData(trend);
    }
  }

  /// 특정 비디오의 상세 정보를 가져온다. 바텀시트 UI용.
  Future<VideoDetail?> fetchVideoDetail(String videoId) async {
    final uri =
        Uri.parse('${AppConstants.apiBaseUrl}/api/videos/$videoId');

    try {
      final response = await _client.get(uri).timeout(
            const Duration(seconds: 10),
          );

      if (response.statusCode == 200) {
        return VideoDetail.fromJson(
            json.decode(response.body) as Map<String, dynamic>);
      }
      return null;
    } catch (e) {
      return _fallbackDetailData(videoId);
    }
  }

  /// 카테고리 목록을 가져온다. 동적 다이얼 메뉴용.
  Future<List<CategoryItem>> fetchCategories() async {
    final uri =
        Uri.parse('${AppConstants.apiBaseUrl}/api/videos/categories');

    try {
      final response = await _client.get(uri).timeout(
            const Duration(seconds: 10),
          );

      if (response.statusCode == 200) {
        final List<dynamic> jsonList = json.decode(response.body) as List;
        return jsonList
            .map((json) =>
                CategoryItem.fromJson(json as Map<String, dynamic>))
            .toList();
      }
      return _fallbackCategories();
    } catch (e) {
      return _fallbackCategories();
    }
  }

  // ── 폴백 데이터 ──

  List<VideoData> _fallbackMockData(String? trend) {
    const mockData = [
      VideoData(id: '1', restaurantName: '강남 제철방어 횟집', youtuberName: '먹방요정', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', thumbnailUrl: 'https://picsum.photos/400/600?random=1', trendTags: ['방어', '겨울', '제철'], lat: 37.4979, lng: 127.0276, distanceM: 0.0),
      VideoData(id: '2', restaurantName: '신논현 마라탕', youtuberName: '매운맛킬러', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', thumbnailUrl: 'https://picsum.photos/400/600?random=2', trendTags: ['마라', '매운맛', '트렌드'], lat: 37.5045, lng: 127.0240, distanceM: 820.5),
      VideoData(id: '3', restaurantName: '역삼동 흑돼지', youtuberName: '고기러버', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', thumbnailUrl: 'https://picsum.photos/400/600?random=3', trendTags: ['삼겹살', '회식'], lat: 37.4999, lng: 127.0350, distanceM: 680.2),
      VideoData(id: '4', restaurantName: '강남 스시오마카세', youtuberName: '스시왕', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', thumbnailUrl: 'https://picsum.photos/400/600?random=4', trendTags: ['오마카세', '데이트', '트렌드'], lat: 37.5010, lng: 127.0310, distanceM: 450.1),
      VideoData(id: '5', restaurantName: '논현 양꼬치', youtuberName: '야식탐험대', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', thumbnailUrl: 'https://picsum.photos/400/600?random=5', trendTags: ['양꼬치', '야식', '매운맛'], lat: 37.5060, lng: 127.0220, distanceM: 1050.3),
    ];
    if (trend != null) {
      return mockData.where((v) => v.trendTags.contains(trend)).toList();
    }
    return mockData;
  }

  VideoDetail? _fallbackDetailData(String videoId) {
    final details = {
      '1': const VideoDetail(id: '1', restaurantName: '강남 제철방어 횟집', address: '서울 강남구 역삼동 123-4', category: '해산물', youtuberName: '먹방요정', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', thumbnailUrl: 'https://picsum.photos/400/600?random=1', description: '강남역에서 만나는 역대급 겨울 대방어 해체쇼!', trendTags: ['방어', '겨울', '제철'], lat: 37.4979, lng: 127.0276),
      '2': const VideoDetail(id: '2', restaurantName: '신논현 마라탕', address: '서울 강남구 논현동 55-1', category: '중식', youtuberName: '매운맛킬러', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', thumbnailUrl: 'https://picsum.photos/400/600?random=2', description: '눈물 콧물 쏙 빼는 찐 마라탕 맛집.', trendTags: ['마라', '매운맛', '트렌드'], lat: 37.5045, lng: 127.0240),
    };
    return details[videoId];
  }

  List<CategoryItem> _fallbackCategories() {
    return const [
      CategoryItem(tag: '매운맛', label: '🌶️ 매운맛 탐험', count: 2),
      CategoryItem(tag: '트렌드', label: '📈 요즘 뜨는 곳', count: 2),
      CategoryItem(tag: '방어', label: '🐟 겨울 제철 방어', count: 1),
      CategoryItem(tag: '삼겹살', label: '🥓 직장인 회식', count: 1),
      CategoryItem(tag: '오마카세', label: '🍣 데이트 오마카세', count: 1),
      CategoryItem(tag: '양꼬치', label: '🐑 야식 양꼬치', count: 1),
    ];
  }
}
