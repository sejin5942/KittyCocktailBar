/* =========================================================================
 * 고양이 판타지 쉐이크 — 메인 게임 로직
 * 상태 흐름:
 *   title → dayIntro → order → ingredients → prep → shake → stop → result
 *   → (다음 손님 or dayEnd → shop) → order ...
 * ========================================================================= */

const CUSTOMERS_PER_DAY = 5;
const ORDER_TIME_LIMIT = 45; // 주문당 제한 시간(초)

const Game = {
  // ---- 지속 상태 ----
  day: 1,
  gold: 0,
  reputation: 0,
  upgrades: {},            // id → true
  effects: { shakeTolerance: 0, recipeBonus: 0, safeCharm: 0, goldMult: 0 },
  charmUsedToday: 0,

  // ---- 하루/손님 상태 ----
  customerIndex: 0,
  dayOrders: [],
  order: null,
  selected: [],            // 선택한 재료 id
  prepDone: {},            // 재료 id → true (조작 완료)

  // ---- 제조 결과 지표 ----
  metrics: { recipe: 0, intensity: 0, rhythm: 0, stop: 0 },

  sensor: null,
  el: {},                  // DOM 캐시
};

/* ------------------------------------------------------------------ */
/* 초기화                                                             */
/* ------------------------------------------------------------------ */
window.addEventListener('DOMContentLoaded', () => {
  Game.sensor = new ShakeSensor();
  UI.cache();
  UI.showScreen('title');

  document.getElementById('start-btn').addEventListener('click', async () => {
    // 사용자 제스처 안에서 센서 권한 요청
    await Game.sensor.enable();
    Game.startDay();
  });
});

/* ------------------------------------------------------------------ */
/* 하루 시작                                                          */
/* ------------------------------------------------------------------ */
Game.startDay = function () {
  this.charmUsedToday = 0;
  this.customerIndex = 0;
  // 하루 손님 주문을 무작위로 구성
  this.dayOrders = [];
  const pool = [...ORDERS];
  for (let i = 0; i < CUSTOMERS_PER_DAY; i++) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.dayOrders.push(pick);
  }
  UI.showDayIntro(this.day, () => this.nextCustomer());
};

Game.nextCustomer = function () {
  if (this.customerIndex >= this.dayOrders.length) {
    return this.endDay();
  }
  this.order = this.dayOrders[this.customerIndex];
  this.selected = [];
  this.prepDone = {};
  this.metrics = { recipe: 0, intensity: 0, rhythm: 0, stop: 0 };
  UI.showOrder(this.order, this.customerIndex + 1, CUSTOMERS_PER_DAY);
};

/* ------------------------------------------------------------------ */
/* 재료 선택                                                          */
/* ------------------------------------------------------------------ */
Game.toggleIngredient = function (id) {
  const idx = this.selected.indexOf(id);
  if (idx >= 0) this.selected.splice(idx, 1);
  else this.selected.push(id);
  UI.updateIngredientSelection();
};

Game.confirmIngredients = function () {
  if (this.selected.length === 0) return;
  // 조작이 필요한 재료 큐 구성
  UI.startPrep(this.selected);
};

/* ------------------------------------------------------------------ */
/* 제조 정확도 계산                                                   */
/* ------------------------------------------------------------------ */
Game.computeRecipeAccuracy = function () {
  const need = new Set(this.order.recipe);
  const got = new Set(this.selected);
  let correct = 0, wrong = 0;
  got.forEach(id => (need.has(id) ? correct++ : wrong++));
  const missing = this.order.recipe.length - correct;
  // 정확도: 맞은 재료 비율에서 오답/누락 페널티
  let acc = correct / this.order.recipe.length;
  acc -= wrong * 0.25;
  acc -= missing * 0.15;
  acc += this.effects.recipeBonus;
  return Math.max(0, Math.min(1, acc));
};

