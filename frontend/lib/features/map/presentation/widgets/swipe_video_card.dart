import 'dart:ui';
import 'package:flutter/material.dart';
import '../../data/models/video_model.dart';
import 'mini_video_player.dart';

/// 프리미엄 글래스모피즘 스와이프 비디오 카드.
class SwipeVideoCard extends StatelessWidget {
  final VideoData video;

  const SwipeVideoCard({super.key, required this.video});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 15),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.6),
            blurRadius: 25,
            spreadRadius: 2,
            offset: const Offset(0, 12),
          ),
          BoxShadow(
            color: Colors.deepPurpleAccent.withOpacity(0.15),
            blurRadius: 40,
            spreadRadius: -5,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(28),
        child: Stack(
          children: [
            // ── Background Video ──
            MiniVideoPlayer(videoUrl: video.videoUrl, autoPlay: true),

            // ── Glassmorphism Overlay (Bottom) ──
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: ClipRect(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(20, 30, 20, 24),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.black.withOpacity(0.0),
                          Colors.black.withOpacity(0.8),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                      border: Border(
                        top: BorderSide(color: Colors.white.withOpacity(0.1), width: 0.5),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Restaurant Name with Neon Glow
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: Colors.amber.withOpacity(0.2),
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.amber.withOpacity(0.4),
                                    blurRadius: 8,
                                    spreadRadius: 1,
                                  ),
                                ],
                              ),
                              child: const Icon(Icons.location_on, color: Colors.amber, size: 16),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                video.restaurantName,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.5,
                                  shadows: [
                                    Shadow(color: Colors.black54, blurRadius: 4, offset: Offset(0, 2)),
                                  ],
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),

                        // YouTuber & Distance
                        Row(
                          children: [
                            Text(
                              '@${video.youtuberName}',
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.8),
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            if (video.distanceM != null) ...[
                              const SizedBox(width: 12),
                              Container(
                                width: 3,
                                height: 3,
                                decoration: BoxDecoration(color: Colors.white38, shape: BoxShape.circle),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                '${video.distanceM!.toInt()}m',
                                style: const TextStyle(color: Colors.white38, fontSize: 14),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Tags with Neon Accent
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: video.trendTags.map((tag) {
                            return Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                              decoration: BoxDecoration(
                                color: Colors.deepPurpleAccent.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(color: Colors.deepPurpleAccent.withOpacity(0.4), width: 1),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.deepPurpleAccent.withOpacity(0.1),
                                    blurRadius: 4,
                                    spreadRadius: 0,
                                  ),
                                ],
                              ),
                              child: Text(
                                '#$tag',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ── Premium Card Border Glow ──
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: Colors.white.withOpacity(0.08), width: 1.5),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
