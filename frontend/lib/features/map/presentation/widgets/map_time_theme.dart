import 'dart:ui';
import 'package:flutter/material.dart';

/// Phase 3: 시간 인식 지도 분위기 제어
/// 현재 시각에 따라 지도 UI 팔레트와 분위기가 자동으로 변경된다.
class MapTimeTheme {
  final String name;
  final Color skyTop;         // 상단 그라데이션
  final Color skyBottom;      // 카드 영역 배경
  final Color cardBg;         // 카드 배경
  final Color accentColor;    // 강조색 (마커 글로우에도 반영)
  final String emoji;

  const MapTimeTheme({
    required this.name,
    required this.skyTop,
    required this.skyBottom,
    required this.cardBg,
    required this.accentColor,
    required this.emoji,
  });

  static MapTimeTheme fromHour(int hour) {
    if (hour >= 5 && hour < 10) return dawn;
    if (hour >= 10 && hour < 17) return day;
    if (hour >= 17 && hour < 20) return dusk;
    return night;
  }

  static const dawn = MapTimeTheme(
    name: '새벽',
    emoji: '🌅',
    skyTop: Color(0xDD0D1B3E),
    skyBottom: Color(0xFF0A0F1F),
    cardBg: Color(0xF00A0F1F),
    accentColor: Color(0xFF7FBEFC),
  );

  static const day = MapTimeTheme(
    name: '낮',
    emoji: '☀️',
    skyTop: Color(0xDD0B1426),
    skyBottom: Color(0xFF080D18),
    cardBg: Color(0xF0080D18),
    accentColor: Color(0xFF64D2FF),
  );

  static const dusk = MapTimeTheme(
    name: '황혼',
    emoji: '🌆',
    skyTop: Color(0xDD1A0830),
    skyBottom: Color(0xFF120520),
    cardBg: Color(0xF0120520),
    accentColor: Color(0xFFCB5EFF),
  );

  static const night = MapTimeTheme(
    name: '야간',
    emoji: '🌙',
    skyTop: Color(0xDD050010),
    skyBottom: Color(0xFF050510),
    cardBg: Color(0xF0050510),
    accentColor: Color(0xFF00E5FF),
  );
}
