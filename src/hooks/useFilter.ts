import { useState, useCallback } from 'react';
import { ContentSource } from '@/types';

export function useFilter() {
  // 초기 상태는 아무 필터도 선택되지 않은 상태 (전체 보기)
  const [activeSources, setActiveSources] = useState<Set<ContentSource | string>>(new Set());

  const toggleSource = useCallback((source: ContentSource | string) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }, []);

  const setSource = useCallback((source: ContentSource | string, active: boolean) => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (active) next.add(source);
      else next.delete(source);
      return next;
    });
  }, []);

  return { activeSources, toggleSource, setSource };
}
