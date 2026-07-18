'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdmin } from '../../../components/admin/AdminShell';

type Flag = { key: string; label: string; value: number; href: string; warn: boolean };

// 스크립트 카탈로그 (읽기전용 — 실행은 로컬 터미널에서만)
const SCRIPTS: { file: string; desc: string; danger?: boolean }[] = [
  { file: 'check_count.mjs', desc: '테이블 레코드 수 점검' },
  { file: 'check_cols.mjs', desc: '테이블 컬럼 구조 점검' },
  { file: 'check_regions.mjs', desc: '지역 데이터 점검' },
  { file: 'check_affiliate_schema.mjs', desc: '제휴 테이블 스키마 점검' },
  { file: 'naver_test.mjs', desc: '네이버 검색 API 연결 테스트' },
  { file: 'backfill_affiliate.mjs', desc: '제휴상품 가격·카테고리 재조회/보정' },
  { file: 'backfill_channels.mjs', desc: '채널 구독자수 보강' },
  { file: 'add_keywords_column.mjs', desc: 'restaurant_videos.keywords 컬럼 추가 (DDL)', danger: true },
  { file: 'migrate_affiliate_columns.mjs', desc: 'affiliate_* status/category 등 컬럼 추가 (DDL)', danger: true },
  { file: 'migrate_affiliate_price_cols.mjs', desc: 'affiliate_products 가격 컬럼 추가 (DDL)', danger: true },
  { file: 'migrate_channel_cols.mjs', desc: 'affiliate_videos 채널 컬럼 추가 (DDL)', danger: true },
  { file: 'migrate_regions.mjs', desc: '지역 데이터 마이그레이션', danger: true },
  { file: 'migrate_mongtan_video.mjs', desc: '몽탄 영상 데이터 마이그레이션', danger: true },
  { file: 'create_rpc.mjs', desc: 'pgvector match_restaurants RPC 생성 (DDL)', danger: true },
  { file: 'create_mealkit_click_events.mjs', desc: '제휴 클릭 로그 테이블 생성 (제휴 통계용, DDL)', danger: true },
  { file: 'migrate_affiliate_trust_cols.mjs', desc: 'affiliate_products 신뢰도 컬럼(trust_score·maker_type·maker_name) 추가 (DDL)', danger: true },
  { file: 'seed_keywords.mjs', desc: '키워드 시드' },
  { file: 'seed_sample_data.mjs', desc: '샘플 데이터 시드', danger: true },
  { file: 'ai_crawler.mjs', desc: '유튜브 인기채널 크롤 적재 (대량 쓰기)', danger: true },
  { file: 'clean_unembeddable_videos.mjs', desc: '임베드 불가 영상 정리·삭제', danger: true },
  { file: 'disable_rls.mjs', desc: '콘텐츠 테이블 RLS 비활성화 (보안 주의)', danger: true },
  { file: 'disable_rls_affiliate.mjs', desc: '제휴 테이블 RLS 비활성화 (보안 주의)', danger: true },
];

export default function AdminOpsPage() {
  const { adminFetch } = useAdmin();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    adminFetch('/api/admin/ops-stats')
      .then(async (r) => {
        if (r.status === 401) throw new Error('ADMIN_SECRET이 올바르지 않습니다 (좌측 하단에 입력)');
        if (!r.ok) throw new Error(`오류 ${r.status}`);
        return r.json();
      })
      .then((j) => setFlags(j.flags || []))
      .catch((e) => setMsg(e.message));
  }, [adminFetch]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const runCollection = async () => {
    setRunning(true);
    setMsg('밀키트 수집 실행 중… (YouTube + Gemini, 최대 1분)');
    try {
      const r = await fetch('/api/cron/mealkits');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `오류 ${r.status}`);
      const s = j.summary;
      setMsg(`수집 완료 — 발견 ${s.discovered} / 후보 ${s.candidates} / 신규 ${s.inserted}개 영상 · 상품 ${s.products}개${s.errors?.length ? ` · 오류 ${s.errors.length}` : ''}`);
      loadStats();
    } catch (e: any) {
      setMsg(`수집 실패: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  const copy = (file: string) => {
    const cmd = `node src/scripts/${file}`;
    navigator.clipboard?.writeText(cmd);
    setCopied(file);
    setTimeout(() => setCopied((c) => (c === file ? null : c)), 1500);
  };

  return (
    <div className="px-5 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-black tracking-tight">운영 도구</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">수집 실행 · 데이터 품질 점검 · 스크립트 카탈로그</p>
      </div>

      {msg && <div className="mb-4 text-[13px] px-3 py-2 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">{msg}</div>}

      {/* A. 수집 실행 */}
      <section className="mb-6">
        <h2 className="text-[12px] font-bold text-slate-400 mb-2">수집</h2>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="font-bold text-[14px]">밀키트 수집 지금 실행</p>
            <p className="text-[12px] text-slate-500 mt-0.5">YouTube 인기 밀키트 영상 수집 → Gemini 추출 → 검수 대기(pending)로 적재</p>
          </div>
          <button onClick={runCollection} disabled={running}
            className="px-4 py-2 rounded-full text-[13px] font-bold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00,#FF9E40)' }}>
            {running ? '수집 중…' : '지금 실행'}
          </button>
        </div>
      </section>

      {/* B. 데이터 품질 점검 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[12px] font-bold text-slate-400">데이터 품질 (손봐야 할 것)</h2>
          <button onClick={loadStats} className="text-[12px] font-semibold text-slate-500">새로고침</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {flags.map((f) => (
            <Link key={f.key} href={f.href}
              className={`rounded-2xl border p-3.5 transition-colors ${f.warn ? 'border-red-200 bg-red-50 hover:bg-red-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
              <p className="text-[11.5px] font-bold text-slate-500">{f.label}</p>
              <p className={`mt-1 text-[22px] font-black tabular-nums ${f.warn ? 'text-red-600' : 'text-slate-800'}`}>{f.value}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* C. 스크립트 카탈로그 */}
      <section>
        <h2 className="text-[12px] font-bold text-slate-400 mb-2">스크립트 카탈로그</h2>
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[12px] rounded-xl px-3 py-2 mb-3">
          🔒 스크립트는 보안·환경 문제로 웹에서 실행하지 않습니다. 아래 커맨드를 <b>프로젝트 루트 터미널</b>에서 직접 실행하세요. ⚠️ 표시는 파괴적(DDL·삭제·RLS·시드) 작업입니다.
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {SCRIPTS.map((s) => (
            <div key={s.file} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-semibold text-slate-800 flex items-center gap-1.5">
                  {s.danger && <span title="파괴적 작업">⚠️</span>}
                  <code className="text-[12px]">{s.file}</code>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
              </div>
              <button onClick={() => copy(s.file)} className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">
                {copied === s.file ? '복사됨 ✓' : '커맨드 복사'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
