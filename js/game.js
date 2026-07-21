/* =========================================================================
 * 고양이 판타지 쉐이크 — 메인 게임 로직
 *
 * 흐름:
 *   title → dayIntro → order → ingredients → shake → result
 *         → (다음 손님 or dayEnd → shop) → order ...
 *
 * 핵심:
 *   - 칵테일마다 필요한 쉐이킹 횟수(shakes)가 정해져 있다.
 *   - 손님의 대기 시간(time) 안에 그 횟수를 채우면 완성, 못 채우면 실패.
 *   - 대기 시간은 재료 선택 + 흔들기 전체에 걸쳐 흐른다.
 * ========================================================================= */

const CUSTOMERS_PER_DAY = 5;

const Game = {
  // ---- 지속 상태 ----
  day: 1,
  gold: 0,
  reputation: 0,
  upgrades: {},
  effects: { shakeMult: 0, recipeBonus: 0, timeBonus: 0, safeCharm: 0, goldMult: 0 },
  charmUsedToday: 0,

  // ---- 하루/손님 상태 ----
  customerIndex: 0,
  dayOrders: [],
  order: null,
  selected: [],

  // ---- 제조 상태 ----
  shakeProgress: 0,        // 누적 쉐이킹(업그레이드 배율 반영, 실수 소수 가능)
  requiredShakes: 0,
  completed: false,
  finished: false,         // 이번 주문 판정 완료 여부(중복 방지)
  timeLeftAtFinish: 0,

  // ---- 대기 시간 타이머 ----
  patienceTotal: 0,
  timeLeft: 0,
  _patienceActive: false,
  _patienceRAF: 0,
  _patienceStart: 0,

  // ---- 도감 (localStorage에 저장) ----
  met: {},                 // customerKey → { seen:true, visits:n }
  drinks: {},              // orderId → { made:true, count:n, best:gradeKey }

  // ---- 재료 보유 (localStorage에 저장) ----
  ownedIngredients: null,  // Set<ingredientId>
  adventuredToday: false,  // 모험 하루 1회 제한

  sensor: null,
};

// 등급 우열 (음료 도감의 '최고 등급' 비교용)
const GRADE_RANK = { fail: 0, mystery: 1, weak: 2, good: 3, perfect: 4 };

/* ------------------------------------------------------------------ */
/* 초기화                                                             */
/* ------------------------------------------------------------------ */
window.addEventListener('DOMContentLoaded', () => {
  Game.sensor = new ShakeSensor();
  UI.cache();
  Game.loadCollection();
  Game.loadDrinks();
  Game.loadIngredients();
  UI.showHub();               // 메인 화면 = 칵테일 바 허브

  // 테스트용: 다음 손님으로 건너뛰기
  document.getElementById('skip-btn').addEventListener('click', () => Game.skipCustomer());
});

/* ------------------------------------------------------------------ */
/* 허브(칵테일 바) 중심 흐름                                          */
/* ------------------------------------------------------------------ */
Game.enterHub = function () { UI.showHub(); };

