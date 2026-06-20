export interface FoodCategory {
  id: string;
  name: string;
  emoji: string;
  keywords: string[];
}

export const FOOD_CATEGORIES: FoodCategory[] = [
  { id: '1', name: '삼겹살', emoji: '🥓', keywords: ['삼겹살', '돼지고기', '고기', '구이'] },
  { id: '2', name: '치킨', emoji: '🍗', keywords: ['치킨', '통닭', '후라이드', '양념치킨'] },
  { id: '3', name: '피자', emoji: '🍕', keywords: ['피자', '양식', '화덕피자'] },
  { id: '4', name: '햄버거', emoji: '🍔', keywords: ['햄버거', '수제버거', '버거'] },
  { id: '5', name: '짜장면', emoji: '🍜', keywords: ['짜장면', '중식', '중국집', '자장면'] },
  { id: '6', name: '짬뽕', emoji: '🍲', keywords: ['짬뽕', '중식', '중국집'] },
  { id: '7', name: '탕수육', emoji: '🥘', keywords: ['탕수육', '중식', '중국집'] },
  { id: '8', name: '초밥', emoji: '🍣', keywords: ['초밥', '스시', '일식'] },
  { id: '9', name: '돈까스', emoji: '🥩', keywords: ['돈까스', '돈가스', '일식', '경양식'] },
  { id: '10', name: '떡볶이', emoji: '🌶️', keywords: ['떡볶이', '분식'] },
  { id: '11', name: '김밥', emoji: '🍢', keywords: ['김밥', '분식'] },
  { id: '12', name: '라면', emoji: '🍜', keywords: ['라면', '분식'] },
  { id: '13', name: '국밥', emoji: '🍲', keywords: ['국밥', '순대국', '돼지국밥', '해장국'] },
  { id: '14', name: '설렁탕', emoji: '🥘', keywords: ['설렁탕', '국밥', '한식'] },
  { id: '15', name: '곰탕', emoji: '🥣', keywords: ['곰탕', '국밥', '한식'] },
  { id: '16', name: '갈비탕', emoji: '🍲', keywords: ['갈비탕', '국밥', '한식'] },
  { id: '17', name: '김치찌개', emoji: '🥘', keywords: ['김치찌개', '찌개', '백반', '한식'] },
  { id: '18', name: '된장찌개', emoji: '🍲', keywords: ['된장찌개', '찌개', '백반', '한식'] },
  { id: '19', name: '부대찌개', emoji: '🥘', keywords: ['부대찌개', '찌개', '한식'] }
];