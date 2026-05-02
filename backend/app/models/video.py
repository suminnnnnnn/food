# path: backend/app/models/video.py
import uuid
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import String, Text, ForeignKey, Integer, BigInteger, DateTime, Date, func, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from app.core.database import Base

class Youtuber(Base):
    __tablename__ = "youtubers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    channel_name: Mapped[str] = mapped_column(String(100), nullable=False)
    profile_image_url: Mapped[Optional[str]] = mapped_column(Text)
    tier: Mapped[Optional[str]] = mapped_column(String(20))
    persona_tags: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    videos: Mapped[List["HarnessVideo"]] = relationship(back_populates="youtuber")

class HarnessRestaurant(Base):
    __tablename__ = "harness_restaurants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kakao_place_id: Mapped[Optional[str]] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))
    location: Mapped[any] = mapped_column(Geometry("POINT", srid=4326))
    total_heart_count: Mapped[int] = mapped_column(Integer, default=0)
    reservation_url: Mapped[Optional[str]] = mapped_column(Text)
    platform_type: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    videos: Mapped[List["HarnessVideo"]] = relationship(back_populates="restaurant")

class HarnessVideo(Base):
    __tablename__ = "harness_videos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    youtuber_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("youtubers.id"))
    restaurant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("harness_restaurants.id"))
    video_url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[Optional[str]] = mapped_column(Text)
    view_count: Mapped[Optional[int]] = mapped_column(Integer)
    upload_date: Mapped[Optional[date]] = mapped_column(Date)
    seasonal_tags: Mapped[Optional[List[str]]] = mapped_column(ARRAY(String))
    menu_items: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    youtuber: Mapped["Youtuber"] = relationship(back_populates="videos")
    restaurant: Mapped["HarnessRestaurant"] = relationship(back_populates="videos")
