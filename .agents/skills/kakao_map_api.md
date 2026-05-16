# Kakao 지도 Web API 핵심 가이드 (Geospatial Subagent용)

이 문서는 Geospatial Subagent가 Kakao Map Web API를 효율적으로 다루기 위한 레퍼런스(Reference)입니다. `https://apis.map.kakao.com/web/guide/`의 내용을 요약하여 작성되었습니다.

## 1. API 스크립트 로드
카카오 지도 API를 사용하려면 HTML에 다음과 같이 스크립트를 선언해야 합니다. Next.js App Router 환경에서는 `next/script`를 활용하여 비동기적으로 로드하는 것을 권장합니다 (예: `strategy="beforeInteractive"`).

```html
<script type="text/javascript" src="//dapi.kakao.com/v2/maps/sdk.js?appkey=발급받은_APP_KEY&libraries=services,clusterer,drawing"></script>
```
* **주의**: `libraries` 파라미터를 통해 추가 라이브러리를 반드시 로드해야 해당 기능을 사용할 수 있습니다.

## 2. 확장 라이브러리 목록
* `clusterer`: 마커를 클러스터링(그룹화) 할 수 있는 `MarkerClusterer`를 제공합니다.
* `services`: 장소 검색(`Places`) 및 주소-좌표 변환(`Geocoder`) 기능을 제공합니다.
* `drawing`: 지도 위에 마커와 그래픽스 객체를 쉽게 그릴 수 있게 그리기 모드를 지원합니다.

## 3. 지도 초기화 (Map Initialization)
지도를 렌더링하기 위해서는 지도를 담을 DOM 엘리먼트(`div`)와 초기화 옵션(`center`, `level`)이 필수적입니다.

```javascript
var container = document.getElementById('map'); // 지도를 담을 영역의 DOM 레퍼런스
var options = {
    center: new kakao.maps.LatLng(33.450701, 126.570667), // 지도의 중심좌표 (필수, WGS84 위경도)
    level: 3 // 지도의 확대 레벨 (필수)
};

var map = new kakao.maps.Map(container, options); // 지도 객체 생성
```
* **좌표계**: WGS84 좌표계를 사용하며, `kakao.maps.LatLng(위도, 경도)` 형태로 인스턴스를 생성해야 합니다. (위도: latitude, 경도: longitude)

## 4. 지도 바로가기 (URL Schemes)
앱 내외부 연동을 위해 Kakao Map 앱이나 웹으로 바로 연결할 수 있는 URL 스킴을 제공합니다.

* **특정 위치 열기 (Map)**: `https://map.kakao.com/link/map/{장소명},{위도},{경도}` 또는 `https://map.kakao.com/link/map/{장소ID}`
* **길찾기 도착지 설정 (Route)**: `https://map.kakao.com/link/to/{장소명},{위도},{경도}`
* **길찾기 출/도착지 설정**: `https://map.kakao.com/link/from/{출발지명},{위도},{경도}/to/{도착지명},{위도},{경도}`
* **이동 수단 지정 길찾기**: `https://map.kakao.com/link/by/car/...` (car: 자동차, walk: 도보, traffic: 대중교통)
* **로드뷰 열기 (Roadview)**: `https://map.kakao.com/link/roadview/{위도},{경도}`
* **키워드 검색 결과**: `https://map.kakao.com/link/search/{검색어}`

## 5. Next.js 통합 시 주의사항 (Subagent 지침)
- Next.js (특히 App Router)에서는 `window.kakao` 객체에 접근할 때 브라우저 환경(`typeof window !== "undefined"`)인지 확인하거나, `useEffect` 등의 클라이언트 사이드 라이프사이클 내에서 실행해야 합니다.
- Kakao Map API 스크립트 로딩 완료를 보장하기 위해, 컴포넌트 렌더링 시점에 `window.kakao`와 `window.kakao.maps` 객체의 존재 여부를 체크하는 방어 로직을 작성하세요.
