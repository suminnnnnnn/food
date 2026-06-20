# Supabase RLS (Row Level Security) 트러블슈팅

## 🚨 문제 상황 (PGRST205 등)
클라이언트나 백엔드(`route.ts`)에서 Supabase 테이블에 `insert`, `update` 등을 시도할 때 에러가 발생하거나 묵묵부답으로 데이터가 안 들어가는 현상 발생.

## 🔍 원인 파악
Supabase에서 새 테이블을 생성하면 기본적으로 RLS(Row Level Security)가 활성화될 수 있습니다.
정책(Policy)이 하나도 생성되어 있지 않다면, **모든 접근(읽기/쓰기/수정/삭제)이 기본적으로 거부(Deny) 처리**됩니다. (슈퍼유저 권한이 아닌 익명 권한이나 서비스 롤에서 주로 발생)

## 💡 해결 로직
1. 해당 테이블이 서버 측에서 삽입(Insert)만 이루어지는지, 클라이언트에서 바로 쏘는 구조인지 파악합니다.
2. 테이블의 정책(Policies) 설정을 확인합니다.
3. 데이터 삽입이 필요하다면 아래와 같은 SQL 쿼리를 통해 INSERT 전용 정책을 추가해야 합니다.

### SQL 예시
```sql
-- 모든 사용자(익명 포함)에게 INSERT를 허용하는 정책 추가
CREATE POLICY "Allow public inserts" ON "public"."테이블명"
FOR INSERT WITH CHECK (true);
```

## 🧠 AI 어시스턴트 행동 강령
- DB 저장 관련 버그 제보가 들어올 경우, 가장 먼저 "RLS 권한 누락" 여부를 의심하고 확인 절차를 밟을 것.
