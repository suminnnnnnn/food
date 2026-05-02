// path: lib/features/map/data/models/video_model.dart

/// 맛집 비디오 데이터 모델.
/// API 응답의 snake_case 키를 Dart의 camelCase로 매핑한다.
///
/// 경계면 계약 (api-engineer ↔ flutter-architect):
///   API JSON key         → Dart field
///   restaurant_name      → restaurantName
///   youtuber_name        → youtuberName
///   video_url            → videoUrl
///   thumbnail_url        → thumbnailUrl
///   trend_tags           → trendTags
///   location.lat         → lat
///   location.lng         → lng
///   distance_m           → distanceM
class VideoData {
  final String id;
  final String restaurantName;
  final String youtuberName;
  final String videoUrl;
  final String thumbnailUrl;
  final List<String> trendTags;
  final double lat;
  final double lng;
  final double? distanceM;
  final String? reservationUrl;
  final String? platformType;

  const VideoData({
    required this.id,
    required this.restaurantName,
    required this.youtuberName,
    required this.videoUrl,
    required this.thumbnailUrl,
    required this.trendTags,
    required this.lat,
    required this.lng,
    this.distanceM,
    this.reservationUrl,
    this.platformType,
  });

  factory VideoData.fromJson(Map<String, dynamic> json) {
    return VideoData(
      id: json['id'] as String,
      restaurantName: json['restaurant_name'] as String,
      youtuberName: json['youtuber_name'] as String,
      videoUrl: json['video_url'] as String,
      thumbnailUrl: json['thumbnail_url'] as String,
      trendTags: List<String>.from(json['trend_tags'] as List),
      lat: (json['location']['lat'] as num).toDouble(),
      lng: (json['location']['lng'] as num).toDouble(),
      distanceM: json['distance_m'] != null
          ? (json['distance_m'] as num).toDouble()
          : null,
      reservationUrl: json['reservation_url'] as String?,
      platformType: json['platform_type'] as String?,
    );
  }
}

class VideoDetail {
  final String id;
  final String restaurantName;
  final String address;
  final String category;
  final String youtuberName;
  final String videoUrl;
  final String thumbnailUrl;
  final String description;
  final List<String> trendTags;
  final double lat;
  final double lng;
  final double? distanceM;
  final String? reservationUrl;
  final String? platformType;

  const VideoDetail({
    required this.id,
    required this.restaurantName,
    required this.address,
    required this.category,
    required this.youtuberName,
    required this.videoUrl,
    required this.thumbnailUrl,
    required this.description,
    required this.trendTags,
    required this.lat,
    required this.lng,
    this.distanceM,
    this.reservationUrl,
    this.platformType,
  });

  factory VideoDetail.fromJson(Map<String, dynamic> json) {
    return VideoDetail(
      id: json['id'] as String,
      restaurantName: json['restaurant_name'] as String,
      address: json['address'] as String,
      category: json['category'] as String,
      youtuberName: json['youtuber_name'] as String,
      videoUrl: json['video_url'] as String,
      thumbnailUrl: json['thumbnail_url'] as String,
      description: json['description'] as String,
      trendTags: List<String>.from(json['trend_tags'] as List),
      lat: (json['location']['lat'] as num).toDouble(),
      lng: (json['location']['lng'] as num).toDouble(),
      distanceM: json['distance_m'] != null
          ? (json['distance_m'] as num).toDouble()
          : null,
      reservationUrl: json['reservation_url'] as String?,
      platformType: json['platform_type'] as String?,
    );
  }
}


/// 카테고리 아이템 — 동적 다이얼 메뉴용.
class CategoryItem {
  final String tag;
  final String label;
  final int count;

  const CategoryItem({
    required this.tag,
    required this.label,
    required this.count,
  });

  factory CategoryItem.fromJson(Map<String, dynamic> json) {
    return CategoryItem(
      tag: json['tag'] as String,
      label: json['label'] as String,
      count: json['count'] as int,
    );
  }
}
