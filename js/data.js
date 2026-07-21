/* =========================================================================
 * 고양이 판타지 쉐이크 — 게임 데이터
 * 재료 / 손님 / 주문(칵테일 레시피)
 *
 * 플레이 방식:
 *   손님 주문 → 레시피에 맞는 재료 넣기 → 휴대폰 흔들기
 *   칵테일마다 필요한 "쉐이킹 횟수"가 있고, 손님의 "대기 시간" 안에
 *   그 횟수를 모두 채우면 완성. 시간 초과 시 주문 실패.
 * ========================================================================= */

// -------------------------------------------------------------------------
// 재료 (Ingredients)
//   tags: 효과/속성 태그 (레시피 정확도 · 손님 선호 계산에 사용)
// -------------------------------------------------------------------------
const INGREDIENTS = [
  { id: 'strawberry', name: '딸기',       emoji: '🍓', color: '#e23c5a', tags: ['red', 'fruit', 'sweet'] },
  { id: 'lightning',  name: '번개 정수',   emoji: '⚡', color: '#ffe27a', tags: ['electric', 'shock'] },
  { id: 'rum',        name: '마법의 술',   emoji: '🍶', color: '#d9a066', tags: ['alcohol', 'base'] },
  { id: 'ice',        name: '얼음',       emoji: '🧊', color: '#bff0ff', tags: ['cold', 'base'] },
  { id: 'lemon',      name: '레몬',       emoji: '🍋', color: '#ffe66b', tags: ['sour', 'fresh'] },
  { id: 'mint',       name: '서리 민트',   emoji: '🌿', color: '#7fe0a0', tags: ['fresh', 'cool', 'calm'] },
  { id: 'stardust',   name: '별가루',      emoji: '✨', color: '#ffd76b', tags: ['magic', 'sparkle'] },
  { id: 'dragon',     name: '용의 숨결',   emoji: '🐉', color: '#ff7a3c', tags: ['fire', 'hot', 'courage'] },
  { id: 'moon',       name: '달빛 시럽',   emoji: '🌙', color: '#e6d3ff', tags: ['sweet', 'calm', 'dream'] },
  { id: 'grape',      name: '마법 포도',   emoji: '🍇', color: '#9b6bd6', tags: ['fruit', 'sweet', 'purple'] },
  { id: 'blue',       name: '블루 큐라소', emoji: '🫐', color: '#4aa9ff', tags: ['blue', 'sweet'] },
  { id: 'honey',      name: '햇살 꿀',     emoji: '🍯', color: '#ffb742', tags: ['sweet', 'warm'] },
];

const INGREDIENT_MAP = Object.fromEntries(INGREDIENTS.map(i => [i.id, i]));

// -------------------------------------------------------------------------
// 손님 유형 (Customer types)
//   preference: 선호 판정 요소 (보너스)
//     'strong'   → 흔들기 많은(강한) 칵테일 선호 (기사)
//     'precise'  → 정확한 재료 배합 요구 (마법사/용사)
//     'weird'    → 이상한 결과물을 좋아함 (고블린)
//     'red'      → 붉은 재료 선호 (뱀파이어)
//     'gentle'   → 여유 있게 완성하면 좋아함 (유령)
// -------------------------------------------------------------------------
const CUSTOMERS = {
  knight:  { name: '기사',    emoji: '🐱⚔️', preference: 'strong',  color: '#c0c8d8',
             quip: { happy: '이 정도 힘이면 용도 무섭지 않다냥!', sad: '흥, 실망이군.' } },
  mage:    { name: '마법사',  emoji: '🐱🔮', preference: 'precise', color: '#b6a4ff',
             quip: { happy: '완벽한 배합이군. 훌륭하다냥.', sad: '배합이 어긋났군... 아쉽다.' } },
  goblin:  { name: '고블린',  emoji: '🐱👺', preference: 'weird',   color: '#8fd18f',
             quip: { happy: '크크, 이상해서 좋다냥!', sad: '너무 늦었잖아, 재미없다냥!' } },
  vampire: { name: '뱀파이어', emoji: '🐱🦇', preference: 'red',     color: '#d76b7a',
             quip: { happy: '붉은 빛이 아름답다냥...', sad: '기다리다 목이 마르겠군.' } },
  ghost:   { name: '유령',    emoji: '🐱👻', preference: 'gentle',  color: '#cfe6ff',
             quip: { happy: '부드럽게 스며든다냥~', sad: '스르륵... 그냥 갈게.' } },
  hero:    { name: '용사',    emoji: '🐱🌟', preference: 'precise', color: '#ffd27a',
             quip: { happy: '전설의 칵테일이다냥!', sad: '전설이라기엔 아쉽군.' } },
  // 스프라이트 애니메이션 손님들
  detective: { name: '탐정', emoji: '🐱🔍', preference: 'precise', color: '#9db4d8', sprite: 'detective',
             quip: { happy: '훌륭해. 사건 해결의 실마리가 보인다냥!', sad: '흐음... 증거가 부족하군.' } },
  mermaid:   { name: '인어', emoji: '🐱🧜', preference: 'gentle', color: '#8fe0cf', sprite: 'mermaid',
             quip: { happy: '바닷속처럼 시원하고 부드럽다냥~', sad: '파도가 잔잔하지 않네... 아쉽다냥.' } },
};

