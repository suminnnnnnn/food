'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomModal from './CustomModal';
import { supabase } from '@/lib/supabase/client';
import { Search, MapPin, CheckCircle2, ChevronRight, Sparkles, ArrowLeft, Utensils, Play } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import Toast from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialRestaurant?: { id: string; name: string } | null;
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

export default function RestaurantSubmissionBottomSheet({ isOpen, onClose, initialRestaurant }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  
  // AI 추출 데이터
  const [extractedName, setExtractedName] = useState('');
  const [extractedAddress, setExtractedAddress] = useState('');
  const [videoMeta, setVideoMeta] = useState<{ title: string; author: string; thumbnail: string } | null>(null);

  // 카카오 지도 장소 매칭 관련
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<{ status: 'approved' | 'rejected', reason: string, youtuber_name?: string, extracted_menu?: string, parking_info?: string } | null>(null);
  const { toastMessage, isVisible, showToast } = useToast();

  // 모달 닫기 시 상태 리셋
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setYoutubeUrl('');
      setIsExtracting(false);
      setExtractedName('');
      setExtractedAddress('');
      setVideoMeta(null);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPlace(null);
      setAiResult(null);
    } else if (initialRestaurant) {
      // 기존 맛집에 비디오 링크만 추가하는 모드일 경우 바로 2단계
      setStep(2);
    }
  }, [isOpen, initialRestaurant]);

  // 카카오 장소 검색 디바운스 연동 (AI 추출 상호명 또는 검색어 변경 시 동작)
  useEffect(() => {
    if (!searchQuery.trim() || !window.kakao || !window.kakao.maps || !window.kakao.maps.services) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      const ps = new kakao.maps.services.Places();
      ps.keywordSearch(searchQuery, (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
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
    }, 450);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const isValidYoutube = (url: string) => {
    return url.includes('youtu');
  };

  // 1단계: 링크에서 AI 상호명 추출하기
  const handleExtractLink = async () => {
    if (!youtubeUrl) {
      showToast({ message: "유튜브 영상 링크를 입력해주세요." });
      return;
    }
    if (!isValidYoutube(youtubeUrl)) {
      showToast({ message: "올바른 유튜브 링크(youtu가 포함된 URL)를 입력해주세요." });
      return;
    }

    setIsExtracting(true);
    try {
      const res = await fetch('/api/review/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: youtubeUrl.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '영상 분석에 실패했습니다.');
      }

      setVideoMeta({
        title: data.videoTitle,
        author: data.authorName,
        thumbnail: data.thumbnailUrl,
      });

      if (data.extracted && data.extracted.name) {
        setExtractedName(data.extracted.name);
        setExtractedAddress(data.extracted.address || '');
        setSearchQuery(data.extracted.name); // 장소 자동 검색 연계
      } else {
        showToast({ message: "AI가 영상에서 맛집 상호명을 찾아내지 못했습니다. 직접 검색해 주세요." });
        setSearchQuery('');
      }

      setStep(2); // 다음 장소 매칭 단계로 이동
    } catch (err: any) {
      console.error("AI extraction error", err);
      showToast({ message: err.message || '영상 추출 중 오류가 발생했습니다.' });
    } finally {
      setIsExtracting(false);
    }
  };

  // 2단계: 최종 제보 및 AI 팩트체크 심사 요청
  const handleSubmit = async () => {
    if (!initialRestaurant && !selectedPlace) {
      showToast({ message: "장소를 리스트에서 최종 선택해주세요." });
      return;
    }
    
    setIsSubmitting(true);
    try {
      if (initialRestaurant) {
        const res = await fetch('/api/videos/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            restaurantId: initialRestaurant.id,
            restaurantName: initialRestaurant.name,
            youtubeUrl: youtubeUrl.trim(),
          }),
        });
        const data = await res.json();
        
        if (!res.ok) {
          setAiResult({
            status: 'rejected',
            reason: data.error || '영상 검수에 실패했습니다.',
          });
        } else {
          setAiResult({
            status: 'approved',
            reason: '영상이 성공적으로 등록되었습니다.',
          });
          window.dispatchEvent(new Event('refresh-restaurants'));
        }
      } else {
        // user_submissions 제보 데이터 적재
        const { data: insertData, error } = await supabase.from('user_submissions').insert({
          kakao_place_id: selectedPlace!.id,
          raw_name: selectedPlace!.place_name,
          raw_address: selectedPlace!.road_address_name || selectedPlace!.address_name,
          lat: parseFloat(selectedPlace!.y),
          lng: parseFloat(selectedPlace!.x),
          source_url: youtubeUrl.trim(),
          source_type: 'youtube',
          status: 'pending'
        }).select('id').single();

        if (error) {
          throw new Error(error.message);
        }
        
        // 백엔드 AI 최종 검수 파이프라인 가동
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

        // 로컬 제보 내역 캐싱
        try {
          const savedHistory = localStorage.getItem('user_submissions_history');
          const history = savedHistory ? JSON.parse(savedHistory) : [];
          const newSubmission = {
            id: insertData.id,
            name: selectedPlace!.place_name,
            address: selectedPlace!.road_address_name || selectedPlace!.address_name,
            date: new Date().toISOString().split('T')[0],
            status: reviewData.status || 'pending'
          };
          const nextHistory = [newSubmission, ...history.filter((h: any) => h.id !== insertData.id)];
          localStorage.setItem('user_submissions_history', JSON.stringify(nextHistory));
          window.dispatchEvent(new Event('refresh-restaurants'));
        } catch (storageErr) {
          console.error('Failed to update submission history in localStorage', storageErr);
        }
      }
      
    } catch (err: any) {
      console.error("Submission failed", err);
      showToast({ message: err.message || '제보 심사 요청 중 에러가 발생했습니다.' });
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
    window.dispatchEvent(new Event('refresh-restaurants'));
    resetForm();
  };

  // 프로그레스 바
  const StepProgressBar = () => (
    <div className="flex items-center gap-3 px-1 mb-5">
      <div className="flex items-center gap-2 flex-1">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all duration-300 ${
          step >= 1 ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
        }`}>
          {videoMeta ? <CheckCircle2 size={14} /> : '1'}
        </div>
        <span className={`text-[11px] font-bold transition-colors ${step >= 1 ? 'text-white' : 'text-zinc-600'}`}>링크 분석</span>
      </div>
      <div className="flex-1 h-[2px] rounded-full overflow-hidden bg-zinc-800">
        <motion.div 
          className="h-full bg-gradient-to-r from-red-500 to-orange-500"
          initial={{ width: '0%' }}
          animate={{ width: step >= 2 ? '100%' : '0%' }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span className={`text-[11px] font-bold transition-colors ${step >= 2 ? 'text-white' : 'text-zinc-600'}`}>장소 매칭</span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all duration-300 ${
          step >= 2 ? 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/25' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
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
        title={aiResult ? undefined : (initialRestaurant ? "영상 제보하기" : "맛집 링크 제보")}
        subtitle={aiResult ? undefined : (initialRestaurant ? "유튜브 리뷰 영상을 추가하여 더 풍성한 지도를 만들어보세요." : "유튜브 링크 하나만 넣으면 AI가 영상 속 맛집 위치를 자동으로 찾아서 등록합니다.")}
      >
        <div className="py-1 min-h-[350px]">
          {aiResult ? (
            /* ───── AI 최종 심사 결과 화면 ───── */
            <AnimatePresence mode="wait">
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center min-h-[320px] text-center"
              >
                {aiResult.status === 'approved' ? (
                  <>
                    <div className="relative mb-5">
                      <div className="absolute inset-0 w-20 h-20 rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/30 blur-xl" />
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-2xl shadow-red-500/30"
                      >
                        <CheckCircle2 size={36} className="text-white" />
                      </motion.div>
                    </div>

                    <h3 className="text-xl font-black text-white tracking-tight mb-1.5">심사 합격!</h3>
                    <p className="text-[13px] text-zinc-400 font-medium">지도에 맛집이 성공적으로 등록되었습니다 🎉</p>
                    
                    {aiResult.youtuber_name && (
                      <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20">
                        <Sparkles size={14} className="text-orange-400" />
                        <span className="text-[13px] text-white/90 font-bold">
                          <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">{aiResult.youtuber_name}</span>님의 추천 핫플
                        </span>
                      </div>
                    )}

                    {(aiResult.extracted_menu || aiResult.parking_info) && (
                      <div className="mt-5 w-full max-w-[340px]">
                        <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2 pb-2.5 border-b border-white/[0.06]">
                            <Sparkles size={12} className="text-orange-400" />
                            <span className="text-[12px] font-bold text-white/80">AI 맛집 팩트체크</span>
                          </div>
                          {aiResult.extracted_menu && aiResult.extracted_menu !== '정보 없음' && (
                            <div className="flex items-start gap-3">
                              <Utensils size={14} className="text-orange-400 mt-1 shrink-0" />
                              <div className="text-left">
                                <span className="text-[10px] text-zinc-500 font-bold block">대표 메뉴</span>
                                <span className="text-[13px] text-white font-bold block">{aiResult.extracted_menu}</span>
                              </div>
                            </div>
                          )}
                          {aiResult.parking_info && aiResult.parking_info !== '정보 없음' && (
                            <div className="flex items-start gap-3">
                              <MapPin size={14} className="text-sky-400 mt-1 shrink-0" />
                              <div className="text-left">
                                <span className="text-[10px] text-zinc-500 font-bold block">주차 정보</span>
                                <span className="text-[13px] text-white font-bold block">{aiResult.parking_info}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={handleCloseAfterSuccess} 
                      className="mt-6 w-full max-w-[280px] py-3.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold text-[14px] rounded-2xl transition-all cursor-pointer shadow-lg active:scale-[0.97]"
                    >
                      확인
                    </button>
                  </>
                ) : (
                  <>
                    <div className="relative mb-5">
                      <div className="absolute inset-0 w-20 h-20 rounded-full bg-red-500/20 blur-xl" />
                      <div className="relative w-20 h-20 rounded-full bg-zinc-900 border-2 border-red-500/30 flex items-center justify-center">
                        <span className="text-red-500 text-3xl font-black">✕</span>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-white tracking-tight mb-1.5">반려되었습니다</h3>
                    <p className="text-[13px] text-zinc-400 font-medium mb-4">등록 조건을 충족하지 못했습니다.</p>

                    <div className="w-full max-w-[320px] bg-zinc-900/60 border border-red-500/10 rounded-2xl p-4 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={12} className="text-red-400" />
                        <span className="text-[11px] font-bold text-red-400">AI 심사평</span>
                      </div>
                      <p className="text-[13px] text-white/80 leading-relaxed break-keep">{aiResult.reason}</p>
                    </div>

                    <button 
                      onClick={() => setAiResult(null)} 
                      className="mt-6 w-full max-w-[280px] py-3.5 bg-gradient-to-r from-red-600 to-orange-500 text-white font-bold text-[14px] rounded-2xl transition-all cursor-pointer shadow-lg active:scale-[0.97]"
                    >
                      다시 제보하기
                    </button>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <>
              {!initialRestaurant && StepProgressBar()}

              <AnimatePresence mode="wait">
                {step === 1 && !initialRestaurant ? (
                  /* ───── 스텝 1: 유튜브 영상 링크 입력 및 AI 추출 ───── */
                  <motion.div 
                    key="linkStep"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <Play size={14} className="text-red-500 fill-red-500" />
                        <span className="text-[13px] font-bold text-white/80">유튜브 핫플 영상 링크</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={youtubeUrl}
                          onChange={(e) => setYoutubeUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=... 또는 단축 주소" 
                          className="w-full bg-zinc-900/60 border border-white/[0.06] rounded-2xl py-3.5 px-4 text-[14px] text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/40 transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 font-bold px-1">
                        소셜 미디어(유튜브 롱폼) 링크를 넣으면 AI가 상호명과 위치를 자동 추출합니다.
                      </p>
                    </div>

                    <button
                      onClick={handleExtractLink}
                      disabled={isExtracting}
                      className={`w-full py-4 rounded-2xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isExtracting ? 'bg-zinc-800 text-zinc-500' : 'bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-500 active:scale-[0.98]'
                      }`}
                    >
                      {isExtracting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>AI 영상 분석 및 식당 정보 추출 중...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>AI 분석 및 식당 위치 찾기</span>
                        </>
                      )}
                    </button>
                  </motion.div>
                ) : (
                  /* ───── 스텝 2: 장소 매칭 및 최종 제보 ───── */
                  <motion.div 
                    key="confirmStep"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* 추출된 비디오 메타 정보 카드 */}
                    {videoMeta && (
                      <div className="flex gap-3 bg-zinc-900/40 border border-white/[0.04] p-3 rounded-2xl">
                        <div className="w-16 aspect-video bg-zinc-800 rounded-lg overflow-hidden shrink-0">
                          <img src={videoMeta.thumbnail} alt={videoMeta.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                          <h4 className="text-[12px] font-black text-white truncate leading-snug">{videoMeta.title}</h4>
                          <span className="text-[10px] text-zinc-500 font-bold block mt-1">{videoMeta.author}</span>
                        </div>
                      </div>
                    )}

                    {/* AI 추출 및 장소 검색 가이드 문구 */}
                    <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/15 p-3 rounded-2xl">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles size={12} className="text-orange-400" />
                        <span className="text-[11px] font-black text-orange-400">AI 추출 식당: "{extractedName}"</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-zinc-400 font-medium">
                        영상에서 도출된 상호명으로 자동 검색된 결과입니다. **지점명이나 주소를 비교하여 실제 핫플이 일치하는 행을 최종 터치**해 주세요.
                      </p>
                    </div>

                    {/* 검색어 수정용 입력창 */}
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input 
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="상호명을 수정하거나 직접 검색"
                        className="w-full bg-zinc-900/50 border border-white/[0.06] rounded-xl py-2.5 pl-10 pr-4 text-[12px] text-white"
                      />
                    </div>

                    {/* 카카오맵 매칭 후보군 목록 */}
                    <div className="max-h-[160px] overflow-y-auto space-y-2 pb-2 scrollbar-thin">
                      {searchResults.map((place) => {
                        const isSelected = selectedPlace?.id === place.id;
                        return (
                          <div 
                            key={place.id}
                            onClick={() => setSelectedPlace(place)}
                            className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                              isSelected 
                                ? 'bg-orange-500/10 border-orange-500/60 shadow-lg shadow-orange-500/5' 
                                : 'bg-zinc-900/30 border-white/[0.04] hover:bg-zinc-800/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-orange-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                <Utensils size={14} />
                              </div>
                              <div className="min-w-0 text-left">
                                <h4 className="text-[12.5px] font-black text-white truncate">{place.place_name}</h4>
                                <span className="text-[10px] text-zinc-500 font-bold block truncate mt-0.5">{place.road_address_name || place.address_name}</span>
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 size={16} className="text-orange-500 shrink-0" />}
                          </div>
                        );
                      })}

                      {searchResults.length === 0 && (
                        <div className="text-center py-6 text-[11px] text-zinc-600 font-bold">
                          매칭되는 식당 후보가 없습니다. 상호명을 다시 입력해 보세요.
                        </div>
                      )}
                    </div>

                    {/* 최종 제출 버튼 */}
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || (!initialRestaurant && !selectedPlace)}
                      className={`w-full py-4 rounded-2xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isSubmitting || (!initialRestaurant && !selectedPlace)
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-red-600 to-orange-500 text-white hover:from-red-500 active:scale-[0.98]'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>맛집 정밀 검수 및 등록 요청 중...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>AI 팩트체크 및 최종 등록 심사</span>
                        </>
                      )}
                    </button>
                    
                    {!initialRestaurant && (
                      <button 
                        onClick={() => setStep(1)}
                        className="w-full text-center text-zinc-500 hover:text-zinc-300 font-bold text-[11px] py-1 cursor-pointer"
                      >
                        이전 단계로 돌아가기
                      </button>
                    )}
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
