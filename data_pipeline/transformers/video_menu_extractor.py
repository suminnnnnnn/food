import os
import json
import time
import asyncio
import google.generativeai as genai
from supabase import create_client, Client
from dotenv import load_dotenv

# Env 및 Gemini 로드
load_dotenv()
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

async def extract_menu_from_video(video_path: str) -> list:
    """
    Gemini 2.5 Flash 멀티모달 API를 사용하여 제보 영상(.mp4 등)으로부터 메뉴명과 가격을 JSON 배열로 추출합니다.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found at {video_path}")
        
    print(f"[Video Extractor] Gemini 서버에 영상 업로드 중: {video_path}")
    # 비디오 파일을 Gemini API용 파일 객체로 업로드 (네이티브 멀티모달 지원)
    video_file = genai.upload_file(path=video_path)
    print(f"[Video Extractor] 업로드 완료. 파일 ID: {video_file.name}")
    
    # 비디오 처리 대기 (ACTIVE 상태가 될 때까지 대기)
    while video_file.state.name == "PROCESSING":
        print(".", end="", flush=True)
        await asyncio.sleep(5)
        video_file = genai.get_file(video_file.name)
        
    if video_file.state.name == "FAILED":
        raise ValueError("Gemini video processing failed.")
        
    print("\n[Video Extractor] 비디오 분석 시작...")
    
    prompt = """
    이 식당 소개/제보 영상의 화면(자막, 메뉴판)과 오디오(음성 언급)를 정밀 분석하여 등장하는 모든 음식 메뉴명과 가격 정보를 구조화된 JSON 배열 포맷으로 추출해줘.
    반드시 다음 규칙을 지켜줘:
    1. 각 항목은 "name" (메뉴 이름)과 "price" (가격, 숫자만 가능) 키를 가져야 해.
    2. 가격에 단위(원, 천원 등)가 있거나 쉼표(,)가 있다면 순수 정수 숫자로 변환해줘 (예: "3.2만원" -> 32000, "15,000" -> 15000).
    3. 가격 정보가 전혀 없거나 불확실한 경우 price 필드 값을 null로 설정해줘.
    4. 오직 유효한 JSON 배열만 반환해야 하고, 마크다운 코드 블록 없이 순수 JSON 문자열만 출력해줘.
    """
    
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = await model.generate_content_async(
            [video_file, prompt],
            generation_config={"response_mime_type": "application/json"}
        )
        
        # 파일은 사용이 끝났으므로 API 스토리지에서 즉시 삭제하여 공간 정리
        genai.delete_file(video_file.name)
        
        result_text = response.text.strip()
        parsed_json = json.loads(result_text)
        if isinstance(parsed_json, list):
            return parsed_json
        return []
    except Exception as e:
        print(f"Error extracting menu from video: {e}")
        return []

def merge_menu_lists(existing_menu: list, new_menu: list) -> list:
    """
    기존 메뉴 리스트와 신규 비디오에서 추출된 메뉴 리스트를 중복 없이 유기적으로 결합합니다.
    이름이 같은 메뉴는 더 신뢰성 있는 가격 정보가 기재된 항목이나 최신 항목으로 병합 갱신합니다.
    """
    merged_dict = {}
    
    # 1. 기존 메뉴 등록
    for item in existing_menu:
        name = item.get("name")
        if name:
            merged_dict[name.strip()] = item.get("price")
            
    # 2. 신규 메뉴 업데이트 및 추가
    for item in new_menu:
        name = item.get("name")
        price = item.get("price")
        if name:
            name_clean = name.strip()
            # 신규 가격 정보가 존재하거나, 기존 가격 정보가 null인 경우 갱신
            if price is not None or name_clean not in merged_dict or merged_dict[name_clean] is None:
                merged_dict[name_clean] = price
                
    # 3. 리스트로 복원
    return [{"name": k, "price": v} for k, v in merged_dict.items()]

async def update_restaurant_menu_via_video(restaurant_id: str, video_path: str):
    """
    특정 식당 ID에 대해 제보된 비디오로부터 메뉴 정보를 추가/병합하여 Supabase DB를 자동 업데이트합니다.
    """
    # 1. 비디오에서 신규 메뉴 추출
    new_menus = await extract_menu_from_video(video_path)
    if not new_menus:
        print("비디오에서 추출된 메뉴가 없습니다.")
        return
        
    print(f"비디오에서 {len(new_menus)}개의 메뉴 후보를 추출했습니다: {new_menus}")
    
    # 2. Supabase 초기화 및 기존 메뉴 로드
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase URL and Service Role Key must be set in environment variables.")
        
    client: Client = create_client(supabase_url, supabase_key)
    
    response = client.table("restaurants").select("menu_info").eq("id", restaurant_id).execute()
    db_data = response.data
    
    existing_menus = []
    if db_data:
        raw_info = db_data[0].get("menu_info")
        if raw_info:
            try:
                existing_menus = json.loads(raw_info)
            except Exception:
                existing_menus = []
                
    # 3. 메뉴 병합 수행
    updated_menus = merge_menu_lists(existing_menus, new_menus)
    menu_info_str = json.dumps(updated_menus, ensure_ascii=False)
    
    # 4. Supabase DB 업데이트
    client.table("restaurants").update({"menu_info": menu_info_str}).eq("id", restaurant_id).execute()
    print(f"성공적으로 식당 {restaurant_id}의 메뉴 정보를 업데이트했습니다! (총 {len(updated_menus)}개 메뉴 보관)")

if __name__ == "__main__":
    # POC 테스트용 실행 예시
    async def test():
        # sample_video.mp4가 있다면 아래처럼 호출 가능
        # await update_restaurant_menu_via_video("some-restaurant-uuid", "sample_video.mp4")
        pass
    # asyncio.run(test())
    pass
