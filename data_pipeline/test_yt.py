import sys
import json
from extractors.youtube_extractor import get_best_youtube_video

def test_search():
    query = "나주 송현불고기 맛집"
    print(f"Searching for: {query}")
    video = get_best_youtube_video(query)
    if video:
        print("Success! Found video:")
        print(json.dumps(video, indent=2, ensure_ascii=False))
    else:
        print("Failed to find video.")

if __name__ == "__main__":
    test_search()
