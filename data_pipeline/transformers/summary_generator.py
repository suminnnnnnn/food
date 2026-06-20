import json
import google.generativeai as genai
from config import GEMINI_API_KEY

# Gemini API 설정
genai.configure(api_key=GEMINI_API_KEY)

async def generate_store_summary(name: str, category: str, address: str, menu_info: str, raw_desc: str) -> dict:
    """
    맛집 정보를 바탕으로 한눈에 보는 요약 3줄과 추천 태그 목록을 생성하여 dict로 반환합니다.
    결과 포맷: {"summary": "요약 설명", "tags": ["태그1", "태그2"]}
    """
    if not name:
        return {"summary": "", "tags": []}
        
    prompt = f"""
    당신은 맛집 가이드 에디터입니다. 아래 제공되는 식당 정보를 바탕으로 서비스 화면의 상세 페이지에 들어갈 '한눈에 보는 맛집 요약'과 '추천 태그'를 작성해 주세요.

    [식당 정보]
    - 식당명: {name}
    - 카테고리: {category}
    - 주소: {address}
    - 메뉴 정보: {menu_info}
    - 소개글: {raw_desc}

    [작성 규칙]
    1. "summary" 필드에는 이 식당의 특징, 추천 이유, 분위기 등을 담은 2~3줄 내외의 친근하고 명확한 한국어 요약 설명글을 작성해줘 (최대 150자 내외).
    2. "tags" 필드에는 이 식당에 가장 잘 어울리는 분위기나 목적 관련 추천 해시태그 목록을 3~5개 내외의 배열로 작성해줘 (예: ["데이트", "가족외식", "가성비", "인스타감성", "조용한"]). '#' 기호는 제외해줘.
    3. 반드시 아래의 JSON 포맷을 정확히 지켜줘. 마크다운 코드 블록 없이 순수 JSON 문자열만 출력해줘.

    [JSON Output Format]
    {{
      "summary": "식당 요약 글...",
      "tags": ["태그1", "태그2", "태그3"]
    }}
    """
    
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = await model.generate_content_async(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        parsed_json = json.loads(result_text)
        return {
            "summary": parsed_json.get("summary", ""),
            "tags": parsed_json.get("tags", [])
        }
    except Exception as e:
        print(f"Error generating summary with Gemini: {e}")
        return {"summary": "", "tags": []}

if __name__ == "__main__":
    import asyncio
    async def test():
        result = await generate_store_summary(
            name="몽탄",
            category="육류,고기 요리",
            address="서울 용산구 백범로99길 50",
            menu_info="우대갈비 32,000원, 짚불삼겹살 17,000원",
            raw_desc="짚불구이 전문점으로, 전남 무안군 몽탄면의 전통 방식을 계승한 고깃집입니다. 거대한 우대갈비가 짚불 향에 훈연되어 나오는 것이 특징이며 엄청난 웨이팅으로 유명합니다."
        )
        print("Summary Result:", result)
        
    asyncio.run(test())
