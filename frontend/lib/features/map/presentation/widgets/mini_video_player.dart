// path: lib/features/map/presentation/widgets/mini_video_player.dart

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

/// 숏폼 비디오 자동 재생 위젯.
/// 스와이프 카드 배경으로 사용되며, 무음 루프 재생이 기본이다.
class MiniVideoPlayer extends StatefulWidget {
  final String videoUrl;
  final bool autoPlay;

  const MiniVideoPlayer({
    super.key,
    required this.videoUrl,
    this.autoPlay = false,
  });

  @override
  State<MiniVideoPlayer> createState() => _MiniVideoPlayerState();
}

class _MiniVideoPlayerState extends State<MiniVideoPlayer> {
  late VideoPlayerController _controller;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.videoUrl))
      ..initialize().then((_) {
        if (!mounted) return;
        setState(() => _initialized = true);
        _controller.setLooping(true);
        _controller.setVolume(0.0); // 배경 영상은 기본 무음
        if (widget.autoPlay) _controller.play();
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized) {
      return Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(
            color: Colors.white54,
            strokeWidth: 2,
          ),
        ),
      );
    }
    return SizedBox.expand(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: _controller.value.size.width,
          height: _controller.value.size.height,
          child: VideoPlayer(_controller),
        ),
      ),
    );
  }
}
