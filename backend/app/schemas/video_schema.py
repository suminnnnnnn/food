# path: backend/app/schemas/video_schema.py
from pydantic import BaseModel
from typing import List, Optional


class Location(BaseModel):
    lat: float
    lng: float


class VideoData(BaseModel):
    id: str
    restaurant_name: str
    youtuber_name: str
    video_url: str
    thumbnail_url: str
    trend_tags: List[str]
    location: Location
    distance_m: Optional[float] = None
    reservation_url: Optional[str] = None
    platform_type: Optional[str] = None


class VideoDetail(BaseModel):
    """상세 바텀시트용 — VideoData + 추가 필드."""
    id: str
    restaurant_name: str
    address: str
    category: str
    youtuber_name: str
    video_url: str
    thumbnail_url: str
    description: str
    trend_tags: List[str]
    location: Location
    distance_m: Optional[float] = None
    reservation_url: Optional[str] = None
    platform_type: Optional[str] = None


class CategoryItem(BaseModel):
    """카테고리 목록 — 다이얼 동적 메뉴용."""
    tag: str
    label: str
    count: int
