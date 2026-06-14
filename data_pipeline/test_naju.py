import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from loaders.supabase_loader import supabase

def main():
    load_dotenv()
    # 주소에 '나주'가 포함된 식당 조회
    res = supabase.table("restaurants").select("id, name, address, road_address")\
        .or_("address.ilike.%나주%,road_address.ilike.%나주%").execute()
        
    if not res.data:
        print("No restaurants found in Naju.")
        return
        
    with open("test_naju_output.txt", "w", encoding="utf-8") as f:
        f.write(f"Found {len(res.data)} restaurants in Naju:\n")
        for idx, rest in enumerate(res.data):
            addr = rest['road_address'] or rest['address']
            f.write(f"[{idx+1}] ID: {rest['id']} | Name: {rest['name']} | Addr: {addr}\n")
    print("Done writing to test_naju_output.txt")


if __name__ == "__main__":
    main()
