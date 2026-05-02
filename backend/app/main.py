# path: backend/app/main.py
import logging
import time
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import video

# 구조화 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("harness-map")

app = FastAPI(
    title="Harness Map API",
    description=(
        "🗺️ 맛집 비디오 지도 앱 REST API\n\n"
        "유튜버의 맛집 리뷰 영상을 지도 위에서 탐색하고, "
        "트렌드 다이얼로 제철 음식과 인기 맛집을 필터링합니다."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — Flutter 앱에서의 접근 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── 요청 로깅 미들웨어 ──
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = round((time.time() - start) * 1000, 1)
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} ({elapsed}ms)"
    )
    return response


# ── 글로벌 예외 핸들러 ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc),
            "path": str(request.url.path),
        },
    )


app.include_router(video.router, prefix="/api/videos", tags=["videos"])


@app.get("/health", tags=["system"])
async def health_check():
    """서버 상태 확인. 프론트엔드 연결 테스트에 사용."""
    return {"status": "ok", "service": "harness-map-api", "version": "2.0.0"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8080, reload=True)
