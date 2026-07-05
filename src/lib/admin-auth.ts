import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// service_role 우선 — 없으면 anon 폴백(현재 RLS off라 동작하나, 운영에선 service_role 설정 권장)
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 관리자 전용 서버 클라이언트 (모든 /api/admin 라우트 공용)
export const adminSupabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { persistSession: false },
});

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * 관리자 인증 (하드닝).
 * - ADMIN_SECRET 설정 시: `x-admin-secret` 헤더 또는 `?secret=`가 일치해야 통과
 * - 미설정 시: 개발환경에서만 허용, **프로덕션에선 차단**
 *   (과거 `checkAdmin`은 미설정 시 무조건 true라 배포 시 admin이 전면 개방되는 위험이 있었음)
 */
export function checkAdmin(req: NextRequest): boolean {
  if (!ADMIN_SECRET) return !IS_PROD;
  const provided = req.headers.get('x-admin-secret') || req.nextUrl.searchParams.get('secret');
  return provided === ADMIN_SECRET;
}
