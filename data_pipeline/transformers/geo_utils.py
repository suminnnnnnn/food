from pyproj import Transformer

# EPSG:5174 (Bessel TM) -> EPSG:4326 (WGS84)
# always_xy=True ensures output is (lon, lat)
transformer_5174_to_4326 = Transformer.from_crs("EPSG:5174", "EPSG:4326", always_xy=True)

def reproject_to_wgs84(mapx, mapy):
    """
    TourAPI나 상권정보에서 제공하는 5174 좌표를 4326으로 역변환합니다.
    """
    try:
        x = float(mapx)
        y = float(mapy)
        
        # 유효성 검증 (정상적인 5174 좌표의 대략적 범위: x=100000~400000, y=100000~600000)
        # 만약 이미 WGS84 좌표계(예: 126.x, 37.x)로 들어온다면 변환을 스킵할 수 있도록 분기 처리
        if 120.0 < x < 135.0 and 30.0 < y < 45.0:
            return x, y
            
        lon, lat = transformer_5174_to_4326.transform(x, y)
        return lon, lat
    except (ValueError, TypeError):
        return None, None

def parse_coordinates(mapx, mapy):
    """
    TourAPI의 일반적인 경우 mapx, mapy가 WGS84로 오기도 하지만, 
    명세서에 따라 5174인 경우 역변환을 수행.
    이 함수는 float 캐스팅 및 검증을 담당.
    """
    try:
        x = float(mapx)
        y = float(mapy)
        # If it's 5174
        if x > 1000 or y > 1000:
            return reproject_to_wgs84(x, y)
        return x, y
    except (ValueError, TypeError):
        return None, None
