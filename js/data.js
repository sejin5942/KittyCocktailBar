/* =========================================================================
 * 고양이 판타지 쉐이크 — 게임 데이터
 * 재료 / 손님 / 주문(레시피)
 * ========================================================================= */

// -------------------------------------------------------------------------
// 재료 (Ingredients)
//   prep: 조작 방식
//     'mash'  → 과일/허브: 화면을 눌러 으깨기
//     'pour'  → 액체: 기울여서(또는 탭) 따르기
//     'tap'   → 가루: 톡톡 두드려 넣기
//   tags: 효과 태그 (레시피 정확도 계산에 사용)
// -------------------------------------------------------------------------
const INGREDIENTS = [
  { id: 'ice_mushroom',  name: '얼음 버섯',      emoji: '🍄', color: '#8fd6ff', prep: 'mash', tags: ['fire-resist', 'cold'] },
  { id: 'blue_tail',     name: '청색 도마뱀 꼬리', emoji: '🦎', color: '#4aa9ff', prep: 'mash', tags: ['fire-resist', 'scaly'] },
  { id: 'soda',          name: '탄산수',         emoji: '💧', color: '#bff0ff', prep: 'pour', tags: ['fizzy', 'base'] },
  { id: 'moon_syrup',    name: '달빛 시럽',       emoji: '🌙', color: '#e6d3ff', prep: 'pour', tags: ['sweet', 'calm', 'invisible'] },
  { id: 'phoenix_ash',   name: '불사조 재',       emoji: '🔥', color: '#ff7a3c', prep: 'tap',  tags: ['courage', 'fire'] },
  { id: 'red_berry',     name: '핏빛 열매',       emoji: '🍒', color: '#e23c5a', prep: 'mash', tags: ['red', 'courage', 'sweet'] },
  { id: 'ghost_pepper',  name: '유령 고추',       emoji: '🌶️', color: '#ff4d4d', prep: 'mash', tags: ['spicy', 'courage'] },
  { id: 'star_dust',     name: '별가루',         emoji: '✨', color: '#ffe27a', prep: 'tap',  tags: ['magic', 'sparkle', 'invisible'] },
  { id: 'cat_whisker',   name: '고양이 수염',      emoji: '🐱', color: '#f7c8a0', prep: 'tap',  tags: ['luck', 'agile', 'cute'] },
  { id: 'mint_leaf',     name: '서리 민트',       emoji: '🌿', color: '#7fe0a0', prep: 'mash', tags: ['cold', 'fresh', 'calm'] },
  { id: 'dark_ink',      name: '심연 잉크',       emoji: '🫙', color: '#5b4b8a', prep: 'pour', tags: ['invisible', 'shadow'] },
  { id: 'honey_glow',    name: '햇살 꿀',         emoji: '🍯', color: '#ffb742', prep: 'pour', tags: ['sweet', 'warm', 'courage'] },
];

const INGREDIENT_MAP = Object.fromEntries(INGREDIENTS.map(i => [i.id, i]));

// -------------------------------------------------------------------------
// 손님 유형 (Customer types)
//   preference: 선호 판정 요소 (보너스)
//     'strong'   → 강한 효과 선호 (기사)
//     'precise'  → 정확한 제조 요구 (마법사)
//     'weird'    → 이상한 부작용을 좋아함 (고블린)
//     'red'      → 붉은 재료를 선호 (뱀파이어)
//     'gentle'   → 부드러운 제조 선호 (유령)
// -------------------------------------------------------------------------
const CUSTOMERS = {
  knight:  { name: '기사',   emoji: '🐱⚔️', preference: 'strong',  color: '#c0c8d8',
             quip: { happy: '이 정도 힘이면 용도 무섭지 않다냥!', sad: '음... 좀 밋밋한데.' } },
  mage:    { name: '마법사', emoji: '🐱🔮', preference: 'precise', color: '#b6a4ff',
             quip: { happy: '완벽한 배합이군. 훌륭하다냥.', sad: '배합이 어긋났군... 아쉽다.' } },
  goblin:  { name: '고블린', emoji: '🐱👺', preference: 'weird',   color: '#8fd18f',
             quip: { happy: '크크, 이상해서 좋다냥!', sad: '너무 평범하잖아, 재미없다냥.' } },
  vampire: { name: '뱀파이어', emoji: '🐱🦇', preference: 'red',     color: '#d76b7a',
             quip: { happy: '붉은 빛이 아름답다냥...', sad: '이 색은... 취향이 아니야.' } },
  ghost:   { name: '유령',   emoji: '🐱👻', preference: 'gentle',  color: '#cfe6ff',
             quip: { happy: '부드럽게 스며든다냥~', sad: '너무 거칠어서 통과하지 못하겠어.' } },
  hero:    { name: '용사',   emoji: '🐱🌟', preference: 'precise', color: '#ffd27a',
             quip: { happy: '전설의 물약이다냥!', sad: '전설이라기엔 아쉽군.' } },
};