/* ------------------------------------------------------------------ */
/* 최종 결과 판정                                                     */
/* ------------------------------------------------------------------ */
Game.judge = function () {
  const m = this.metrics;
  m.recipe = this.computeRecipeAccuracy();

  // 종합 점수 (가중치)
  const score =
    m.recipe    * 0.35 +
    m.intensity * 0.22 +
    m.rhythm    * 0.23 +
    m.stop      * 0.20;

  const cust = CUSTOMERS[this.order.customer];

  // 손님 선호 보너스/판정 변형
  let prefBonus = 0;
  let prefNote = '';
  switch (cust.preference) {
    case 'strong':
      if (m.intensity > 0.75) { prefBonus = 0.08; prefNote = '강한 효과에 만족!'; }
      break;
    case 'precise':
      if (m.recipe > 0.8 && m.rhythm > 0.7) { prefBonus = 0.08; prefNote = '정밀한 제조에 감탄!'; }
      break;
    case 'red': {
      const red = this.selected.some(id => INGREDIENT_MAP[id]?.tags.includes('red'));
      if (red) { prefBonus = 0.06; prefNote = '붉은 재료가 마음에 듦!'; }
      break;
    }
    case 'gentle':
      if (m.intensity < 0.6 && m.rhythm > 0.6) { prefBonus = 0.07; prefNote = '부드러운 제조를 반김!'; }
      break;
    case 'weird':
      // 고블린은 이상할수록 좋아함 — 아래 등급 로직에서 처리
      break;
  }

  const finalScore = Math.min(1, score + prefBonus);

  // 등급 결정
  let grade = this.decideGrade(finalScore, m, cust);

  // 실수 방지 부적: 폭발을 막아줌
  if (grade.key === 'explode' && this.effects.safeCharm > 0 && this.charmUsedToday < this.effects.safeCharm) {
    this.charmUsedToday++;
    grade = GRADES.mystery;
    grade = Object.assign({}, GRADES.mystery, { charmSaved: true });
  }

  // 보상 계산
  let gold = Math.round(grade.gold * (1 + this.effects.goldMult));
  const rep = grade.rep;
  this.gold += Math.max(0, gold);
  this.reputation += rep;

  // 부작용 문구
  let sideEffect = null;
  if (grade.sideEffect) {
    sideEffect = SIDE_EFFECTS[Math.floor(Math.random() * SIDE_EFFECTS.length)];
  }

  const happy = finalScore >= 0.55 || (cust.preference === 'weird' && grade.key !== 'perfect');
  const quip = happy ? cust.quip.happy : cust.quip.sad;

  return { grade, gold, rep, sideEffect, quip, prefNote, finalScore, metrics: m };
};

Game.decideGrade = function (score, m, cust) {
  // 폭발: 과한 강도 + 늦은 멈춤
  if (m.intensity > 0.92 && m.stop < 0.25) return GRADES.explode;
  // 정체불명: 재료가 크게 어긋남
  if (m.recipe < 0.3) {
    // 고블린은 이상한 걸 좋아함 → 그래도 후한 편
    return GRADES.mystery;
  }
  if (score >= 0.85) return GRADES.perfect;
  if (score >= 0.62) {
    // 강도 높고 정밀도 낮으면 '효과는 강하지만 부작용'
    if (m.intensity > 0.7 && m.rhythm < 0.55) return GRADES.sideFx;
    return GRADES.good;
  }
  if (score >= 0.4) return GRADES.weak;
  return GRADES.mystery;
};

/* ------------------------------------------------------------------ */
/* 결과 등급 정의                                                     */
/* ------------------------------------------------------------------ */
const GRADES = {
  perfect: { key: 'perfect', title: '완벽한 제조!',            emoji: '🌟', gold: 40, rep: 3,  sideEffect: false, cls: 'g-perfect' },
  good:    { key: 'good',    title: '훌륭한 물약',              emoji: '✨', gold: 28, rep: 2,  sideEffect: false, cls: 'g-good' },
  weak:    { key: 'weak',    title: '맛은 좋지만 효과가 약함',    emoji: '😌', gold: 15, rep: 1,  sideEffect: false, cls: 'g-weak' },
  sideFx:  { key: 'sideFx',  title: '효과는 강하지만 부작용 발생!', emoji: '💥', gold: 20, rep: 0,  sideEffect: true,  cls: 'g-side' },
  mystery: { key: 'mystery', title: '정체불명의 물약...',        emoji: '❓', gold: 10, rep: 0,  sideEffect: true,  cls: 'g-mystery' },
  explode: { key: 'explode', title: '펑! 폭발!',               emoji: '🧨', gold: 3,  rep: -1, sideEffect: true,  cls: 'g-explode' },
};

/* ------------------------------------------------------------------ */
/* 하루 종료 / 상점                                                   */
/* ------------------------------------------------------------------ */
Game.endDay = function () {
  UI.showDayEnd(this.day, this.gold, this.reputation, () => {
    UI.showShop();
  });
};

Game.buyUpgrade = function (id) {
  const up = UPGRADES.find(u => u.id === id);
  if (!up || this.upgrades[id] || this.gold < up.cost) return;
  this.gold -= up.cost;
  this.upgrades[id] = true;
  for (const k in up.effect) {
    this.effects[k] = (this.effects[k] || 0) + up.effect[k];
  }
  UI.renderShop();
};

Game.leaveShop = function () {
  this.day++;
  this.startDay();
};
