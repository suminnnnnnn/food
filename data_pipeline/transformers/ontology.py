def map_category(raw_category: str, raw_name: str) -> str:
    """
    텍스트 마이닝(단순 키워드 기반 휴리스틱)을 통한 카테고리 강제 교정.
    """
    combined_text = f"{raw_category} {raw_name}".lower()
    
    # 1. 휴리스틱 룰 (우선순위에 따라 위에서부터 적용)
    if "파스타" in combined_text or "이탈리아" in combined_text or "피자" in combined_text:
        return "양식 > 이탈리아음식"
    
    if "국밥" in combined_text or "해장국" in combined_text or "설렁탕" in combined_text:
        return "한식 > 국밥"
        
    if "중식" in combined_text or "짜장" in combined_text or "짬뽕" in combined_text or "중국" in combined_text:
        return "중식"
        
    if "일식" in combined_text or "스시" in combined_text or "초밥" in combined_text or "돈까스" in combined_text or "우동" in combined_text:
        return "일식"
        
    if "카페" in combined_text or "커피" in combined_text or "디저트" in combined_text or "베이커리" in combined_text:
        return "카페/디저트"
        
    if "고기" in combined_text or "삼겹살" in combined_text or "갈비" in combined_text or "한우" in combined_text:
        return "한식 > 육류,고기요리"
        
    if "치킨" in combined_text or "통닭" in combined_text:
        return "치킨"
        
    if "분식" in combined_text or "떡볶이" in combined_text or "김밥" in combined_text:
        return "분식"

    # 2. 매핑되지 않은 경우 기본값 (원본 카테고리 유지, 없으면 '기타')
    if raw_category and raw_category.strip():
        return raw_category.strip()
    return "기타"
