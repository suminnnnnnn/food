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
  const [aiResult, setAiResult] = useState<{ status: 'approved' | 'held' | 'rejected', reason: string, youtuber_name?: string, extracted_menu?: string, parking_info?: string } | null>(null);
  const [subHours, setSubHours] = useState('');
  const [subMenu, setSubMenu] = useState('');
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

  // 2단계: 입력한 유튜브 링크의 메타(제목·썸네일·채널)를 가져와 미리보기 (AI 추출 없이 skipAi)
  const fetchVideoMeta = async (url: string) => {
    if (!url || !isValidYoutube(url)) return;
    setIsExtracting(true);
    try {
      const res = await fetch('/api/review/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeUrl: url.trim(), skipAi: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setVideoMeta({ title: data.videoTitle, author: data.authorName, thumbnail: data.thumbnailUrl });
      }
    } catch (err) {
      console.warn('video meta fetch failed', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // 최종 제보 — 서버(/api/review)가 이 영상이 선택한 맛집을 소개한 게 맞는지 매칭·검증
  const handleSubmit = async () => {
    if (!initialRestaurant && !selectedPlace) {
      showToast({ message: "먼저 맛집을 검색해서 선택해 주세요." });
      return;
    }
    if (!youtubeUrl || !isValidYoutube(youtubeUrl)) {
      showToast({ message: "유튜브 영상 링크를 입력해 주세요." });
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
        // 로그인 유저 id (일일 제보 한도용). FK 안전을 위해 유효 UUID + 목업 폴백 제외.
        let submitterId: string | null = null;
        try {
          const u = JSON.parse(localStorage.getItem('modoo-matjip-user') || 'null');
          if (u?.id && /^[0-9a-f-]{36}$/i.test(u.id) && u.id !== '00000000-0000-0000-0000-000000000000') submitterId = u.id;
        } catch { /* noop */ }

        // user_submissions 제보 데이터 적재
        const { data: insertData, error } = await supabase.from('user_submissions').insert({
          kakao_place_id: selectedPlace!.id,
          raw_name: selectedPlace!.place_name,
          raw_address: selectedPlace!.road_address_name || selectedPlace!.address_name,
          lat: parseFloat(selectedPlace!.y),
          lng: parseFloat(selectedPlace!.x),
          source_url: youtubeUrl.trim(),
          source_type: 'youtube',
          user_id: submitterId,
          sub_business_hours: subHours.trim() || null,
          sub_menu: subMenu.trim() || null,
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

  // 결과 화면에서 '또 제보하기' — 모달은 유지한 채 처음 단계로 초기화
  const restartSubmission = () => {
    window.dispatchEvent(new Event('refresh-restaurants'));
    setAiResult(null);
    setStep(1);
    setYoutubeUrl('');
    setVideoMeta(null);
    setExtractedName('');
    setExtractedAddress('');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPlace(null);
    setSubHours('');
    setSubMenu('');
  };

  // 결과 미리보기용 요약 (제보한 맛집)
  const submittedName = selectedPlace?.place_name || initialRestaurant?.name || '';
  const submittedCategory = (selectedPlace?.category_name || '').split('>').pop()?.trim() || '';
  const submittedAddr = selectedPlace ? (selectedPlace.road_address_name || selectedPlace.address_name) : '';

  // 프로그레스 바 (라이트 톤)
  const EMBER = 'linear-gradient(100deg,#FF3B30,#FF6F00)';
  const StepProgressBar = () => (
    <div className="flex items-center gap-3 px-1 mb-5">
      <div className="flex items-center gap-2 flex-1">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all duration-300 ${
          step >= 1 ? 'text-white shadow-lg shadow-orange-500/25' : 'bg-slate-100 text-slate-400 border border-slate-200'
        }`} style={step >= 1 ? { background: EMBER } : undefined}>
          {selectedPlace ? <CheckCircle2 size={14} /> : '1'}
        </div>
        <span className={`text-[11px] font-bold transition-colors ${step >= 1 ? 'text-slate-800' : 'text-slate-400'}`}>맛집 선택</span>
      </div>
      <div className="flex-1 h-[2px] rounded-full overflow-hidden bg-slate-200">
        <motion.div
          className="h-full"
          style={{ background: EMBER }}
          initial={{ width: '0%' }}
          animate={{ width: step >= 2 ? '100%' : '0%' }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <div className="flex items-center gap-2 flex-1 justify-end">
        <span className={`text-[11px] font-bold transition-colors ${step >= 2 ? 'text-slate-800' : 'text-slate-400'}`}>영상 링크</span>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 transition-all duration-300 ${
          step >= 2 ? 'text-white shadow-lg shadow-orange-500/25' : 'bg-slate-100 text-slate-400 border border-slate-200'
        }`} style={step >= 2 ? { background: EMBER } : undefined}>
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
        light
        title={aiResult ? undefined : (initialRestaurant ? "영상 추가하기" : (step === 1 ? "어떤 맛집인가요?" : "영상 링크를 넣어주세요"))}
        subtitle={aiResult ? undefined : (initialRestaurant ? "이 맛집에 유튜브 리뷰 영상을 더해요" : (step === 1 ? "제보할 맛집을 검색해 선택해 주세요" : "이 영상이 그 맛집을 소개하는지 AI가 확인해요"))}
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

                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1.5">지도에 올랐어요! 🎉</h3>
                    <p className="text-[13px] text-slate-500 font-medium">당신의 발견이 모두의 지도에 남았어요</p>

                    {/* 내 맛집 미리보기 카드 */}
                    <div className="mt-5 w-full max-w-[340px]">
                      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                        <div className="h-[64px] relative" style={{ background: 'linear-gradient(135deg,#ff8a4c,#ff4d30)' }}>
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.3))' }}>
                            <span style={{ display: 'block', width: 24, height: 24, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: '#FF6F00', boxShadow: '0 0 0 2px #fff' }} />
                          </span>
                        </div>
                        <div className="px-3.5 py-2.5 text-left">
                          <p className="text-[14px] font-black text-slate-800 truncate">{submittedName || '새 맛집'}</p>
                          <p className="text-[11px] text-slate-400 font-bold mt-0.5 truncate">
                            {[aiResult.youtuber_name, submittedCategory, submittedAddr].filter(Boolean).join(' · ') || '지도에 등록됨'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {(aiResult.extracted_menu || aiResult.parking_info) && (
                      <div className="mt-5 w-full max-w-[340px]">
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
                            <Sparkles size={12} className="text-orange-400" />
                            <span className="text-[12px] font-bold text-slate-600">AI 맛집 팩트체크</span>
                          </div>
                          {aiResult.extracted_menu && aiResult.extracted_menu !== '정보 없음' && (
                            <div className="flex items-start gap-3">
                              <Utensils size={14} className="text-orange-400 mt-1 shrink-0" />
                              <div className="text-left">
                                <span className="text-[10px] text-slate-400 font-bold block">대표 메뉴</span>
                                <span className="text-[13px] text-slate-800 font-bold block">{aiResult.extracted_menu}</span>
                              </div>
                            </div>
                          )}
                          {aiResult.parking_info && aiResult.parking_info !== '정보 없음' && (
                            <div className="flex items-start gap-3">
                              <MapPin size={14} className="text-sky-400 mt-1 shrink-0" />
                              <div className="text-left">
                                <span className="text-[10px] text-slate-400 font-bold block">주차 정보</span>
                                <span className="text-[13px] text-slate-800 font-bold block">{aiResult.parking_info}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-6 w-full max-w-[300px] flex gap-2">
                      <button
                        onClick={handleCloseAfterSuccess}
                        className="flex-1 py-3.5 text-white font-black text-[13.5px] rounded-2xl active:scale-[0.97] transition-transform cursor-pointer"
                        style={{ background: 'linear-gradient(100deg,#FF3B30,#FF6F00)' }}
                      >
                        지도에서 보기
                      </button>
                      <button
                        onClick={restartSubmission}
                        className="flex-1 py-3.5 text-slate-600 font-black text-[13.5px] rounded-2xl bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        또 제보하기
                      </button>
                    </div>
                  </>
                ) : aiResult.status === 'held' ? (
                  <>
                    <div className="relative mb-5">
                      <div className="absolute inset-0 w-20 h-20 rounded-full bg-amber-500/20 blur-xl" />
                      <div className="relative w-20 h-20 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
                        <Sparkles size={30} className="text-amber-400" />
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1.5">제보 고마워요! 👀</h3>
                    <p className="text-[13px] text-slate-500 font-medium mb-4">한 번 더 확인한 뒤 지도에 올려드릴게요. 잠시만 기다려 주세요.</p>

                    {aiResult.reason && (
                      <div className="w-full max-w-[320px] bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={12} className="text-amber-500" />
                          <span className="text-[11px] font-bold text-amber-600">한마디</span>
                        </div>
                        <p className="text-[13px] text-slate-600 leading-relaxed break-keep">{aiResult.reason}</p>
                      </div>
                    )}

                    <button
                      onClick={handleCloseAfterSuccess}
                      className="mt-6 w-full max-w-[280px] py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-[14px] rounded-2xl transition-all cursor-pointer shadow-lg active:scale-[0.97]"
                    >
                      확인
                    </button>
                  </>
                ) : (
                  <>
                    <div className="relative mb-5">
                      <div className="absolute inset-0 w-20 h-20 rounded-full bg-red-500/20 blur-xl" />
                      <div className="relative w-20 h-20 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                        <span className="text-red-500 text-3xl font-black">✕</span>
                      </div>
                    </div>

                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-1.5">조금만 더 확인이 필요해요</h3>
                    <p className="text-[13px] text-slate-500 font-medium mb-4">아래 이유를 확인하고 다시 시도해 주세요.</p>

                    <div className="w-full max-w-[320px] bg-red-50 border border-red-200 rounded-2xl p-4 text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={12} className="text-red-500" />
                        <span className="text-[11px] font-bold text-red-600">이유</span>
                      </div>
                      <p className="text-[13px] text-slate-600 leading-relaxed break-keep">{aiResult.reason}</p>
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
                  /* ───── 스텝 1: 맛집 검색·선택 ───── */
                  <motion.div
                    key="searchStep"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div className="relative">
                      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="맛집 상호명으로 검색 (예: 부뚜막 짜글이)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 transition-all"
                      />
                    </div>

                    {/* 카카오맵 후보 목록 */}
                    <div className="max-h-[240px] overflow-y-auto space-y-2 pb-1 scrollbar-thin">
                      {searchResults.map((place) => {
                        const isSelected = selectedPlace?.id === place.id;
                        return (
                          <div key={place.id} onClick={() => setSelectedPlace(place)}
                            className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${isSelected ? 'bg-orange-50 border-orange-500 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}><Utensils size={14} /></div>
                              <div className="min-w-0 text-left">
                                <h4 className="text-[12.5px] font-black text-slate-800 truncate">{place.place_name}</h4>
                                <span className="text-[10px] text-slate-400 font-bold block truncate mt-0.5">{place.road_address_name || place.address_name}</span>
                              </div>
                            </div>
                            {isSelected && <CheckCircle2 size={16} className="text-orange-500 shrink-0" />}
                          </div>
                        );
                      })}
                      {searchQuery.trim().length > 0 && searchResults.length === 0 && (
                        <div className="text-center py-6 text-[11px] text-slate-400 font-bold">검색 결과가 없어요. 상호명을 다시 입력해 보세요.</div>
                      )}
                      {searchQuery.trim().length === 0 && (
                        <div className="text-center py-10 text-[11.5px] text-slate-400 font-medium">유튜브에서 본 맛집의 상호명을<br />검색해 주세요.</div>
                      )}
                    </div>

                    <button
                      onClick={() => { if (!selectedPlace) { showToast({ message: '맛집을 선택해 주세요.' }); return; } setStep(2); }}
                      disabled={!selectedPlace}
                      className={`w-full py-4 rounded-2xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${!selectedPlace ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-white active:scale-[0.98]'}`}
                      style={selectedPlace ? { background: EMBER } : undefined}
                    >
                      다음 · 영상 링크 넣기
                    </button>
                  </motion.div>
                ) : (
                  /* ───── 스텝 2: 유튜브 링크 입력 + 매칭 제보 ───── */
                  <motion.div
                    key="linkStep"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    {/* 선택한 맛집 요약 */}
                    <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 p-3 rounded-2xl">
                      <div className="w-9 h-9 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0"><Utensils size={16} /></div>
                      <div className="min-w-0 flex-1 text-left">
                        <h4 className="text-[13px] font-black text-slate-800 truncate">{initialRestaurant ? initialRestaurant.name : selectedPlace?.place_name}</h4>
                        {!initialRestaurant && <span className="text-[10px] text-slate-500 font-bold block truncate">{selectedPlace?.road_address_name || selectedPlace?.address_name}</span>}
                      </div>
                      {!initialRestaurant && (
                        <button onClick={() => setStep(1)} className="text-[11px] font-bold text-orange-600 bg-white border border-orange-200 px-2.5 py-1 rounded-full shrink-0 hover:bg-orange-100 transition-colors">변경</button>
                      )}
                    </div>

                    {/* 유튜브 링크 입력 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-1">
                        <Play size={14} className="text-red-500 fill-red-500" />
                        <span className="text-[13px] font-bold text-slate-600">이 맛집을 소개한 유튜브 영상 링크</span>
                      </div>
                      <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        onBlur={() => fetchVideoMeta(youtubeUrl)}
                        placeholder="https://youtube.com/watch?v=... 또는 단축 주소"
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 transition-all"
                      />
                    </div>

                    {/* 영상 미리보기 */}
                    {videoMeta && (
                      <div className="flex gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                        <div className="w-16 aspect-video bg-slate-100 rounded-lg overflow-hidden shrink-0">
                          <img src={videoMeta.thumbnail} alt={videoMeta.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                          <h4 className="text-[12px] font-black text-slate-800 truncate leading-snug">{videoMeta.title}</h4>
                          <span className="text-[10px] text-slate-400 font-bold block mt-1">{videoMeta.author}</span>
                        </div>
                      </div>
                    )}

                    {/* 매칭 안내 */}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Sparkles size={12} className="text-orange-500" />
                        <span className="text-[11px] font-black text-slate-700">AI가 매칭을 확인해요</span>
                      </div>
                      <p className="text-[10px] leading-relaxed text-slate-500 font-medium">
                        제보하면, 이 영상이 <b>{initialRestaurant ? initialRestaurant.name : (selectedPlace?.place_name || '선택한 맛집')}</b>을(를) 실제로 소개한 리뷰인지 AI가 확인한 뒤 지도에 올려드려요.
                      </p>
                    </div>

                    {/* 아는 정보 직접 입력 (선택) */}
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] text-slate-400 font-bold">아는 정보가 있다면 입력해 주세요 (선택)</p>
                      <input value={subHours} onChange={(e) => setSubHours(e.target.value)} placeholder="영업시간 (예: 매일 11:00-21:00, 화요일 휴무)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400" />
                      <input value={subMenu} onChange={(e) => setSubMenu(e.target.value)} placeholder="대표 메뉴·가격 (예: 마늘갈비 17,000원)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[12px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400" />
                    </div>

                    {/* 제출 */}
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || !youtubeUrl}
                      className={`w-full py-4 rounded-2xl text-[14px] font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${isSubmitting || !youtubeUrl ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'text-white active:scale-[0.98]'}`}
                      style={!(isSubmitting || !youtubeUrl) ? { background: EMBER } : undefined}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          <span>영상·맛집 매칭 확인 중…</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          <span>확인하고 제보하기</span>
                        </>
                      )}
                    </button>

                    {!initialRestaurant && (
                      <button
                        onClick={() => setStep(1)}
                        className="w-full text-center text-slate-400 hover:text-slate-600 font-bold text-[11px] py-1 cursor-pointer"
                      >
                        맛집 다시 고르기
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
