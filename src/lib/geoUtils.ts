// 지리적 연산을 위한 유틸리티 함수 모음

interface Point {
  lat: number;
  lng: number;
}

// 두 좌표 간 거리 계산 (km 단위)
export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // 지구 반지름 (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 두 지점을 연결하는 선분을 양옆으로 1km 확장한 직사각형 버퍼 꼭짓점 계산
export function getRouteBufferPolygon(ptA: Point, ptB: Point): Point[] {
  // 위도 1도 약 111km, 경도 1도 약 88km (대한민국 위도 37도 기준)
  const LAT_DEGREE_PER_KM = 1 / 111.0;
  const LNG_DEGREE_PER_KM = 1 / 88.0;
  const BUFFER_KM = 5.0; // 5km 버퍼

  // 벡터 AB 계산
  const dLat = ptB.lat - ptA.lat;
  const dLng = ptB.lng - ptA.lng;

  // 벡터 크기
  const len = Math.sqrt(dLat * dLat + dLng * dLng);
  if (len === 0) {
    // 두 점이 같을 경우, 점을 중심으로 하는 정사각형 버퍼 리턴
    const rLat = BUFFER_KM * LAT_DEGREE_PER_KM;
    const rLng = BUFFER_KM * LNG_DEGREE_PER_KM;
    return [
      { lat: ptA.lat + rLat, lng: ptA.lng - rLng },
      { lat: ptA.lat + rLat, lng: ptA.lng + rLng },
      { lat: ptA.lat - rLat, lng: ptA.lng + rLng },
      { lat: ptA.lat - rLat, lng: ptA.lng - rLng }
    ];
  }

  // 수직 벡터 (법선 벡터) 방향성 구하기 (-dLng, dLat)
  // 위경도의 단위 차이를 감안한 정규화
  const uLat = -dLng / len;
  const uLng = dLat / len;

  // 1km 오프셋 값 산출
  const offsetLat = uLat * BUFFER_KM * LAT_DEGREE_PER_KM;
  const offsetLng = uLng * BUFFER_KM * LNG_DEGREE_PER_KM;

  // 직사각형의 4개 꼭짓점 계산
  const p1 = { lat: ptA.lat + offsetLat, lng: ptA.lng + offsetLng };
  const p2 = { lat: ptA.lat - offsetLat, lng: ptA.lng - offsetLng };
  const p3 = { lat: ptB.lat - offsetLat, lng: ptB.lng - offsetLng };
  const p4 = { lat: ptB.lat + offsetLat, lng: ptB.lng + offsetLng };

  return [p1, p2, p3, p4]; // 다각형 경로
}

// 점이 다각형(Polygon) 내부에 포함되어 있는지 판별하는 Ray-casting 알고리즘
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}
