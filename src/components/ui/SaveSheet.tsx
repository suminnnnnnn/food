'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Plus, Utensils } from 'lucide-react';
import { UserFolder } from '@/types';
import PinIcon from '@/components/ui/PinIcon';

// 이쁜 톤의 대표 색상 (그 외 색은 하단 HTML 색상 피커로 자유 선택)
const COLOR_PRESET = ['#F2735E', '#F2A65A', '#EBC55C', '#8FB98A', '#54B4A8', '#5B92E0', '#8A82E0', '#C77DC0', '#E86F97', '#8B96A8'];
const DEFAULT_COLOR = '#F2735E';

interface SaveSheetProps {
  open: boolean;
  restaurant: { id: string; name: string; thumbnail?: string } | null;
  folders: UserFolder[];
  folderCounts: Record<string, number>;
  currentFolderIds: string[]; // 이미 담겨있는 폴더들
  defaultFolderId: string;
  onClose: () => void;
  onCommit: (folderIds: string[]) => Promise<void>;
  onCreateFolder: (name: string, emoji: string, color: string) => Promise<UserFolder | null>;
}

export default function SaveSheet({
  open,
  restaurant,
  folders,
  folderCounts,
  currentFolderIds,
  defaultFolderId,
  onClose,
  onCommit,
  onCreateFolder,
}: SaveSheetProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);

  // 시트가 열릴 때 초기 선택값 세팅: 이미 담긴 폴더, 신규 저장이면 기본 폴더 선택
  useEffect(() => {
    if (!open) return;
    if (currentFolderIds.length > 0) {
      setSelected(new Set(currentFolderIds));
    } else if (defaultFolderId) {
      setSelected(new Set([defaultFolderId]));
    } else {
      setSelected(new Set());
    }
    setCreating(false);
    setNewName('');
    setNewColor(DEFAULT_COLOR);
  }, [open, restaurant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isNewSave = currentFolderIds.length === 0;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const folder = await onCreateFolder(name, '', newColor);
    if (folder) {
      setSelected(prev => new Set(prev).add(folder.id));
      setCreating(false);
      setNewName('');
    }
  };

  const handleCommit = async () => {
    setSaving(true);
    try {
      await onCommit(Array.from(selected));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const ctaLabel = useMemo(() => {
    if (selected.size === 0) return isNewSave ? '컬렉션을 선택해 주세요' : '저장 해제하기';
    return isNewSave ? '저장하기' : '완료';
  }, [selected.size, isNewSave]);

  return (
    <AnimatePresence>
      {open && restaurant && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.6 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-[400px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* 그랩 핸들 */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <span className="w-9 h-1.5 rounded-full bg-slate-200" />
            </div>

            {/* 대상 맛집 미리보기 */}
            <div className="px-5 pt-3 pb-3 flex items-center gap-3 shrink-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                {restaurant.thumbnail ? (
                  <img src={restaurant.thumbnail} alt={restaurant.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center"><Utensils size={18} className="text-slate-400" /></div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-orange-500">{isNewSave ? '어디에 저장할까요?' : '저장 컬렉션 관리'}</p>
                <p className="text-[15px] font-black text-slate-800 truncate">{restaurant.name || '이 맛집'}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 transition-colors"><X size={18} /></button>
            </div>

            {/* 폴더 목록 */}
            <div className="px-4 pb-2 overflow-y-auto flex-1" style={{ scrollbarWidth: 'none' }}>
              {folders.map(f => {
                const on = selected.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggle(f.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-2xl mb-1.5 border transition-all ${
                      on ? 'border-orange-400 bg-orange-50' : 'border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-9 h-9 flex items-center justify-center shrink-0">
                      <PinIcon color={f.color || '#FF6F00'} filled size={26} />
                    </span>
                    <span className="text-[14px] font-bold text-slate-800 text-left truncate flex-1">{f.name}</span>
                    <span className="text-[11px] font-bold text-slate-400 tabular-nums">{folderCounts[f.id] || 0}곳</span>
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                        on ? 'bg-orange-500 border-orange-500 text-white' : 'border-slate-300 text-transparent'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </span>
                  </button>
                );
              })}

              {/* 새 컬렉션 */}
              {creating ? (
                <div className="p-3 rounded-2xl border border-orange-200 bg-orange-50/40 mb-1.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="w-9 h-9 flex items-center justify-center shrink-0"><PinIcon color={newColor} filled size={26} /></span>
                    <input
                      autoFocus
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                      placeholder="컬렉션 이름 (예: 데이트 코스)"
                      maxLength={20}
                      className="flex-1 min-w-0 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-800 focus:outline-none focus:border-orange-400"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    {COLOR_PRESET.map(c => (
                      <button key={c} onClick={() => setNewColor(c)} className={`w-6 h-6 rounded-full transition-transform ${newColor.toUpperCase() === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`} style={{ background: c }} />
                    ))}
                    {/* HTML 색상 피커 — 전체 색상표에서 자유 선택 */}
                    <label className="w-6 h-6 rounded-full relative overflow-hidden cursor-pointer ring-1 ring-slate-300"
                      style={{ background: 'conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)' }}
                      title="원하는 색 직접 선택">
                      <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer" />
                      <Plus size={12} className="absolute inset-0 m-auto text-white drop-shadow" />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-xl text-[12px] font-bold text-slate-500 bg-white border border-slate-200">취소</button>
                    <button onClick={handleCreate} disabled={!newName.trim()} className="flex-1 py-2 rounded-xl text-[12px] font-black text-white disabled:opacity-40" style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}>만들기</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setCreating(true)} className="w-full flex items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-dashed border-orange-300 text-orange-500 text-[13px] font-bold mb-1.5 hover:bg-orange-50 transition-colors">
                  <Plus size={16} /> 새 컬렉션
                </button>
              )}
            </div>

            {/* CTA */}
            <div className="p-4 pt-2 shrink-0 border-t border-slate-100" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 16px)' }}>
              <button
                onClick={handleCommit}
                disabled={saving || (selected.size === 0 && isNewSave)}
                className="w-full py-3.5 rounded-2xl text-[15px] font-black text-white active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: selected.size === 0 && !isNewSave ? '#64748b' : 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}
              >
                {saving ? '저장 중…' : ctaLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
