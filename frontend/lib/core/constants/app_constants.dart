// path: lib/core/constants/app_constants.dart

import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

/// 앱 전역 상수.
/// 백엔드 서버 URL은 환경에 따라 변경한다.
class AppConstants {
  AppConstants._();

  /// 백엔드 API 기본 URL
  static String get apiBaseUrl {
    if (kIsWeb) return 'http://localhost:8080';
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:8080';
    } catch (_) {}
    return 'http://localhost:8080';
  }

  /// 기본 검색 반경 (미터)
  static const int defaultRadius = 2000;

  /// 기본 중심 좌표 (강남역)
  static const double defaultLat = 37.4979;
  static const double defaultLng = 127.0276;
}
