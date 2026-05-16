# path: backend/app/services/map_service.py
from typing import List, Optional
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from app.models.video import HarnessVideo, HarnessRestaurant, Youtuber
from app.schemas.video_schema import VideoData, VideoDetail, CategoryItem, Location
from geoalchemy2.functions import ST_DWithin, ST_Distance, ST_SetSRID, ST_MakePoint

# 트렌드 태그 라벨 매핑 (UI 표시용)
_TAG_LABELS = {
    "방어": "🐟 겨울 제철 방어",
    "겨울": "❄️ 겨울 메뉴",
    "제철": "🌿 제철 음식",
    "마라": "🔥 핫 트렌드 마라",
    "매운맛": "🌶️ 매운맛 탐험",
    "트렌드": "📈 요즘 뜨는 곳",
    "삼겹살": " Bacon 직장인 회식",
    "회식": "🍻 회식 맛집",
    "오마카세": "🍣 데이트 오마카세",
    "데이트": "💕 데이트 코스",
    "양꼬치": "🐑 야식 양꼬치",
    "야식": "🌙 야식 맛집",
}

async def get_nearby_videos(
    db: AsyncSession,
    lat: float,
    lng: float,
    radius: int,
    trend: Optional[str] = None,
) -> List[VideoData]:
    """반경 내 비디오를 DB에서 공간 쿼리로 조회하여 반환."""
    point = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    
    # 쿼리 빌드
    stmt = (
        select(HarnessVideo)
        .options(joinedload(HarnessVideo.restaurant), joinedload(HarnessVideo.youtuber))
        .join(HarnessRestaurant)
        .where(ST_DWithin(HarnessRestaurant.location, point, radius))
    )

    if trend:
        stmt = stmt.where(HarnessRestaurant.category == trend)

    # 거리 계산 및 좌표 추출 포함
    stmt = stmt.add_columns(
        ST_Distance(HarnessRestaurant.location, point).label("distance"),
        func.ST_Y(HarnessRestaurant.location).label("lat"),
        func.ST_X(HarnessRestaurant.location).label("lng")
    ).order_by("distance")
    
    result = await db.execute(stmt)
    rows = result.all()

    return [
        VideoData(
            id=str(row[0].id),
            restaurant_name=row[0].restaurant.name,
            youtuber_name=row[0].youtuber.channel_name if row[0].youtuber else "알 수 없음",
            video_url=row[0].video_url,
            thumbnail_url="https://picsum.photos/400/600",
            trend_tags=row[0].seasonal_tags or [],
            location=Location(
                lat=row.lat, 
                lng=row.lng
            ),
            distance_m=row.distance,
            reservation_url=row[0].restaurant.reservation_url,
            platform_type=row[0].restaurant.platform_type
        )
        for row in rows
    ]

async def get_video_by_id(db: AsyncSession, video_id: str) -> Optional[VideoDetail]:
    """특정 비디오의 상세 정보를 DB에서 조회."""
    stmt = (
        select(HarnessVideo)
        .options(joinedload(HarnessVideo.restaurant), joinedload(HarnessVideo.youtuber))
        .join(HarnessRestaurant)
        .where(HarnessVideo.id == video_id)
        .add_columns(
            func.ST_Y(HarnessRestaurant.location).label("lat"),
            func.ST_X(HarnessRestaurant.location).label("lng")
        )
    )
    result = await db.execute(stmt)
    row = result.fetchone()
    
    if not row:
        return None

    v = row[0]
    return VideoDetail(
        id=str(v.id),
        restaurant_name=v.restaurant.name,
        address=v.restaurant.address,
        category=v.restaurant.category,
        youtuber_name=v.youtuber.channel_name if v.youtuber else "알 수 없음",
        video_url=v.video_url,
        thumbnail_url="https://picsum.photos/400/600",
        description=v.title or "설명이 없습니다.",
        trend_tags=v.seasonal_tags or [],
        location=Location(lat=row.lat, lng=row.lng),
        reservation_url=v.restaurant.reservation_url,
        platform_type=v.restaurant.platform_type
    )

async def get_all_categories(db: AsyncSession) -> List[CategoryItem]:
    """DB에 등록된 식당들의 카테고리를 집계하여 반환."""
    stmt = select(HarnessRestaurant.category, func.count(HarnessRestaurant.id)).group_by(HarnessRestaurant.category)
    result = await db.execute(stmt)
    rows = result.fetchall()

    return [
        CategoryItem(
            tag=row[0] or "기타",
            label=_TAG_LABELS.get(row[0], f"#{row[0] or '기타'}"),
            count=row[1],
        )
        for row in rows
    ]