// -------------------------------------------------------------------------
// 주문(레시피) 풀 (Order / recipe pool)
//   want:    손님이 말하는 요구 (효과)
//   recipe:  정답 재료 id 배열
//   shake:   요구되는 흔들기 방식
//     intensity: 'gentle' | 'medium' | 'strong'  (목표 강도)
//     rhythm:    'steady' | 'fast'   | 'burst'   (리듬 유형)
//     bpm:       리듬 속도
//   customer: 손님 유형 키
// -------------------------------------------------------------------------
const ORDERS = [
  {
    id: 'fire_resist',
    want: '용과 싸워야 하는데 불이 무서워요.',
    hint: '화염 저항',
    recipe: ['ice_mushroom', 'blue_tail', 'soda'],
    shake: { intensity: 'medium', rhythm: 'steady', bpm: 100 },
    customer: 'knight',
    color: '#4aa9ff',
  },
  {
    id: 'confidence',
    want: '데이트 전에 자신감이 필요해요.',
    hint: '용기의 물약',
    recipe: ['phoenix_ash', 'red_berry', 'honey_glow'],
    shake: { intensity: 'strong', rhythm: 'burst', bpm: 130 },
    customer: 'knight',
    color: '#ff7a3c',
  },
  {
    id: 'invisible',
    want: '오늘 밤 투명해지고 싶어요.',
    hint: '투명화 물약',
    recipe: ['moon_syrup', 'dark_ink', 'star_dust'],
    shake: { intensity: 'gentle', rhythm: 'steady', bpm: 80 },
    customer: 'ghost',
    color: '#5b4b8a',
  },
  {
    id: 'calm',
    want: '잠이 안 와서 마음을 가라앉히고 싶어요.',
    hint: '안정의 차',
    recipe: ['mint_leaf', 'moon_syrup', 'soda'],
    shake: { intensity: 'gentle', rhythm: 'steady', bpm: 70 },
    customer: 'ghost',
    color: '#7fe0a0',
  },
  {
    id: 'blood_red',
    want: '가장 붉고 진한 걸로 부탁해.',
    hint: '진홍의 칵테일',
    recipe: ['red_berry', 'ghost_pepper', 'honey_glow'],
    shake: { intensity: 'medium', rhythm: 'fast', bpm: 115 },
    customer: 'vampire',
    color: '#e23c5a',
  },
  {
    id: 'luck',
    want: '오늘 도박에서 이기고 싶어! 이상할수록 좋아!',
    hint: '행운의 묘약',
    recipe: ['cat_whisker', 'star_dust', 'soda'],
    shake: { intensity: 'strong', rhythm: 'burst', bpm: 140 },
    customer: 'goblin',
    color: '#ffe27a',
  },
  {
    id: 'arcane',
    want: '정확한 마력 증폭제가 필요하다. 오차는 용납 못 해.',
    hint: '비전의 영약',
    recipe: ['star_dust', 'moon_syrup', 'blue_tail'],
    shake: { intensity: 'medium', rhythm: 'steady', bpm: 95 },
    customer: 'mage',
    color: '#b6a4ff',
  },
  {
    id: 'legend',
    want: '마왕을 쓰러뜨릴 전설의 물약을 만들어줘!',
    hint: '전설의 물약',
    recipe: ['phoenix_ash', 'star_dust', 'red_berry', 'cat_whisker'],
    shake: { intensity: 'strong', rhythm: 'fast', bpm: 125 },
    customer: 'hero',
    color: '#ffd27a',
  },
];

// -------------------------------------------------------------------------
// 재미있는 부작용 (Funny side effects) — 실패/과잉 시 등장
// -------------------------------------------------------------------------
const SIDE_EFFECTS = [
  '몸이 투명해졌는데 옷만 그대로 남았다냥!',
  '목소리가 고양이 울음소리로 변했다냥... 냐옹?',
  '머리카락만 3배 빨리 자라기 시작했다냥.',
  '손님이 손바닥만 하게 작아졌다냥!',
  '손님이 잠시 닭으로 변했다냥. 꼬꼬댁!',
  '사랑의 묘약이었는데... 의자를 사랑하게 됐다냥.',
  '힘이 강해졌지만 잡는 것마다 부서진다냥.',
  '갑자기 뒤로 걷기 시작했다냥.',
  '반짝이 방귀가 멈추지 않는다냥.',
  '눈에서 별가루가 흘러나온다냥.',
];

// -------------------------------------------------------------------------
// 상점 업그레이드 (Shop upgrades)
// -------------------------------------------------------------------------
const UPGRADES = [
  { id: 'shaker',  name: '더 큰 셰이커',     emoji: '🫗', desc: '흔들기 판정 여유 +15%',      cost: 60,  effect: { shakeTolerance: 0.15 } },
  { id: 'measure', name: '자동 계량 도구',    emoji: '⚖️', desc: '재료 정확도 보너스 +10%',    cost: 90,  effect: { recipeBonus: 0.10 } },
  { id: 'charm',   name: '실수 방지 부적',    emoji: '🧿', desc: '하루 1회 폭발을 막아줌',       cost: 120, effect: { safeCharm: 1 } },
  { id: 'glass',   name: '고급 잔과 병',      emoji: '🍸', desc: '모든 보상 골드 +20%',         cost: 150, effect: { goldMult: 0.20 } },
];
