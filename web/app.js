// ===================================================================
// Harness Map — Web Frontend (API 실연동)
// Backend: http://localhost:8080
// ===================================================================

const API_BASE = 'http://localhost:8080';

// ── State ──
let videos = [];
let categories = [];
let selectedTrend = null;
let currentIndex = 0;

// ── DOM References ──
const mapContainer    = document.getElementById('map-container');
const cardTrack       = document.getElementById('card-track');
const indicators      = document.getElementById('card-indicators');
const trendBtn        = document.getElementById('trend-dial-btn');
const trendMenu       = document.getElementById('trend-menu');
const trendChip       = document.getElementById('active-trend-chip');
const trendChipText   = document.getElementById('active-trend-text');
const clearTrendBtn   = document.getElementById('clear-trend-btn');
const sheetOverlay    = document.getElementById('sheet-overlay');
const detailSheet     = document.getElementById('detail-sheet');
const sheetVideoArea  = document.getElementById('sheet-video-area');
const sheetContent    = document.getElementById('sheet-content');
const shimmer         = document.getElementById('shimmer-container');
const swipeContainer  = document.getElementById('swipe-container');

// ===================================================================
// API Calls (실제 Backend 연동)
// ===================================================================

async function fetchNearbyVideos(trend = null) {
    const params = new URLSearchParams({
        lat: '37.4979', lng: '127.0276', radius: '2000'
    });
    if (trend) params.set('trend', trend);

    try {
        const res = await fetch(`${API_BASE}/api/videos/nearby?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn('API fallback:', e);
        return null;
    }
}

async function fetchVideoDetail(id) {
    try {
        const res = await fetch(`${API_BASE}/api/videos/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn('Detail fallback:', e);
        return null;
    }
}

async function fetchCategories() {
    try {
        const res = await fetch(`${API_BASE}/api/videos/categories`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        console.warn('Categories fallback:', e);
        return null;
    }
}

// ===================================================================
// Map Markers
// ===================================================================

// 마커 배치를 위한 좌표→픽셀 매핑
function coordToPixel(lat, lng) {
    const centerLat = 37.4979, centerLng = 127.0276;
    const scale = 12000;
    const x = (lng - centerLng) * scale + window.innerWidth / 2;
    const y = (centerLat - lat) * scale + window.innerHeight / 2.5;
    return { x: Math.max(40, Math.min(window.innerWidth - 60, x)),
             y: Math.max(80, Math.min(window.innerHeight - 440, y)) };
}

function renderMarkers() {
    document.querySelectorAll('.map-marker').forEach(m => m.remove());

    videos.forEach((v, i) => {
        const pos = coordToPixel(v.location.lat, v.location.lng);
        const marker = document.createElement('div');
        marker.className = `map-marker${i === currentIndex ? ' active' : ''}`;
        marker.style.left = `${pos.x}px`;
        marker.style.top = `${pos.y}px`;
        marker.innerHTML = `<span class="marker-label">${v.restaurant_name}</span>`;
        marker.addEventListener('click', () => scrollToCard(i));
        mapContainer.appendChild(marker);
    });
}

// ===================================================================
// Video Cards
// ===================================================================

function renderCards() {
    cardTrack.innerHTML = '';
    indicators.innerHTML = '';

    if (videos.length === 0) {
        cardTrack.innerHTML = `
            <div class="empty-state">
                <span>🔍</span>
                <span>필터에 해당하는 맛집이 없습니다</span>
            </div>`;
        return;
    }

    videos.forEach((v, i) => {
        // Card
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <video src="${v.video_url}" muted loop playsinline autoplay></video>
            <div class="card-gradient"></div>
            <div class="card-meta">
                <div class="card-name">
                    <span class="pin-icon">📍</span>
                    <h3>${v.restaurant_name}</h3>
                </div>
                <div class="card-info">
                    <span class="youtuber">@${v.youtuber_name}</span>
                    ${v.distance_m != null ? `
                        <span class="distance">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                            ${Math.round(v.distance_m)}m
                        </span>` : ''}
                </div>
                <div class="card-tags">
                    ${v.trend_tags.map(t => `<span class="tag-chip">#${t}</span>`).join('')}
                </div>
            </div>`;
        card.addEventListener('click', () => openDetailSheet(v.id));
        cardTrack.appendChild(card);

        // Indicator
        const dot = document.createElement('div');
        dot.className = `indicator${i === 0 ? ' active' : ''}`;
        indicators.appendChild(dot);
    });

    // 비디오 최적화: 보이는 카드만 재생
    observeCards();
}

function scrollToCard(index) {
    const cards = cardTrack.querySelectorAll('.video-card');
    if (cards[index]) {
        cards[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        setActiveCard(index);
    }
}

function setActiveCard(index) {
    currentIndex = index;

    // 인디케이터 업데이트
    document.querySelectorAll('.indicator').forEach((d, i) => {
        d.classList.toggle('active', i === index);
    });

    // 마커 업데이트
    document.querySelectorAll('.map-marker').forEach((m, i) => {
        m.classList.toggle('active', i === index);
    });
}

// Intersection Observer — 비디오 재생 최적화
function observeCards() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target.querySelector('video');
            if (!video) return;
            if (entry.isIntersecting) {
                video.play().catch(() => {});
                const idx = [...cardTrack.children].indexOf(entry.target);
                if (idx >= 0) setActiveCard(idx);
            } else {
                video.pause();
            }
        });
    }, { root: cardTrack, threshold: 0.6 });

    cardTrack.querySelectorAll('.video-card').forEach(card => observer.observe(card));
}

// ===================================================================
// Trend Dial
// ===================================================================

function renderTrendMenu() {
    const topTrends = [
        { tag: '방어', label: '🐟 겨울 제철 방어' },
        { tag: '마라', label: '🔥 핫 트렌드 마라' },
        { tag: '삼겹살', label: '🥓 직장인 회식' },
        { tag: '오마카세', label: '🍣 데이트 오마카세' },
        { tag: '양꼬치', label: '🐑 야식 양꼬치' },
        { tag: '매운맛', label: '🌶️ 매운맛 탐험' },
        { tag: '트렌드', label: '📈 요즘 뜨는 곳' },
    ];

    // API 카테고리가 있으면 우선 사용
    const items = categories.length > 0
        ? categories.slice(0, 7).map(c => ({ tag: c.tag, label: c.label }))
        : topTrends;

    trendMenu.innerHTML = items.map(t => `
        <div class="trend-item${selectedTrend === t.tag ? ' selected' : ''}" data-tag="${t.tag}">
            <span>${t.label}</span>
            <span class="check">✓</span>
        </div>`).join('') + `
        <div class="trend-divider"></div>
        <div class="trend-item reset" data-tag="__reset__">🔄 필터 초기화</div>`;

    trendMenu.querySelectorAll('.trend-item').forEach(item => {
        item.addEventListener('click', () => {
            const tag = item.dataset.tag;
            selectTrend(tag === '__reset__' ? null : tag);
            trendMenu.classList.add('hidden');
        });
    });
}

async function selectTrend(tag) {
    selectedTrend = tag;

    // UI 업데이트
    trendBtn.classList.toggle('active', tag !== null);
    if (tag) {
        trendChip.classList.remove('hidden');
        trendChipText.textContent = `#${tag}`;
    } else {
        trendChip.classList.add('hidden');
    }

    // 데이터 새로고침
    await loadVideos();
}

trendBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = trendMenu.classList.contains('hidden');
    trendMenu.classList.toggle('hidden', !isHidden);
    if (isHidden) renderTrendMenu();
});

clearTrendBtn.addEventListener('click', () => selectTrend(null));

// 바깥 클릭 시 메뉴 닫기
document.addEventListener('click', (e) => {
    if (!trendMenu.contains(e.target) && e.target !== trendBtn) {
        trendMenu.classList.add('hidden');
    }
});

// ===================================================================
// Detail Bottom Sheet
// ===================================================================

async function openDetailSheet(videoId) {
    const detail = await fetchVideoDetail(videoId);
    if (!detail) return;

    sheetVideoArea.innerHTML = `
        <video src="${detail.video_url}" muted loop playsinline autoplay></video>`;

    sheetContent.innerHTML = `
        <div class="sheet-header">
            <h2 class="sheet-title">${detail.restaurant_name}</h2>
            <span class="sheet-category">${detail.category}</span>
        </div>
        <div class="sheet-youtuber">
            <span>▶</span>
            <span>@${detail.youtuber_name}</span>
        </div>
        <div class="sheet-address">
            <span>📍</span>
            <span>${detail.address}</span>
        </div>
        <div class="sheet-divider"></div>
        <p class="sheet-description">${detail.description}</p>
        <div class="sheet-tags">
            ${detail.trend_tags.map(t => `<span class="sheet-tag">#${t}</span>`).join('')}
        </div>
        <div class="sheet-actions">
            <button class="sheet-cta directions" onclick="closeDetailSheet()">
                <span>🧭</span> 길찾기
            </button>
            ${detail.reservation_url ? `
                <button class="sheet-cta reservation ${detail.platform_type === 'catchtable' ? 'catchtable' : 'naver'}" onclick="window.open('${detail.reservation_url}', '_blank')">
                    <span>📅</span> ${detail.platform_type === 'catchtable' ? '캐치테이블' : '네이버 예약'}
                </button>
            ` : ''}
        </div>`;

    sheetOverlay.classList.remove('hidden');
    detailSheet.classList.remove('hidden');
}

function closeDetailSheet() {
    sheetOverlay.classList.add('hidden');
    detailSheet.classList.add('hidden');
    sheetVideoArea.innerHTML = '';
}

sheetOverlay.addEventListener('click', closeDetailSheet);

// ===================================================================
// Initialization
// ===================================================================

async function loadVideos() {
    // 시머 표시
    shimmer.classList.remove('hidden');
    swipeContainer.classList.add('hidden');

    const data = await fetchNearbyVideos(selectedTrend);
    if (data) videos = data;

    shimmer.classList.add('hidden');
    swipeContainer.classList.remove('hidden');

    currentIndex = 0;
    renderCards();
    renderMarkers();
}

async function init() {
    // 카테고리 로드 (동적 다이얼)
    const cats = await fetchCategories();
    if (cats) categories = cats;

    // 비디오 로드
    await loadVideos();
}

init();