// -------------------------------------------------------------------------
// 주문(칵테일 레시피) 풀
//   name:    칵테일 이름
//   want:    손님이 말하는 요구 (플레이버 텍스트)
//   recipe:  정답 재료 id 배열
//   shakes:  완성에 필요한 쉐이킹 횟수
//   time:    손님 대기 시간(초) — 재료 선택 + 흔들기 전체에 적용
//   customer: 손님 유형 키
// -------------------------------------------------------------------------
const ORDERS = [
  {
    id: 'strawberry_shake', name: '딸기 셰이크', emoji: '🍓',
    want: '달콤한 딸기 셰이크 한 잔 주세요냥.',
    recipe: ['strawberry', 'rum', 'ice'], shakes: 6, time: 16,
    customer: 'vampire', color: '#e23c5a',
  },
  {
    id: 'lightning', name: '번개 칵테일', emoji: '⚡',
    want: '번쩍! 짜릿하게 잠 깨는 걸로! 세게 흔들어야 한다던데?',
    recipe: ['lightning', 'rum', 'ice'], shakes: 100, time: 40,
    customer: 'knight', color: '#ffe27a',
  },
  {
    id: 'star_martini', name: '별빛 마티니', emoji: '✨',
    want: '정확한 배합의 별빛 마티니를 원한다.',
    recipe: ['stardust', 'moon', 'blue'], shakes: 20, time: 20,
    customer: 'mage', color: '#b6a4ff',
  },
  {
    id: 'lava_punch', name: '용암 펀치', emoji: '🐉',
    want: '몸이 후끈해지는 뜨거운 펀치가 필요해!',
    recipe: ['dragon', 'honey', 'lemon'], shakes: 40, time: 24,
    customer: 'knight', color: '#ff7a3c',
  },
  {
    id: 'frost_mojito', name: '서리 모히토', emoji: '🌿',
    want: '시원하고 부드러운 걸로 부탁해요~',
    recipe: ['mint', 'ice', 'lemon'], shakes: 12, time: 16,
    customer: 'ghost', color: '#7fe0a0',
  },
  {
    id: 'grape_fizz', name: '포도 피즈', emoji: '🍇',
    want: '뭔가 이상하고 재밌는 거! 포도로!',
    recipe: ['grape', 'rum', 'honey'], shakes: 15, time: 16,
    customer: 'goblin', color: '#9b6bd6',
  },
  {
    id: 'moon_dream', name: '달빛 몽환주', emoji: '🌙',
    want: '잠이 솔솔 오는 몽환적인 한 잔~',
    recipe: ['moon', 'blue', 'stardust'], shakes: 25, time: 22,
    customer: 'ghost', color: '#4aa9ff',
  },
  {
    id: 'mystery_blue', name: '미스터리 블루', emoji: '🔍',
    want: '수상한 사건을 조사 중이야. 머리가 맑아지는 한 잔을 부탁한다냥.',
    recipe: ['blue', 'stardust', 'lemon'], shakes: 30, time: 22,
    customer: 'detective', color: '#4aa9ff',
  },
  {
    id: 'ocean_wave', name: '인어의 물결', emoji: '🧜',
    want: '바닷속처럼 시원하고 부드러운 한 잔이 마시고 싶다냥~',
    recipe: ['blue', 'mint', 'ice'], shakes: 18, time: 18,
    customer: 'mermaid', color: '#7fe0d0',
  },
  {
    id: 'legend', name: '전설의 칵테일', emoji: '🌟',
    want: '마왕을 쓰러뜨릴 전설의 칵테일을 만들어줘!',
    recipe: ['dragon', 'stardust', 'strawberry', 'lightning'], shakes: 60, time: 30,
    customer: 'hero', color: '#ffd76b',
  },
];

// -------------------------------------------------------------------------
// 재미있는 부작용 (Funny side effects) — 이상한 재료 조합 시 등장
// -------------------------------------------------------------------------
const SIDE_EFFECTS = [
  '몸이 투명해졌는데 옷만 그대로 남았다냥!',
  '목소리가 고양이 울음소리로 변했다냥... 냐옹?',
  '머리카락만 3배 빨리 자라기 시작했다냥.',
  '손님이 손바닥만 하게 작아졌다냥!',
  '손님이 잠시 닭으로 변했다냥. 꼬꼬댁!',
  '사랑의 묘약이 됐는데... 의자를 사랑하게 됐다냥.',
  '힘이 강해졌지만 잡는 것마다 부서진다냥.',
  '갑자기 뒤로 걷기 시작했다냥.',
  '반짝이 방귀가 멈추지 않는다냥.',
  '눈에서 별가루가 흘러나온다냥.',
];

// -------------------------------------------------------------------------
// 상점 업그레이드 (Shop upgrades)
// -------------------------------------------------------------------------
const UPGRADES = [
  { id: 'shaker',  name: '더 큰 셰이커',    emoji: '🫗', desc: '흔들기 1회가 1.5회로 카운트', cost: 80,  effect: { shakeMult: 0.5 } },
  { id: 'measure', name: '자동 계량 도구',   emoji: '⚖️', desc: '재료 정확도 보너스 +10%',    cost: 90,  effect: { recipeBonus: 0.10 } },
  { id: 'clock',   name: '모래시계 부적',    emoji: '⏳', desc: '모든 주문 제한 시간 +5초',    cost: 100, effect: { timeBonus: 5 } },
  { id: 'charm',   name: '실수 방지 부적',   emoji: '🧿', desc: '하루 1회 주문 실패를 막아줌',   cost: 120, effect: { safeCharm: 1 } },
  { id: 'glass',   name: '고급 잔과 병',     emoji: '🍸', desc: '모든 보상 골드 +20%',         cost: 150, effect: { goldMult: 0.20 } },
];
