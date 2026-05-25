import { supabase } from '@/lib/supabase/client';
import GroupMapClient from './GroupMapClient';

export default async function GroupMapPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

  // 서버 사이드에서 그룹 맵 정보 초기 로드 (선택적)
  // 여기서는 클라이언트 컴포넌트로 파라미터만 넘기고 처리는 클라이언트에서 수행합니다.
  
  return <GroupMapClient id={id} />;
}
