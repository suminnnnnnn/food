// AI 영상분석 태그 사전 접근 헬퍼 — 원천은 aiTags.json (수집 스크립트와 공유).
import dict from './aiTags.json';

export interface AiTagDef { code: string; label: string; criteria: string; }
export interface AiTagFacet { key: string; label: string; max: number; tags: AiTagDef[]; }

export const AI_TAG_FACETS = dict.facets as AiTagFacet[];

// code → label (칩 렌더링용). 사전에 없는 코드는 무시.
export const AI_TAG_LABEL: Record<string, string> = Object.fromEntries(
  AI_TAG_FACETS.flatMap((f) => f.tags.map((t) => [t.code, t.label]))
);

export const isAiTagCode = (code: string): boolean => code in AI_TAG_LABEL;

// 코드 배열 → 유효한 라벨 배열 (사전 순서 유지)
export const aiTagLabels = (codes: string[] | null | undefined): string[] => {
  if (!codes?.length) return [];
  const set = new Set(codes);
  return AI_TAG_FACETS.flatMap((f) => f.tags).filter((t) => set.has(t.code)).map((t) => t.label);
};
