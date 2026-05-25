import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getRestaurantById } from '@/lib/supabase/restaurants';

export const runtime = 'nodejs';

// 한글 폰트 Pretendard 로드 (satori 렌더링 무결성 확보)
async function loadPretendardFont() {
  try {
    const response = await fetch(
      new URL(
        'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.8/packages/pretendard/dist/public/static/Pretendard-Bold.otf'
      )
    );
    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch (e) {
    console.error('Pretendard 폰트 로드 실패, 시스템 폰트로 대체합니다:', e);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // 폰트 버퍼 확보
  const fontData = await loadPretendardFont();
  const fontOptions = fontData
    ? [{ name: 'Pretendard', data: fontData, style: 'normal' as const }]
    : [];

  try {
    let restaurant = null;
    if (id) {
      restaurant = await getRestaurantById(id);
    }

    // 1. 맛집 정보를 찾을 수 없는 경우 (기본 브랜드 OG 이미지)
    if (!restaurant) {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#121212', // Sleek Charcoal
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(255, 0, 68, 0.15) 0%, transparent 60%)',
              fontFamily: fontData ? 'Pretendard' : 'system-ui, sans-serif',
              padding: '60px',
              boxSizing: 'border-box',
              border: '4px solid rgba(255, 0, 68, 0.2)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 데코레이티브 그라데이션 라인 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '8px',
                background: 'linear-gradient(to right, #FF0044, #FF5E00)',
              }}
            />

            {/* 브랜드 심볼 마커 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100px',
                height: '100px',
                borderRadius: '30px',
                backgroundColor: '#FF0044',
                marginBottom: '30px',
                boxShadow: '0 0 30px rgba(255, 0, 68, 0.4)',
              }}
            >
              <span style={{ fontSize: '50px' }}>🍳</span>
            </div>

            {/* 브랜드 타이틀 */}
            <span
              style={{
                fontSize: '56px',
                fontWeight: '900',
                color: '#FFFFFF',
                marginBottom: '16px',
                letterSpacing: '-0.02em',
              }}
            >
              모두의 맛집
            </span>

            {/* 서브 브랜드 슬로건 */}
            <span
              style={{
                fontSize: '22px',
                color: '#A1A1AA',
                textAlign: 'center',
                maxWidth: '600px',
                lineHeight: '1.5',
              }}
            >
              유튜브 크리에이터들이 검증한 침샘 자극 진짜 맛집 지도!
              <br />
              광고 없는 리얼 미식 성지를 한눈에 확인해 보세요.
            </span>

            {/* 하단 트렌딩 이모지 데코 */}
            <div
              style={{
                display: 'flex',
                marginTop: '40px',
                gap: '20px',
              }}
            >
              <span style={{ fontSize: '24px', opacity: 0.8 }}>🔥 또간집</span>
              <span style={{ color: '#FF5E00', fontSize: '24px' }}>•</span>
              <span style={{ fontSize: '24px', opacity: 0.8 }}>🍷 성시경의 먹을텐데</span>
              <span style={{ color: '#FF5E00', fontSize: '24px' }}>•</span>
              <span style={{ fontSize: '24px', opacity: 0.8 }}>🥟 백종원의 님아 그 시장을 가오</span>
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
          fonts: fontOptions,
        }
      );
    }

    // 2. 개별 맛집 맞춤형 브랜드 OG 카드 합성 생성
    const primaryVideo = restaurant.videos?.[0];
    const creatorName = primaryVideo?.youtuber?.name || '크리에이터';
    const creatorProfile = primaryVideo?.youtuber?.profile_image || '';
    const thumbnailUrl = primaryVideo?.thumbnail || '';
    
    // 시리즈 정보 추출 (또간집, 먹을텐데 등)
    let seriesName = '인기 유튜브 추천 핫플';
    if (restaurant.content_tags && restaurant.content_tags.length > 0) {
      const youtubeTags = restaurant.content_tags.filter(
        t => t.source === 'ddoganjib' || t.source === 'meogeultende' || t.source === 'youtube'
      );
      if (youtubeTags.length > 0) {
        seriesName = youtubeTags[0].label;
      }
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#121212', // Sleek Charcoal
            backgroundImage: 'radial-gradient(circle at 10% 10%, rgba(255, 0, 68, 0.15) 0%, transparent 40%), radial-gradient(circle at 90% 90%, rgba(255, 94, 0, 0.1) 0%, transparent 40%)',
            fontFamily: fontData ? 'Pretendard' : 'system-ui, sans-serif',
            padding: '40px 60px',
            boxSizing: 'border-box',
            border: '3px solid rgba(255, 0, 68, 0.15)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 상단 시그니처 웜 오렌지 보더 스트립 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '6px',
              background: 'linear-gradient(to right, #FF0044, #FF5E00)',
            }}
          />

          {/* 좌측 콘텐츠 영역 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              width: '54%',
              zIndex: 10,
            }}
          >
            {/* 로고 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#FF0044',
                  marginRight: '12px',
                  boxShadow: '0 0 10px rgba(255, 0, 68, 0.4)',
                }}
              >
                <span style={{ fontSize: '20px' }}>🍳</span>
              </div>
              <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#FF5E00', letterSpacing: '0.02em' }}>
                모두의 맛집
              </span>
              <span style={{ fontSize: '15px', color: '#71717A', marginLeft: '12px' }}>
                크리에이터 검증 미식 성지
              </span>
            </div>

            {/* 맛집 이름 및 주소 메인 카드 */}
            <div style={{ display: 'flex', flexDirection: 'column', margin: '20px 0' }}>
              <div style={{ display: 'flex' }}>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#FF5E00',
                    backgroundColor: 'rgba(255, 0, 68, 0.12)',
                    padding: '4px 14px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 0, 68, 0.25)',
                    marginBottom: '14px',
                  }}
                >
                  {restaurant.category || '맛집'}
                </span>
              </div>

              <span
                style={{
                  fontSize: '52px',
                  fontWeight: 'bold',
                  color: '#FFFFFF',
                  lineHeight: '1.25',
                  marginBottom: '16px',
                  wordBreak: 'keep-all',
                }}
              >
                {restaurant.name}
              </span>

              <span style={{ fontSize: '18px', color: '#A1A1AA', display: 'flex', alignItems: 'center' }}>
                📍 {restaurant.address || '전국 핫플레이스'}
              </span>
            </div>

            {/* 추천 유튜버 메인 태그 */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#1E1E1E',
                  padding: '10px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {creatorProfile && (
                  <img
                    src={creatorProfile}
                    alt={creatorName}
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      marginRight: '10px',
                      border: '1px solid rgba(255, 0, 68, 0.3)',
                    }}
                  />
                )}
                <span style={{ fontSize: '15px', color: '#E4E4E7' }}>
                  <strong style={{ color: '#FF5E00', fontWeight: 'bold' }}>{creatorName}</strong> 님이 강력 검증한 맛집
                </span>
              </div>
            </div>
          </div>

          {/* 우측 이미지 프레임 영역 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              width: '42%',
              height: '100%',
              zIndex: 10,
              position: 'relative',
            }}
          >
            {/* 시네마틱 스타일 썸네일 액자 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(255, 0, 68, 0.15)',
                backgroundColor: '#1E1E1E',
                border: '3px solid rgba(255, 0, 68, 0.25)',
                width: '100%',
                height: '240px',
                position: 'relative',
              }}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={restaurant.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#1E1E1E',
                  }}
                >
                  <span style={{ fontSize: '48px' }}>🍲</span>
                  <span style={{ fontSize: '15px', color: '#71717A', marginTop: '10px' }}>맛있는 플레이어</span>
                </div>
              )}

              {/* 재생 원형 버튼 데코 */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 0, 68, 0.9)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 0 15px rgba(255, 0, 68, 0.5)',
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ marginLeft: '2px' }}
                >
                  <polygon points="5 3 19 12 5 21 5 3" fill="#FFFFFF" />
                </svg>
              </div>

              {/* 하부 오버레이 바 */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0) 100%)',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ color: '#E4E4E7', fontSize: '13px', fontWeight: 'bold' }}>
                  {seriesName}
                </span>
                <span style={{ color: '#FF5E00', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                  LIVE CLIP
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: fontOptions,
      }
    );
  } catch (error) {
    console.error('OG 이미지 생성 중 치명적 오류 발생:', error);
    // 폴백 기본 이미지 제공
    return new Response(JSON.stringify({ error: 'OG 이미지 생성 실패' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