// 영업 시작: 오늘의 손님을 받는다
Game.startServing = function () {
  this.customerIndex = 0;
  this.dayOrders = [];
  const special = ['detective', 'mermaid'];
  const pool = ORDERS.filter(o => !special.includes(o.customer));
  for (let i = 0; i < CUSTOMERS_PER_DAY; i++) {
    this.dayOrders.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  const det = ORDERS.find(o => o.customer === 'detective');
  const mer = ORDERS.find(o => o.customer === 'mermaid');
  if (det) this.dayOrders[0] = det;
  if (mer && CUSTOMERS_PER_DAY > 1) this.dayOrders[1] = mer;
  this.nextCustomer();
};

// 하루 마감 후 허브로 복귀 (다음 날 · 일일 제한 초기화)
Game.finishDay = function () {
  this.day++;
  this.charmUsedToday = 0;
  this.adventuredToday = false;
  this.enterHub();
};

/* ------------------------------------------------------------------ */
/* 손님 도감 저장/기록                                                */
/* ------------------------------------------------------------------ */
Game.loadCollection = function () {
  try { this.met = JSON.parse(localStorage.getItem('kcb_met') || '{}') || {}; }
  catch (e) { this.met = {}; }
};
Game.saveCollection = function () {
  try { localStorage.setItem('kcb_met', JSON.stringify(this.met)); } catch (e) { /* 무시 */ }
};
Game.seeCustomer = function (key) {            // 손님이 등장(발견)
  const m = this.met[key] || (this.met[key] = { seen: false, visits: 0 });
  m.seen = true;
  this.saveCollection();
};
Game.recordVisit = function (key) {            // 손님 응대 완료(친밀도 +1)
  const m = this.met[key] || (this.met[key] = { seen: false, visits: 0 });
  m.seen = true; m.visits = (m.visits || 0) + 1;
  this.saveCollection();
};

Game.loadDrinks = function () {
  try { this.drinks = JSON.parse(localStorage.getItem('kcb_drinks') || '{}') || {}; }
  catch (e) { this.drinks = {}; }
};
Game.saveDrinks = function () {
  try { localStorage.setItem('kcb_drinks', JSON.stringify(this.drinks)); } catch (e) { /* 무시 */ }
};
Game.recordDrink = function (orderId, gradeKey) {   // 칵테일 제조 완료 기록
  const d = this.drinks[orderId] || (this.drinks[orderId] = { made: false, count: 0, best: 'mystery' });
  d.made = true;
  d.count = (d.count || 0) + 1;
  if (!d.best || GRADE_RANK[gradeKey] > GRADE_RANK[d.best]) d.best = gradeKey;
  this.saveDrinks();
};

/* ------------------------------------------------------------------ */
/* 재료 보유 (상점 구매 / 모험 채집)                                  */
/* ------------------------------------------------------------------ */
Game.loadIngredients = function () {
  let arr = null;
  try { arr = JSON.parse(localStorage.getItem('kcb_ing') || 'null'); } catch (e) { arr = null; }
  if (!Array.isArray(arr)) arr = INGREDIENTS.filter(i => i.tier === 'basic').map(i => i.id);
  this.ownedIngredients = new Set(arr);
  INGREDIENTS.forEach(i => { if (i.tier === 'basic') this.ownedIngredients.add(i.id); }); // 기본은 항상 보유
  this.saveIngredients();
};
Game.saveIngredients = function () {
  try { localStorage.setItem('kcb_ing', JSON.stringify([...this.ownedIngredients])); } catch (e) { /* 무시 */ }
};
Game.hasIngredient = function (id) { return this.ownedIngredients.has(id); };
Game.buyIngredient = function (id) {              // 상점에서 골드로 구매
  const ing = INGREDIENT_MAP[id];
  if (!ing || ing.tier !== 'rare' || this.hasIngredient(id) || this.gold < ing.cost) return false;
  this.gold -= ing.cost;
  this.ownedIngredients.add(id);
  this.saveIngredients();
  return true;
};
Game.gatherIngredient = function (id) {           // 모험에서 채집 (하루 1회)
  if (this.adventuredToday || this.hasIngredient(id)) return false;
  this.ownedIngredients.add(id);
  this.adventuredToday = true;
  this.saveIngredients();
  return true;
};

// 현재 손님을 건너뛰고 바로 다음 손님으로 (테스트용)
Game.skipCustomer = function () {
  this.finished = true;                 // 진행 중 콜백 무효화
  this.stopPatience();
  if (this.sensor) { this.sensor.stop(); this.sensor.onBeat = null; this.sensor.onShake = null; }
  this.customerIndex++;
  this.nextCustomer();
};

/* ------------------------------------------------------------------ */
/* 손님 진행                                                          */
/* ------------------------------------------------------------------ */
Game.nextCustomer = function () {
  if (this.customerIndex >= this.dayOrders.length) return this.endDay();
  this.order = this.dayOrders[this.customerIndex];
  this.selected = [];
  this.shakeProgress = 0;
  this.requiredShakes = this.order.shakes;
  this.completed = false;
  this.finished = false;
  this.seeCustomer(this.order.customer);   // 도감: 발견 기록
  UI.showOrder(this.order, this.customerIndex + 1, CUSTOMERS_PER_DAY);
};

// 손님이 주문을 받으면(재료 고르기 시작) 대기 시간이 흐르기 시작
Game.beginService = function () {
  this.startPatience(this.order.time + this.effects.timeBonus);
  UI.showIngredients(this.order);
};

/* ------------------------------------------------------------------ */
/* 재료 선택                                                          */
/* ------------------------------------------------------------------ */
Game.toggleIngredient = function (id) {
  if (!this.hasIngredient(id)) return;          // 미보유 재료는 선택 불가
  const idx = this.selected.indexOf(id);
  if (idx >= 0) this.selected.splice(idx, 1);
  else this.selected.push(id);
  UI.updateIngredientSelection();
};

Game.confirmIngredients = function () {
  if (this.selected.length === 0 || this.finished) return;
  UI.startShake();
};

/* ------------------------------------------------------------------ */
/* 흔들기 카운트                                                      */
/* ------------------------------------------------------------------ */
Game.registerShake = function () {
  if (this.finished || this.completed) return;
  this.shakeProgress += 1 + this.effects.shakeMult;
  const done = Math.min(this.requiredShakes, Math.floor(this.shakeProgress));
  UI.updateShakeCount(done, this.requiredShakes);
  if (this.shakeProgress >= this.requiredShakes) {
    this.completed = true;
    this.finishOrder(true);
  }
};

/* ------------------------------------------------------------------ */
/* 대기 시간 타이머                                                   */
/* ------------------------------------------------------------------ */
Game.startPatience = function (seconds) {
  this.patienceTotal = seconds;
  this.timeLeft = seconds;
  this._patienceStart = performance.now();
  this._patienceActive = true;
  const loop = (now) => {
    if (!this._patienceActive) return;
    this.timeLeft = Math.max(0, this.patienceTotal - (now - this._patienceStart) / 1000);
    UI.updateTimer(this.timeLeft, this.patienceTotal);
    if (this.timeLeft <= 0) {
      this._patienceActive = false;
      this.finishOrder(false);   // 시간 초과 → 실패
      return;
    }
    this._patienceRAF = requestAnimationFrame(loop);
  };
  this._patienceRAF = requestAnimationFrame(loop);
};

Game.stopPatience = function () {
  this._patienceActive = false;
  cancelAnimationFrame(this._patienceRAF);
};

/* ------------------------------------------------------------------ */
/* 주문 판정 종료                                                     */
/* ------------------------------------------------------------------ */
Game.finishOrder = function (success) {
  if (this.finished) return;
  this.finished = true;
  this.completed = success;
  this.timeLeftAtFinish = this.timeLeft;
  this.stopPatience();
  Game.sensor.stop();
  Game.sensor.onBeat = null;
  Game.sensor.onShake = null;
  this.recordVisit(this.order.customer);   // 도감: 친밀도 +1
  UI.showResult();
};

/* ------------------------------------------------------------------ */
/* 재료 정확도                                                        */
/* ------------------------------------------------------------------ */
Game.computeRecipeAccuracy = function () {
  const need = new Set(this.order.recipe);
  const got = new Set(this.selected);
  let correct = 0, wrong = 0;
  got.forEach(id => (need.has(id) ? correct++ : wrong++));
  const missing = this.order.recipe.length - correct;
  let acc = correct / this.order.recipe.length;
  acc -= wrong * 0.25;
  acc -= missing * 0.15;
  acc += this.effects.recipeBonus;
  return Math.max(0, Math.min(1, acc));
};

/* ------------------------------------------------------------------ */
/* 결과 판정                                                          */
/* ------------------------------------------------------------------ */
Game.judge = function () {
  const recipe = this.computeRecipeAccuracy();
  const timeRatio = this.patienceTotal ? Math.max(0, this.timeLeftAtFinish / this.patienceTotal) : 0;
  const cust = CUSTOMERS[this.order.customer];

  let grade;
  let prefNote = '';

  if (!this.completed) {
    // 시간 초과 실패 — 부적으로 1회 구제 가능
    if (this.effects.safeCharm > 0 && this.charmUsedToday < this.effects.safeCharm) {
      this.charmUsedToday++;
      grade = Object.assign({}, GRADES.mystery, { charmSaved: true });
    } else {
      grade = GRADES.fail;
    }
  } else if (recipe < 0.4) {
    grade = GRADES.mystery;           // 완성했지만 재료가 엉망 → 정체불명
  } else {
    // 완성 + 재료 정확도 + 남은 시간으로 점수
    let score = recipe * 0.6 + timeRatio * 0.4;

    // 손님 선호 보너스
    switch (cust.preference) {
      case 'strong':
        if (this.order.shakes >= 40) { score += 0.08; prefNote = '힘든 칵테일을 완성해 감탄!'; }
        break;
      case 'precise':
        if (recipe >= 0.95) { score += 0.08; prefNote = '완벽한 배합에 감탄!'; }
        break;
      case 'red':
        if (this.selected.some(id => INGREDIENT_MAP[id]?.tags.includes('red'))) { score += 0.06; prefNote = '붉은 재료가 마음에 듦!'; }
        break;
      case 'gentle':
        if (timeRatio > 0.4) { score += 0.07; prefNote = '여유롭게 완성해서 만족!'; }
        break;
    }
    score = Math.min(1, score);

    if (score >= 0.85 && recipe >= 0.9) grade = GRADES.perfect;
    else if (score >= 0.6) grade = GRADES.good;
    else grade = GRADES.weak;
  }

  // 보상
  const gold = Math.max(0, Math.round(grade.gold * (1 + this.effects.goldMult)));
  const rep = grade.rep;
  this.gold += gold;
  this.reputation += rep;

  const sideEffect = grade.sideEffect ? SIDE_EFFECTS[Math.floor(Math.random() * SIDE_EFFECTS.length)] : null;
  const happy = grade.key !== 'fail' && (grade.key !== 'mystery' || cust.preference === 'weird');
  const quip = happy ? cust.quip.happy : cust.quip.sad;

  // 음료 도감: 제대로 완성(정체불명 제외)한 칵테일만 레시피 기록
  if (this.completed && grade.key !== 'mystery') this.recordDrink(this.order.id, grade.key);

  return { grade, gold, rep, sideEffect, quip, prefNote, recipe, timeRatio };
};

/* ------------------------------------------------------------------ */
/* 결과 등급                                                          */
/* ------------------------------------------------------------------ */
const GRADES = {
  perfect: { key: 'perfect', title: '완벽한 칵테일!',        emoji: '🌟', gold: 40, rep: 3,  sideEffect: false, cls: 'g-perfect' },
  good:    { key: 'good',    title: '훌륭한 칵테일',          emoji: '✨', gold: 28, rep: 2,  sideEffect: false, cls: 'g-good' },
  weak:    { key: 'weak',    title: '맛은 좋지만 평범함',      emoji: '😌', gold: 15, rep: 1,  sideEffect: false, cls: 'g-weak' },
  mystery: { key: 'mystery', title: '정체불명의 칵테일...',    emoji: '❓', gold: 10, rep: 0,  sideEffect: true,  cls: 'g-mystery' },
  fail:    { key: 'fail',    title: '주문 실패! (시간 초과)',  emoji: '💢', gold: 0,  rep: -1, sideEffect: false, cls: 'g-fail' },
};

/* ------------------------------------------------------------------ */
/* 하루 종료 → 허브로 복귀                                            */
/* ------------------------------------------------------------------ */
Game.endDay = function () {
  UI.showDayEnd(this.day, this.gold, this.reputation, () => this.finishDay());
};

Game.buyUpgrade = function (id) {
  const up = UPGRADES.find(u => u.id === id);
  if (!up || this.upgrades[id] || this.gold < up.cost) return;
  this.gold -= up.cost;
  this.upgrades[id] = true;
  for (const k in up.effect) this.effects[k] = (this.effects[k] || 0) + up.effect[k];
  UI.renderShop();
};
