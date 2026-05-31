'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomModal from './CustomModal';
import { supabase } from '@/lib/supabase/client';
import { Search, MapPin, CheckCircle2, ChevronRight, Sparkles, ArrowLeft, Utensils } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import Toast from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface PlaceResult {
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_name: string;
  category_group_name: string;
  x: string; // lng
  y: string; // lat
  place_url: string; // 카카오맵 상세 주소
}

export default function RestaurantSubmissionBottomSheet({ isOpen, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<{ status: 'approved' | 'rejected', reason: string, youtuber_name?: string, extracted_menu?: string, parking_info?: string } | null>(null);
  const { toastMessage, isVisible, showToast } = useToast();

  // 카카오 장소 검색
  useEffect(() => {
    if (!searchQuery.trim() || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(searchQuery, (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
          // 주유소, 마트 등 비식당 카테고리 엄격하게 필터링 (음식점 FD6, 카페 CE7)
          const filteredData = (data as any[]).filter(place => 
            place.category_group_code === 'FD6' || 
            place.category_group_code === 'CE7' ||
            place.category_name.includes('음식점') ||
            place.category_name.includes('카페') ||
            place.category_name.includes('베이커리')
          );
          setSearchResults(filteredData);
        } else {
          setSearchResults([]);
        }
      });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const isValidYoutube = (url: string) => {
    return url.includes('youtu');
  };

  const handleSubmit = async () => {
    if (!selectedPlace) {
      showToast({ message: "장소를 먼저 선택해주세요." });
      return;
    }
    if (!youtubeUrl) {
      showToast({ message: "유튜브 영상 링크를 입력해주세요." });
      return;
    }
    if (!isValidYoutube(youtubeUrl)) {
      showToast({ message: "올바른 유튜브 링크(youtu가 포함된 URL)를 입력해주세요." });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { data: insertData, error } = await supabase.from('user_submissions').insert({
        kakao_place_id: selectedPlace.id,
        raw_name: selectedPlace.place_name,
        raw_address: selectedPlace.road_address_name || selectedPlace.address_name,
        lat: parseFloat(selectedPlace.y),
        lng: parseFloat(selectedPlace.x),
        source_url: youtubeUrl,
        source_type: 'youtube',
        status: 'pending'
      }).select('id').single();

      if (error) {
        console.error("Supabase Error:", error);
        throw new Error(error.message);
      }
      
      // 동기식으로 AI 심사 기다리기
      const reviewRes = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: insertData.id })
      });
      
      const reviewData = await reviewRes.json();
      
      if (!reviewRes.ok) {
        throw new Error(reviewData.error || 'AI 심사 중 오류가 발생했습니다.');
      }
      
      setAiResult({
        status: reviewData.status,
        reason: reviewData.aiResult?.reason || '이유 알 수 없음',
        youtuber_name: reviewData.aiResult?.youtuber_name,
        extracted_menu: reviewData.aiResult?.extracted_menu,
        parking_info: reviewData.aiResult?.parking_info
      });

      // 로컬스토리지에 제보 내역 저장 및 동기화
      try {
        const savedHistory = localStorage.getItem('user_submissions_history');
        const history = savedHistory ? JSON.parse(savedHistory) : [];
        const newSubmission = {
          id: insertData.id,
          name: selectedPlace.place_name,
          address: selectedPlace.road_address_name || selectedPlace.address_name,
          date: new Date().toISOString().split('T')[0],
          status: reviewData.status || 'pending'
        };
        const nextHistory = [newSubmission, ...history.filter((h: any) => h.id !== insertData.id)];
        localStorage.setItem('user_submissions_history', JSON.stringify(nextHistory));
        // 업데이트 이벤트 트리거
        window.dispatchEvent(new Event('refresh-restaurants'));
      } catch (storageErr) {
        console.error('Failed to update submission history in localStorage', storageErr);
      }
      
    } catch (err: any) {
      console.error("Submission failed", err);
      showToast({ message: err.message || '제보 중 알 수 없는 에러가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAiResult(null);
    setStep(1);
    setSearchQuery('');
    setSelectedPlace(null);
    setYoutubeUrl('');
    onClose();
  };

  const handleCloseAfterSuccess = () => {
    // 맵 리프레시 이벤트 발송
    window.dispatchEvent(new Event('refresh-restaurants'));
    resetForm();
  };

  // 스텝 프로그레스 바
  const StepProgressBar = () => (
    <div className="flex items-center gap-3 px-1 mb-5">
      {/* Step 1 */}
      <div className="flex items-center gap-2 flex-1">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all duration-300 ${
          step >= 1 
            ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25' 
            : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
        }`}>
          {selectedPlace ? <CheckCircle2 size={14} /> : '1'}
        </div>
        <span className={`text-[11px] font-bold transition-colors ${step >= 1 ? 'text-white' : 'text-zinc-600'}`}>장소 선택</span>
      </div>
      
      {/* 프로그레스 연결선 */}
      <div className="flex-1 h-[2px] rounded-full overflow-hidden bg-zinc-800">
        <motion.div 
          className="h-full bg-gradient-to-r from-red-500 to-orange-500"
          initial={{ width: '0%' }}
          animate={{ width: step >= 2 ? '100%' : '0%' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
      
      {/* Step 2 */}
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span className={`text-[11px] font-bold transition-colors ${step >= 2 ? 'text-white' : 'text-zinc-600'}`}>영상 링크</span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all duration-300 ${
          step >= 2 
            ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25' 
            : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
        }`}>
          2
        </div>
      </div>
    </div>
  );

  return (
    <>
      <CustomModal 
        isOpen={isOpen} 
        onClose={resetForm} 
        title={aiResult ? undefined : "맛집 제보하기"}
        subtitle={aiResult ? undefined : "나만의 맛집을 제보하고 AI에게 맛집 심사를 받아보세요."}
      >
        <div className="py-1 min-h-[350px]">
          {aiResult ? (
            /* ───── AI 심사 결과 화면 ───── */
            <AnimatePresence mode="wait">
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="flex flex-col items-center justify-center min-h-[320px] text-center"
              >
                {aiResult.status === 'approved' ? (
                  <>
                    {/* 합격 아이콘 - 그라데이션 글로우 */}
                    <div className="relative mb-5">
                      <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/30 blur-xl" />
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
                        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-2xl shadow-red-500/30"
                      >
                        <CheckCircle2 size={36} className="text-white" />
                      </motion.div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <h3 className="text-xl font-black text-white tracking-tight mb-1.5">심사 합격!</h3>
                      <p className="text-[13px] text-zinc-400 font-medium">지도에 핫플이 등록되었어요 🎉</p>
                    </motion.div>
                    
                    {/* 유튜버 뱃지 */}
                    {aiResult.youtuber_name && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.45 }}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20"
                      >
                        <Sparkles size={14} className="text-orange-400" />
                        <span className="text-[13px] text-white/90 font-bold">
                          <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">{aiResult.youtuber_name}</span>님의 핫플
                        </span>
                      </motion.div>
                    )}

                    {/* AI 요약 정보 카드 */}
                    {(aiResult.extracted_menu || aiResult.parking_info) && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 }}
                        className="mt-5 w-full max-w-[340px]"
                      >
                        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2 pb-2.5 border-b border-white/[0.06]">
                            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                              <Sparkles size={10} className="text-white" />
                            </div>
                            <span className="text-[12px] font-bold text-white/80">AI 팩트체크 요약</span>
                          </div>
                          
                          {aiResult.extracted_menu && aiResult.extracted_menu !== '정보 없음' && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center shrink-0 mt-0.5">
                                <Utensils size={14} className="text-orange-400" />
                              </div>
                              <div className="text-left min-w-0">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">추천 메뉴</span>
                                <span className="text-[13px] text-white font-bold leading-snug mt-0.5 block">{aiResult.extracted_menu}</span>
                              </div>
                            </div>
                          )}
                          {aiResult.parking_info && aiResult.parking_info !== '정보 없음' && (
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/15 flex items-center justify-center shrink-0 mt-0.5">
                                <MapPin size={14} className="text-sky-400" />
                              </div>
                              <div className="text-left min-w-0">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">주차 정보</span>
                                <span className="text-[13px] text-white font-bold leading-snug mt-0.5 block">{aiResult.parking_info}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* 닫기 버튼 */}
                    <motion.button 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      onClick={handleCloseAfterSuccess} 
                      className="mt-6 w-full max-w-[280px] py-3.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold text-[14px] rounded-2xl transition-all cursor-pointer shadow-lg shadow-red-500/15 active:scale-[0.97]"
                    >
                      확인
                    </motion.button>
                  </>
                ) : (
                  <>
                    {/* 반려 아이콘 */}
                    <div className="relative mb-5">
                      <div className="absolute inset-0 w-20 h-20 rounded-full bg-red-500/20 blur-xl" />
                      <motion.div
                        initial={{ scale: 0, rotate: -45 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                        className="relative w-20 h-20 rounded-full bg-zinc-900 border-2 border-red-500/30 flex items-center justify-center"
                      >
                        <span className="text-red-500 text-3xl font-black">✕</span>
                      </motion.div>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <h3 className="text-xl font-black text-white tracking-tight mb-1.5">반려되었습니다</h3>
                      <p className="text-[13px] text-zinc-400 font-medium mb-4">조건에 부합하지 않아 등록되지 못했어요</p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="w-full max-w-[320px] bg-zinc-900/60 border border-red-500/10 rounded-2xl p-4 text-left"
                    >
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-5 h-5 rounded-md bg-red-500/10 flex items-center justify-center">
                          <Sparkles size={10} className="text-red-400" />
                        </div>
                        <span className="text-[11px] font-bold text-red-400">AI 판단 사유</span>
                      </div>
                      <p className="text-[13px] text-white/80 leading-relaxed break-keep">{aiResult.reason}</p>
                    </motion.div>

                    <motion.button 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      onClick={() => setAiResult(null)} 
                      className="mt-6 w-full max-w-[280px] py-3.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-bold text-[14px] rounded-2xl transition-all cursor-pointer shadow-lg shadow-red-500/15 active:scale-[0.97]"
                    >
                      다시 제보하기
                    </motion.button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <>
              {/* 스텝 프로그레스 */}
              <StepProgressBar />

              <AnimatePresence mode="wait">
                {step === 1 ? (
                  /* ───── Step 1: 장소 검색 ───── */
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    {/* 검색 입력 */}
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-400 transition-colors">
                        <Search size={18} />
                      </div>
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="식당 이름을 검색하세요" 
                        className="w-full bg-zinc-900/60 border border-white/[0.06] rounded-2xl py-3.5 pl-12 pr-4 text-[14px] text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 focus:shadow-[0_0_0_3px_rgba(255,111,0,0.08)] transition-all"
                      />
                    </div>

                    {/* 검색 결과 리스트 */}
                    <div className="max-h-[250px] overflow-y-auto space-y-2 pb-2 scrollbar-thin">
                      {searchResults.map((place, idx) => {
                        const categoryChunks = place.category_name ? place.category_name.split(' > ') : [];
                        const specificCategory = categoryChunks.length > 1 
                          ? categoryChunks.slice(1).join(' · ') 
                          : place.category_group_name || '식당';

                        return (
                          <motion.div 
                            key={place.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: idx * 0.04 }}
                            onClick={() => {
                              setSelectedPlace(place);
                              setStep(2);
                            }}
                            className="group/card p-3.5 bg-zinc-900/40 border border-white/[0.04] rounded-xl cursor-pointer hover:bg-zinc-800/60 hover:border-orange-500/15 active:scale-[0.98] transition-all flex items-center justify-between gap-3"
                          >
                            {/* 좌측: 아이콘 + 정보 */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/10 flex items-center justify-center shrink-0 group-hover/card:border-orange-500/20 transition-colors">
                                <Utensils size={16} className="text-orange-400/70 group-hover/card:text-orange-400 transition-colors" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-baseline gap-2 mb-0.5">
                                  <span className="text-[14px] font-bold text-white truncate">
                                    {place.place_name}
                                  </span>
                                  {specificCategory && (
                                    <span className="text-[10px] font-medium text-zinc-500 shrink-0">
                                      {specificCategory}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center text-[12px] text-zinc-500 truncate">
                                  <MapPin size={11} className="mr-1 shrink-0 text-zinc-600" />
                                  {place.road_address_name || place.address_name}
                                </div>
                              </div>
                            </div>
                            
                            {/* 우측: 화살표 */}
                            <div className="w-6 h-6 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0 group-hover/card:bg-orange-500/10 transition-colors">
                              <ChevronRight size={14} className="text-zinc-600 group-hover/card:text-orange-400 transition-colors" />
                            </div>
                          </motion.div>
                        );
                      })}

                      {/* 검색 결과 없음 */}
                      {searchQuery && searchResults.length === 0 && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center py-12"
                        >
                          <div className="w-14 h-14 mx-auto rounded-2xl bg-zinc-900/60 border border-white/[0.04] flex items-center justify-center mb-3">
                            <Search size={22} className="text-zinc-600" />
                          </div>
                          <div className="text-white/70 text-[14px] font-bold">검색 결과가 없습니다</div>
                          <div className="text-zinc-600 text-[12px] mt-1.5 font-medium">상호명이나 지역명을 다시 확인해 주세요</div>
                        </motion.div>
                      )}

                      {/* 검색 초기 가이드 */}
                      {!searchQuery && (
                        <div className="text-center py-10">
                          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-red-500/[0.06] to-orange-500/[0.06] border border-red-500/[0.08] flex items-center justify-center mb-3">
                            <MapPin size={22} className="text-orange-500/50" />
                          </div>
                          <div className="text-zinc-500 text-[13px] font-bold">제보할 맛집을 검색해 주세요</div>
                          <div className="text-zinc-700 text-[11px] mt-1 font-medium">카카오맵 기반으로 정확한 장소를 찾아드려요</div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  /* ───── Step 2: 유튜브 링크 입력 ───── */
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-5"
                  >
                    {/* 선택된 장소 표시 카드 */}
                    <div className="relative overflow-hidden rounded-2xl bg-zinc-900/50 border border-white/[0.06]">
                      {/* 상단 그라데이션 액센트 */}
                      <div className="h-[3px] w-full bg-gradient-to-r from-red-500 to-orange-500" />
                      <div className="p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/15 to-orange-500/15 border border-orange-500/15 flex items-center justify-center shrink-0">
                            <MapPin size={18} className="text-orange-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[14px] font-bold text-white truncate">{selectedPlace?.place_name}</div>
                            <div className="text-[11px] text-zinc-500 font-medium truncate mt-0.5">{selectedPlace?.road_address_name || selectedPlace?.address_name}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => setStep(1)} 
                          className="flex items-center gap-1 text-[11px] text-zinc-400 font-bold px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl transition-colors cursor-pointer shrink-0"
                        >
                          <ArrowLeft size={12} />
                          변경
                        </button>
                      </div>
                    </div>

                    {/* 유튜브 링크 입력 */}
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 px-1">
                        <svg viewBox="0 0 28 20" className="w-[18px] h-[13px] shrink-0"><rect width="28" height="20" rx="4" fill="#FF0000"/><polygon points="11,4 11,16 21,10" fill="#fff"/></svg>
                        <span className="text-[13px] font-bold text-white/80">유튜브 리뷰 영상 링크</span>
                        {youtubeUrl && isValidYoutube(youtubeUrl) && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full"
                          >
                            ✓ 유효
                          </motion.span>
                        )}
                      </div>
                      <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2">
                            <svg viewBox="0 0 28 20" className="w-5 h-3.5"><rect width="28" height="20" rx="4" fill="#FF0000"/><polygon points="11,4 11,16 21,10" fill="#fff"/></svg>
                        </div>
                        <input 
                          type="text" 
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..." 
                          className={`w-full bg-zinc-900/60 border rounded-2xl py-3.5 pl-14 pr-4 text-[14px] text-white placeholder-zinc-600 focus:outline-none transition-all ${
                            youtubeUrl && isValidYoutube(youtubeUrl) 
                              ? 'border-emerald-500/30 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.08)]' 
                              : 'border-white/[0.06] focus:border-orange-500/40 focus:shadow-[0_0_0_3px_rgba(255,111,0,0.08)]'
                          }`}
                        />
                      </div>
                      <p className="text-[11px] text-zinc-600 font-medium px-1">해당 맛집을 소개하는 유튜브 영상 URL을 붙여넣어 주세요</p>
                    </div>

                    {/* 제출 버튼 */}
                    <div className="pt-3">
                      <button 
                        className={`relative w-full py-4 rounded-2xl text-[15px] font-bold transition-all flex items-center justify-center cursor-pointer overflow-hidden ${
                          isSubmitting 
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-500 hover:to-orange-400 active:scale-[0.98] shadow-xl shadow-red-500/15'
                        }`}
                        disabled={isSubmitting}
                        onClick={handleSubmit}
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-2.5">
                            {/* 로딩 스피너 */}
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                              <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span>맛집 검증 중...</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Sparkles size={16} />
                            <span>AI에게 맛집 심사 요청하기</span>
                          </div>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </CustomModal>
      <Toast message={toastMessage} isVisible={isVisible} />
    </>
  );
}
