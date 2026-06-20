import json
import google.generativeai as genai
from config import GEMINI_API_KEY

# Gemini API 설정
genai.configure(api_key=GEMINI_API_KEY)

async def parse_menu_to_json(raw_menu_text: str) -> list:
    """
    비정형 줄글 맛집 메뉴 텍스트를 파싱하여 구조화된 JSON 배열 [{"name": "...", "price": 12000}] 포맷으로 반환합니다.
    """
    if not raw_menu_text or not raw_menu_text.strip():
        return []
        
    prompt = f"""
    아래의 맛집 메뉴 텍스트를 구조화된 JSON 배열 포맷으로 변환해줘.
    반드시 다음 규칙을 지켜줘:
    1. 각 항목은 "name" (메뉴 이름)과 "price" (가격, 숫자만 가능) 키를 가져야 해.
    2. 가격에 단위(원, 천원 등)가 있거나 쉼표(,)가 있다면 순수 정수 숫자로 변환해줘 (예: "3.2만원" -> 32000, "15,000" -> 15000).
    3. 가격 정보가 전혀 없거나 불확실한 경우 price 필드 값을 null로 설정해줘.
    4. 오직 유효한 JSON 배열만 반환해야 하고, 마크다운 코드 블록 없이 순수 JSON 문자열만 출력해줘.

    [메뉴 텍스트]
    {raw_menu_text}
    """
    
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        # 비동기 호출
        response = await model.generate_content_async(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        parsed_json = json.loads(result_text)
        if isinstance(parsed_json, list):
            return parsed_json
        return []
    except Exception as e:
        print(f"Error parsing menu with Gemini: {e}")
        return []

if __name__ == "__main__":
    import asyncio
    async def test():
        sample_text = "대표메뉴: 우대갈비(280g) 32,000원, 삼겹살 17,000원 / 취급메뉴: 된장찌개 8천원, 냉면 9,000원"
        result = await parse_menu_to_json(sample_text)
        print("Parsed Result:", result)
        
    asyncio.run(test())
