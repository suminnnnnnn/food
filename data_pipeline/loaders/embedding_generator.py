import google.generativeai as genai
from config import GEMINI_API_KEY
from tenacity import retry, stop_after_attempt, wait_exponential

genai.configure(api_key=GEMINI_API_KEY)

def generate_context_string(item: dict) -> str:
    """
    파편화된 메타데이터와 요약, 태그 정보를 하나의 의미론적 문장(Context String)으로 압축합니다.
    """
    name = item.get("name", "")
    category = item.get("category", "분류없음")
    address = item.get("address") or item.get("road_address") or ""
    description_summary = item.get("description_summary", "")
    tags = item.get("tags", [])
    
    context_parts = [f"이곳은 {name}입니다."]
    if category:
        context_parts.append(f"주요 카테고리는 {category}입니다.")
    if address:
        context_parts.append(f"위치는 {address}에 있습니다.")
    if description_summary:
        context_parts.append(description_summary)
    if tags:
        context_parts.append(f"관련 태그로는 {', '.join(tags)} 등이 있습니다.")
        
    return " ".join(context_parts)

@retry(stop=stop_after_attempt(5), wait=wait_exponential(multiplier=1, min=2, max=10))
async def generate_embedding(text: str) -> list[float]:
    """
    Google Gemini API를 호출하여 768차원 임베딩 생성.
    텍스트 모델은 text-embedding-004 등을 사용합니다.
    (현재 gemini의 embedding 모델 차원은 기본 768)
    """
    # Use sync API inside async by running in executor if needed, 
    # but google-generativeai provides an async method theoretically, or we can just run it.
    # We will use the sync method `embed_content` wrapped in asyncio.to_thread
    import asyncio
    
    def _embed():
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=text,
            task_type="retrieval_document",
            output_dimensionality=768
        )
        emb_data = result.get('embedding', [])
        if isinstance(emb_data, dict):
            return emb_data.get('values', [])
        return emb_data
        
    embedding = await asyncio.to_thread(_embed)
    return embedding

if __name__ == "__main__":
    import asyncio
    async def test():
        text = "이곳은 스타벅스 강남점입니다. 주요 카테고리는 카페입니다. 위치는 서울 강남구에 있습니다."
        emb = await generate_embedding(text)
        print(f"Embedding length: {len(emb)}")
    asyncio.run(test())
