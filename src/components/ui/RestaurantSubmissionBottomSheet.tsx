'use client';

import { useState, useEffect } from 'react';
import CustomBottomSheet from './CustomBottomSheet';
import { supabase } from '@/lib/supabase/client';
import { Search, MapPin, Video, CheckCircle2, ChevronRight } from 'lucide-react';
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

  return (
    <>
      <CustomBottomSheet 
        isOpen={isOpen} 
        onClose={resetForm} 
        title={aiResult ? undefined : "나만의 핫플 제보하기"}
        subtitle={aiResult ? undefined : "정확한 장소와 리뷰 영상을 알려주세요."}
      >
        <div className="py-2 min-h-[350px]">
          {aiResult ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-5">
              {aiResult.status === 'approved' ? (
                <>
                  <CheckCircle2 size={56} className="text-brand-orange animate-bounce" />
                  <div>
                    <div className="font-bold text-white text-[22px] mb-2 tracking-tight">심사 합격! 지도에 추가됨</div>
                    <div className="text-white/85 text-[15px] bg-brand-orange/10 border border-brand-orange/25 px-4 py-2 rounded-2xl inline-block">
                      {aiResult.youtuber_name && <span className="font-bold text-brand-orange-light">{aiResult.youtuber_name}</span>}님의 핫플이 등록되었어요!
                    </div>
                    
                    {(aiResult.extracted_menu || aiResult.parking_info) && (
                      <div className="mt-5 text-left bg-brand-gray border border-white/5 p-4 rounded-2xl text-sm w-full max-w-[320px] mx-auto space-y-4 shadow-inner">
                        <div className="font-bold text-white/90 text-[13px] flex items-center gap-1.5 border-b border-white/5 pb-2">✨ AI 팩트체크 요약</div>
                        {aiResult.extracted_menu && aiResult.extracted_menu !== '정보 없음' && (
                          <div className="flex items-start gap-2.5">
                            <span className="text-brand-orange-light mt-0.5">🍽️</span>
                            <div>
                              <span className="text-white/40 font-medium text-[11px] block mb-0.5">추천 메뉴</span>
                              <span className="text-white font-bold leading-tight">{aiResult.extracted_menu}</span>
                            </div>
                          </div>
                        )}
                        {aiResult.parking_info && aiResult.parking_info !== '정보 없음' && (
                          <div className="flex items-start gap-2.5">
                            <span className="text-sky-400 mt-0.5">🅿️</span>
                            <div>
                              <span className="text-white/40 font-medium text-[11px] block mb-0.5">주차 정보</span>
                              <span className="text-white font-bold leading-tight">{aiResult.parking_info}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={handleCloseAfterSuccess} 
                    className="w-full max-w-[200px] py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all cursor-pointer"
                  >
                    닫기
                  </button>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 font-bold text-2xl animate-pulse">X</div>
                  <div>
                    <div className="font-bold text-white text-[22px] mb-2 tracking-tight">반려되었습니다</div>
                    <div className="text-white/80 text-[14px] bg-brand-gray border border-white/5 px-4 py-3 rounded-2xl mt-2 inline-block max-w-[280px] break-keep">
                      <span className="font-bold text-red-400 block mb-1 text-xs">AI 판단 사유</span>
                      {aiResult.reason}
                    </div>
                  </div>
                  <button 
                    onClick={() => setAiResult(null)} 
                    className="w-full max-w-[200px] py-3 bg-brand-orange hover:bg-brand-orange-light text-white font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-orange/15"
                  >
                    다시 제보하기
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {step === 1 ? (
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                      <Search size={20} />
                    </div>
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="식당 이름을 검색해주세요 (예: 몽탄)" 
                      className="w-full bg-brand-gray border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-[15px] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all"
                    />
                  </div>

                  <div className="max-h-[250px] overflow-y-auto space-y-2 pb-4 mt-4">
                    {searchResults.map((place) => {
                      const categoryChunks = place.category_name ? place.category_name.split(' > ') : [];
                      const specificCategory = categoryChunks.length > 1 
                        ? categoryChunks.slice(1).join(' · ') 
                        : place.category_group_name || '식당';

                      return (
                        <div 
                          key={place.id}
                          onClick={() => {
                            setSelectedPlace(place);
                            setStep(2);
                          }}
                          className="p-4 bg-brand-gray border border-white/5 rounded-2xl cursor-pointer hover:bg-white/5 hover:border-white/10 active:scale-[0.98] transition-all flex items-center justify-between"
                        >
                          <div className="flex flex-col flex-1 min-w-0 pr-4">
                            <div className="flex items-baseline gap-2 mb-1.5">
                              <span className="text-[16px] font-bold text-white truncate">
                                {place.place_name}
                              </span>
                              {specificCategory && (
                                <span className="text-[11px] font-medium text-white/40 flex-shrink-0">
                                  {specificCategory}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center text-[13px] text-white/60 truncate">
                              <MapPin size={14} className="mr-1.5 text-white/30" />
                              {place.road_address_name || place.address_name}
                            </div>
                          </div>
                          
                          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-white/30">
                            <ChevronRight size={20} strokeWidth={2.5} />
                          </div>
                        </div>
                      );
                    })}
                    {searchQuery && searchResults.length === 0 && (
                      <div className="text-center py-10">
                        <div className="text-2xl mb-2">🍽️</div>
                        <div className="text-white/80 text-[15px] font-semibold">검색된 식당이 없습니다.</div>
                        <div className="text-white/40 text-[13px] mt-1">상호명이나 지역을 다시 확인해주세요.</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 bg-brand-gray border border-white/5 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 truncate pr-2">
                      <MapPin size={18} className="text-brand-orange flex-shrink-0" />
                      <div className="truncate font-bold text-white text-[15px]">
                        {selectedPlace?.place_name}
                      </div>
                    </div>
                    <button 
                      onClick={() => setStep(1)} 
                      className="text-[12px] text-white/70 font-semibold px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-xl flex-shrink-0 transition-colors cursor-pointer"
                    >
                      다시 검색
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="font-semibold text-white/80 text-[14px]">유튜브 리뷰 영상 링크</div>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500">
                        <Video size={20} />
                      </div>
                      <input 
                        type="text" 
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://youtube.com/watch?v=..." 
                        className={`w-full bg-brand-gray border border-white/5 rounded-2xl py-3.5 pl-12 pr-10 text-[15px] text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-brand-orange transition-all ${youtubeUrl && isValidYoutube(youtubeUrl) ? 'border-emerald-500 ring-1 ring-emerald-500' : ''}`}
                      />
                      {youtubeUrl && isValidYoutube(youtubeUrl) && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                          <CheckCircle2 size={18} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      className={`w-full py-4 rounded-2xl text-[16px] font-bold shadow-lg transition-all flex items-center justify-center cursor-pointer ${
                        isSubmitting 
                        ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                        : 'bg-brand-orange text-white hover:bg-brand-orange-light active:scale-[0.98] shadow-brand-orange/15'
                      }`}
                      disabled={isSubmitting}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? 'AI 팩트체크 요청 중...' : 'AI에게 팩트체크 맡기기'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CustomBottomSheet>
      <Toast message={toastMessage} isVisible={isVisible} />
    </>
  );
}



