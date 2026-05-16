// path: lib/features/map/presentation/widgets/trend_dial_button.dart

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/map_providers.dart';

/// 우측 상단 트렌드 필터 다이얼 버튼.
/// selectedTrendProvider를 조작하여 videoListProvider를 자동 재빌드한다.
class TrendDialButton extends ConsumerWidget {
  const TrendDialButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedTrend = ref.watch(selectedTrendProvider);
    final isActive = selectedTrend != null;

    return PopupMenuButton<String>(
      offset: const Offset(0, 56),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      color: const Color(0xFF1E1E2C),
      onSelected: (value) {
        ref.read(selectedTrendProvider.notifier).state =
            value == '__reset__' ? null : value;
      },
      itemBuilder: (_) => [
        _buildItem('방어', '🐟 겨울 제철 방어', selectedTrend),
        _buildItem('마라', '🔥 핫 트렌드 마라', selectedTrend),
        _buildItem('삼겹살', '🥓 직장인 회식', selectedTrend),
        _buildItem('오마카세', '🍣 데이트 오마카세', selectedTrend),
        _buildItem('양꼬치', '🐑 야식 양꼬치', selectedTrend),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: '__reset__',
          child: Text(
            '🔄 필터 초기화',
            style: TextStyle(color: Colors.redAccent),
          ),
        ),
      ],
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isActive ? Colors.deepPurpleAccent : const Color(0xFF1E1E2C),
          shape: BoxShape.circle,
          border: Border.all(
            color: isActive ? Colors.deepPurpleAccent : Colors.white24,
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: isActive
                  ? Colors.deepPurpleAccent.withOpacity(0.5)
                  : Colors.black45,
              blurRadius: 12,
              spreadRadius: 2,
            ),
          ],
        ),
        child: const Icon(Icons.tune, color: Colors.white, size: 26),
      ),
    );
  }

  PopupMenuItem<String> _buildItem(
    String value,
    String label,
    String? current,
  ) {
    final isSelected = current == value;
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.deepPurpleAccent : Colors.white,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
            ),
          ),
          if (isSelected)
            const Icon(Icons.check, color: Colors.deepPurpleAccent, size: 18),
        ],
      ),
    );
  }
}
