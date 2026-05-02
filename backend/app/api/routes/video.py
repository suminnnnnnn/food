# path: backend/app/api/routes/video.py
from fastapi import APIRouter, Query, HTTPException, Depends
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.video_schema import VideoData, VideoDetail, CategoryItem
from app.services import map_service

router = APIRouter()


@router.get("/nearby", response_model=List[VideoData])
async def nearby_videos(
    lat: float = Query(37.4979, description="중심 위도 (기본: 강남역)"),
    lng: float = Query(127.0276, description="중심 경도 (기본: 강남역)"),
    radius: int = Query(2000, description="검색 반경 (미터)"),
    trend: Optional[str] = Query(None, description="트렌드 다이얼 필터 태그"),
    db: AsyncSession = Depends(get_db),
):
    """
    현재 지도 중앙 좌표 기준, 반경 내 맛집 비디오를 거리순으로 반환합니다.
    trend 파라미터를 전달하면 해당 트렌드 태그가 포함된 맛집만 필터링됩니다.
    """
    return await map_service.get_nearby_videos(db, lat, lng, radius, trend)


@router.get("/categories", response_model=List[CategoryItem])
async def list_categories(db: AsyncSession = Depends(get_db)):
    """
    전체 카테고리 목록과 각 카테고리별 맛집 개수를 반환합니다.
    트렌드 다이얼의 동적 메뉴 구성에 사용됩니다.
    """
    return await map_service.get_all_categories(db)


@router.get("/{video_id}", response_model=VideoDetail)
async def video_detail(video_id: str, db: AsyncSession = Depends(get_db)):
    """
    특정 비디오의 상세 정보를 반환합니다.
    SwipeVideoCard 탭 시 바텀시트에 표시할 데이터를 제공합니다.
    """
    result = await map_service.get_video_by_id(db, video_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Video {video_id} not found")
    return result
