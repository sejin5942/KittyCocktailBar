/* =========================================================================
 * UI 컨트롤러 — 화면 전환
 *   흐름: 주문 → 재료 선택 → 흔들기 → 결과
 *   대기 시간(타이머)은 재료 선택 화면부터 흔들기 화면까지 이어진다.
 * ========================================================================= */

const UI = {
  cache() {
    this.root = document.getElementById('app');
    this.hud = document.getElementById('hud');
  },

  renderHUD() {
    this.hud.innerHTML = `
      <span class="hud-item">📅 Day ${Game.day}</span>
      <span class="hud-item">💰 ${Game.gold}</span>
      <span class="hud-item">⭐ ${Game.reputation}</span>
    `;
    this.hud.style.display = 'flex';
  },

  showScreen(name) {
    if (name === 'title') this.hud.style.display = 'none';
  },

  // 테스트용 다음 손님 버튼 표시/숨김
  showSkip(on) {
    const b = document.getElementById('skip-btn');
    if (b) b.style.display = on ? 'block' : 'none';
  },

  /* =================================================================
   * 메인 화면 — 칵테일 바 허브
   * ================================================================= */
  showHub() {
    this.renderHUD();
    this.showSkip(false);
    this.clear();
    const s = el('div', 'screen hub-screen fade-in');
    s.innerHTML = `
      <div class="bar-scene">
        <div class="neon-sign">🐾 고양이 칵테일 바 🍸</div>
        <div class="bar-shelves" id="bar-shelves"></div>
        <div class="bar-counter">
          <div class="counter-glasses">🍸 🍹 🧉 🍶</div>
          <div class="bartender">🐱</div>
        </div>
      </div>
      <button class="btn primary big hub-serve" id="hub-serve">🍸 영업 시작</button>
      <div class="hub-grid">
        <button class="btn hub-nav" id="hub-adv"><span class="hub-ic">🗺️</span>모험 가기</button>
        <button class="btn hub-nav" id="hub-shop"><span class="hub-ic">🛒</span>상점</button>
        <button class="btn hub-nav" id="hub-inv"><span class="hub-ic">🎒</span>인벤토리</button>
        <button class="btn hub-nav" id="hub-dex"><span class="hub-ic">📖</span>도감</button>
      </div>
    `;
    this.root.appendChild(s);

    // 선반의 병 = 재료 컬렉션 (보유하면 빛나고, 미보유는 흐릿)
    const shelves = s.querySelector('#bar-shelves');
    INGREDIENTS.forEach(ing => {
      const owned = Game.hasIngredient(ing.id);
      const bt = el('div', 'bar-bottle' + (owned ? '' : ' dim'));
      bt.style.setProperty('--ic', ing.color);
      bt.title = ing.name;
      shelves.appendChild(bt);
    });

    s.querySelector('#hub-serve').addEventListener('click', async () => {
      if (!Game._sensorReady) { await Game.sensor.enable(); Game._sensorReady = true; }
      Game.startServing();
    });
    s.querySelector('#hub-adv').addEventListener('click', () => this.showAdventure());
    s.querySelector('#hub-shop').addEventListener('click', () => this.showShop());
    s.querySelector('#hub-inv').addEventListener('click', () => this.showInventory());
    s.querySelector('#hub-dex').addEventListener('click', () => this.showCollection());
  },

  /* =================================================================
   * 인벤토리 — 보유 재료
   * ================================================================= */
  showInventory() {
    this.renderHUD();
    this.showSkip(false);
    this.clear();
    const owned = INGREDIENTS.filter(i => Game.hasIngredient(i.id)).length;
    const s = el('div', 'screen fade-in');
    s.innerHTML = `
      <div class="dex-header">
        <button class="btn small" id="inv-back">← 가게로</button>
        <h2 class="tight">🎒 인벤토리</h2>
        <span class="dex-progress">보유 ${owned}/${INGREDIENTS.length}</span>
      </div>
      <div class="inv-grid" id="inv-grid"></div>
    `;
    this.root.appendChild(s);

    const grid = s.querySelector('#inv-grid');
    INGREDIENTS.forEach(ing => {
      const has = Game.hasIngredient(ing.id);
      const card = el('div', 'inv-card' + (has ? '' : ' locked'));
      card.style.setProperty('--ic', ing.color);
      const sub = has
        ? (ing.tier === 'rare' ? '✨ 희귀 · 보유' : '기본 · 보유')
        : `🔒 상점 💰${ing.cost} · ${ing.place}`;
      card.innerHTML = `
        <div class="inv-emoji${has ? '' : ' dim'}">${ing.emoji}</div>
        <div class="inv-name">${ing.name}</div>
        <div class="inv-sub muted">${sub}</div>
      `;
      grid.appendChild(card);
    });
    s.querySelector('#inv-back').addEventListener('click', () => this.showHub());
  },

  /* =================================================================
   * 타이틀 화면 (미사용 · 허브가 메인)
   * ================================================================= */
  showTitle() {
    this.hud.style.display = 'none';
    this.showSkip(false);
    this.clear();
    const s = el('div', 'screen center fade-in');
    s.innerHTML = `
      <div class="title-orbs">
        <span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span>
      </div>
      <div class="big-emoji title-cat">🐱🍸</div>
      <h1 class="game-title">고양이 판타지<br>쉐이크</h1>
      <p class="muted">판타지 바의 고양이 바텐더가 되어<br>손님의 주문에 맞는 마법 물약을 흔들어 만드세요냥!</p>
      <button class="btn primary big" id="start-btn">가게 시작하기 ✨</button>
      <button class="btn" id="dex-btn">📖 도감</button>
      <p class="muted small foot">📱 휴대폰을 흔들어 조작해요 · PC는 드래그/Space로 대체</p>
    `;
    this.root.appendChild(s);
    s.querySelector('#start-btn').addEventListener('click', async () => {
      await Game.sensor.enable();   // 사용자 제스처 안에서 센서 권한 요청
      Game.startDay();
    });
    s.querySelector('#dex-btn').addEventListener('click', () => this.showCollection('title'));
  },

  /* =================================================================
   * 도감 (손님 / 음료 탭)
   * ================================================================= */
  showCollection(origin, tab) {
    tab = tab || 'customers';
    this.hud.style.display = 'none';
    this.showSkip(false);
    this.clear();
    const s = el('div', 'screen fade-in');
    s.innerHTML = `
      <div class="dex-header">
        <button class="btn small" id="dex-back">← 뒤로</button>
        <h2 class="tight">도감</h2>
        <span class="dex-progress" id="dex-progress"></span>
      </div>
      <div class="dex-tabs">
        <button class="dex-tab ${tab === 'customers' ? 'on' : ''}" data-tab="customers">🐱 손님</button>
        <button class="dex-tab ${tab === 'drinks' ? 'on' : ''}" data-tab="drinks">🍸 음료</button>
      </div>
      <div class="dex-grid" id="dex-grid"></div>
    `;
    this.root.appendChild(s);

    if (tab === 'drinks') this.renderDrinkDex(s); else this.renderCustomerDex(s);

    s.querySelectorAll('.dex-tab').forEach(t =>
      t.addEventListener('click', () => this.showCollection(origin, t.dataset.tab)));
    s.querySelector('#dex-back').addEventListener('click', () => this.showHub());
  },

  renderCustomerDex(s) {
    const grid = s.querySelector('#dex-grid');
    const keys = Object.keys(CUSTOMERS);
    const seenCount = keys.filter(k => Game.met[k] && Game.met[k].seen).length;
    s.querySelector('#dex-progress').textContent = `발견 ${seenCount}/${keys.length}`;
    keys.forEach(k => {
      const cust = CUSTOMERS[k];
      const m = Game.met[k];
      const seen = !!(m && m.seen);
      const visits = (m && m.visits) || 0;
      const orders = ORDERS.filter(o => o.customer === k).map(o => `${o.emoji} ${o.name}`);
      const card = el('div', 'dex-card' + (seen ? '' : ' locked'));
      card.style.setProperty('--cc', cust.color);
      const sil = seen ? '' : ' sil';
      const face = cust.sprite
        ? `<div class="sprite-cat ${cust.sprite} sm${sil}"></div>`
        : `<div class="big-emoji dex-emoji${sil}">${cust.emoji}</div>`;
      card.innerHTML = seen ? `
        <div class="dex-face">${face}</div>
        <div class="dex-name">${cust.name}</div>
        <div class="dex-pref">${PREF_DESC[cust.preference] || ''}</div>
        <div class="dex-drink">🍸 ${orders.join(' · ')}</div>
        <div class="dex-quip">“${cust.quip.happy}”</div>
        <div class="dex-hearts">${heartStr(visits)} <span class="dex-visits">${visits}회</span></div>
      ` : `
        <div class="dex-face">${face}</div>
        <div class="dex-name">???</div>
        <div class="dex-pref muted">아직 만나지 못한 손님</div>
      `;
      grid.appendChild(card);
    });
  },

  renderDrinkDex(s) {
    const grid = s.querySelector('#dex-grid');
    const madeCount = ORDERS.filter(o => Game.drinks[o.id] && Game.drinks[o.id].made).length;
    s.querySelector('#dex-progress').textContent = `제조 ${madeCount}/${ORDERS.length}`;
    ORDERS.forEach(o => {
      const d = Game.drinks[o.id];
      const made = !!(d && d.made);
      const known = !o.secret || made;   // 공개 레시피는 항상, 비밀은 만들어야 공개
      const cust = CUSTOMERS[o.customer];
      const recipe = o.recipe.map(id => `${INGREDIENT_MAP[id].emoji} ${INGREDIENT_MAP[id].name}`);
      const tag = o.secret ? '<span class="ci-tag secret">🔒 비밀</span>' : '<span class="ci-tag open">📖 공개</span>';
      const card = el('div', 'dex-card' + (known ? '' : ' locked'));
      card.style.setProperty('--cc', o.color);

      const face = known
        ? `<div class="big-emoji dex-emoji">${o.emoji}</div>`
        : `<div class="big-emoji dex-emoji sil">${o.emoji}</div>`;
      const madeLine = made
        ? `<div class="dex-hearts dex-made">${(GRADES[d.best] || {}).emoji || ''} 최고 · 🍸 ${d.count}잔</div>`
        : `<div class="dex-hearts muted">아직 제조 전</div>`;

      card.innerHTML = known ? `
        <div class="dex-face">${face}</div>
        <div class="dex-name">${o.name} ${tag}</div>
        <div class="dex-recipe">${recipe.join(' + ')}</div>
        <div class="dex-drink">🫳 ${o.shakes}회 · ⏳ ${o.time}초 · ${cust.name}</div>
        ${madeLine}
      ` : `
        <div class="dex-face">${face}</div>
        <div class="dex-name">??? ${tag}</div>
        <div class="dex-recipe muted">레시피 ??? · 직접 찾아보세요</div>
        <div class="dex-drink muted">🧺 재료 ${o.recipe.length} · 🫳 ${o.shakes}회 · ⏳ ${o.time}초</div>
      `;
      grid.appendChild(card);
    });
  },

  clear() { this.root.innerHTML = ''; },

  // 재료·흔들기 화면 상단에 공통으로 쓰는 대기 시간 바 마크업
  timerBarHTML() {
    return `
      <div class="timer-wrap">
        <div class="timer-label">⏳ <span id="timer-text">0.0</span>s</div>
        <div class="timer-bar"><div class="timer-fill" id="timer-fill"></div></div>
      </div>`;
  },

  updateTimer(left, total) {
    const fill = document.getElementById('timer-fill');
    const text = document.getElementById('timer-text');
    if (!fill || !text) return;
    const ratio = total ? Math.max(0, left / total) : 0;
    fill.style.width = (ratio * 100) + '%';
    text.textContent = left.toFixed(1);
    fill.classList.toggle('low', ratio < 0.33);
    fill.classList.toggle('mid', ratio >= 0.33 && ratio < 0.6);
  },

  /* =================================================================
   * 하루 시작
   * ================================================================= */
  showDayIntro(day, next) {
    this.renderHUD();
    this.showSkip(false);
    this.clear();
    const card = el('div', 'screen center fade-in');
    card.innerHTML = `
      <div class="big-emoji">🌙🐾</div>
      <h1>Day ${day}</h1>
      <p class="muted">가게 문을 엽니다. 오늘도 손님들이 찾아옵니다냥.</p>
      <button class="btn primary" id="open-btn">가게 열기</button>
    `;
    this.root.appendChild(card);
    card.querySelector('#open-btn').addEventListener('click', next);
  },

  /* =================================================================
   * 1) 손님 주문 (대기 시간은 아직 흐르지 않음)
   * ================================================================= */
  showOrder(order, n, total) {
    this.renderHUD();
    this.showSkip(true);
    this.clear();
    const cust = CUSTOMERS[order.customer];
    const s = el('div', 'screen fade-in');
    const faceHTML = cust.sprite
      ? `<div class="sprite-cat ${cust.sprite}"></div>`
      : `<div class="customer-face">${cust.emoji}</div>`;
    s.innerHTML = `
      <div class="progress-pips">${pips(n, total)}</div>
      <div class="customer-card" style="--cc:${cust.color}">
        ${faceHTML}
        <div class="customer-name">${cust.name} 손님</div>
        <div class="speech-bubble">${order.want}</div>
      </div>
      <div class="cocktail-info">
        <div class="ci-name">${order.emoji} ${order.name} ${order.secret ? '<span class="ci-tag secret">🔒 비밀</span>' : '<span class="ci-tag open">📖 공개</span>'}</div>
        <div class="ci-recipe">${order.secret
          ? '레시피: <b>???</b> (직접 찾아보세요!)'
          : '레시피: ' + order.recipe.map(id => `${INGREDIENT_MAP[id].emoji} ${INGREDIENT_MAP[id].name}`).join(' + ')}</div>
        <div class="ci-stats">
          <span>🧺 재료 <b>${order.recipe.length}</b></span>
          <span>🫳 쉐이킹 <b>${order.shakes}</b>회</span>
          <span>⏳ 제한 <b>${order.time + Game.effects.timeBonus}</b>초</span>
        </div>
      </div>
      <button class="btn primary" id="accept-order">주문 받기 (시간 시작!) ▶</button>
    `;
    this.root.appendChild(s);
    s.querySelector('#accept-order').addEventListener('click', () => Game.beginService());
  },

  /* =================================================================
   * 2) 재료 선택 (타이머 진행 중)
   * ================================================================= */
  showIngredients(order) {
    this.clear();
    const s = el('div', 'screen fade-in');
    s.innerHTML = `
      ${this.timerBarHTML()}
      <h2 class="tight">${order.emoji} ${order.name}</h2>
      <p class="muted small">레시피에 맞는 재료를 골라 담고 <b>제조 시작</b>을 누르세요!</p>
      <div class="ingredient-grid" id="ing-grid"></div>
      <div class="selected-bar" id="sel-bar"></div>
      <button class="btn primary" id="confirm-ing" disabled>제조 시작 🍹</button>
    `;
    this.root.appendChild(s);

    const grid = s.querySelector('#ing-grid');
    INGREDIENTS.forEach(ing => {
      const owned = Game.hasIngredient(ing.id);
      const b = el('button', 'ing-cell' + (owned ? '' : ' ing-locked'));
      b.dataset.id = ing.id;
      b.style.setProperty('--ic', ing.color);
      b.innerHTML = owned
        ? `<span class="ing-emoji">${ing.emoji}</span><span class="ing-name">${ing.name}</span>`
        : `<span class="ing-emoji">${ing.emoji}</span><span class="ing-name">${ing.name}</span><span class="ing-lock">🔒</span>`;
      if (owned) b.addEventListener('click', () => Game.toggleIngredient(ing.id));
      else b.disabled = true;
      grid.appendChild(b);
    });
    s.querySelector('#confirm-ing').addEventListener('click', () => Game.confirmIngredients());
    this.updateIngredientSelection();
    this.updateTimer(Game.timeLeft, Game.patienceTotal);
  },

  updateIngredientSelection() {
    const grid = document.getElementById('ing-grid');
    if (!grid) return;
    grid.querySelectorAll('.ing-cell').forEach(cell => {
      cell.classList.toggle('picked', Game.selected.includes(cell.dataset.id));
    });
    const bar = document.getElementById('sel-bar');
    bar.innerHTML = Game.selected.length
      ? Game.selected.map(id => `<span class="chip">${INGREDIENT_MAP[id].emoji} ${INGREDIENT_MAP[id].name}</span>`).join('')
      : '<span class="muted small">아직 담은 재료가 없어요</span>';
    document.getElementById('confirm-ing').disabled = Game.selected.length === 0;
  },

  /* =================================================================
   * 3) 흔들기 (타이머 계속 진행 · 필요한 횟수를 채우면 완성)
   * ================================================================= */
  startShake() {
    this.clear();
    const order = Game.order;
    const s = el('div', 'screen center shake-screen fade-in');
    s.innerHTML = `
      ${this.timerBarHTML()}
      <div class="shake-title">${order.emoji} ${order.name} · 흔들어라!</div>
      <div class="bottle-wrap">
        <div class="bottle" id="bottle" style="--liq:${order.color}">
          <div class="liquid" id="liquid"></div>
          <div class="bottle-neck"></div>
        </div>
        <div class="aura" id="aura"></div>
      </div>
      <div class="shake-count"><span id="shake-num">0</span><span class="shake-need"> / ${order.shakes}</span></div>
      <div class="shake-progress"><div class="shake-progress-fill" id="shake-progress-fill" style="--liq:${order.color}"></div></div>
      <p class="muted small hint-motion">📱 휴대폰을 흔드세요! · (PC: 화면을 빠르게 드래그하거나 Space 연타)</p>
    `;
    this.root.appendChild(s);

    this.updateShakeCount(0, order.shakes);
    this.updateTimer(Game.timeLeft, Game.patienceTotal);

    const bottle = s.querySelector('#bottle');
    const liquid = s.querySelector('#liquid');
    const aura = s.querySelector('#aura');

    Game.sensor.start();

    // 지속적인 흔들림 → 시각 효과
    Game.sensor.onShake = (power) => {
      liquid.style.setProperty('--sway', (power * 16).toFixed(1) + 'px');
      aura.style.opacity = Math.min(0.85, power).toFixed(2);
      aura.style.transform = `scale(${1 + power * 0.4})`;
      bottle.classList.toggle('shaking', power > 0.15);
    };

    // 한 번의 강한 흔들림 = 1 카운트
    Game.sensor.onBeat = () => {
      Game.registerShake();
      bottle.classList.remove('pop'); void bottle.offsetWidth; bottle.classList.add('pop');
    };
  },

  updateShakeCount(done, need) {
    const num = document.getElementById('shake-num');
    const fill = document.getElementById('shake-progress-fill');
    if (num) num.textContent = done;
    if (fill) fill.style.width = Math.min(100, (done / need) * 100) + '%';
    const liquid = document.getElementById('liquid');
    if (liquid) liquid.style.height = (30 + (done / need) * 45) + '%'; // 채워지며 차오름
  },

  /* =================================================================
   * 4) 결과
   * ================================================================= */
  showResult() {
    const r = Game.judge();
    this.renderHUD();
    this.clear();
    const cust = CUSTOMERS[Game.order.customer];
    const s = el('div', `screen center fade-in result ${r.grade.cls}`);
    const reactHTML = cust.sprite
      ? `<div class="sprite-cat ${cust.sprite} sm"></div>`
      : `<span class="react-face">${cust.emoji}</span>`;

    const doneShakes = Math.min(Game.requiredShakes, Math.floor(Game.shakeProgress));
    const rows = [
      ['재료 정확도', Math.round(r.recipe * 100) + '%'],
      ['쉐이킹', `${doneShakes} / ${Game.requiredShakes}회`],
      ['남은 시간', r.timeRatio > 0 ? Game.timeLeftAtFinish.toFixed(1) + 's' : '0.0s'],
    ].map(([k, v]) => `<div class="score-row"><span class="score-label">${k}</span><span class="score-val">${v}</span></div>`).join('');

    s.innerHTML = `
      <div class="result-emoji ${r.grade.key === 'fail' ? 'boom' : ''}">${r.grade.emoji}</div>
      <h2 class="result-title">${r.grade.title}</h2>
      <div class="customer-reaction">
        ${reactHTML}
        <span class="speech-bubble small">${r.quip}</span>
      </div>
      ${r.prefNote ? `<div class="pref-note">💗 ${r.prefNote}</div>` : ''}
      ${r.sideEffect ? `<div class="side-effect">🌀 ${r.sideEffect}</div>` : ''}
      ${r.grade.charmSaved ? `<div class="pref-note">🧿 부적이 실패를 막아줬다냥!</div>` : ''}
      <div class="score-panel">${rows}</div>
      <div class="rewards">
        <span class="reward">💰 +${r.gold}</span>
        <span class="reward">⭐ ${r.rep >= 0 ? '+' : ''}${r.rep}</span>
      </div>
      <button class="btn primary" id="next-cust">${Game.customerIndex + 1 >= CUSTOMERS_PER_DAY ? '하루 마감 🌙' : '다음 손님 ➡️'}</button>
    `;
    this.root.appendChild(s);
    s.querySelector('#next-cust').addEventListener('click', () => {
      Game.customerIndex++;
      Game.nextCustomer();
    });
  },

  /* =================================================================
   * 하루 종료 + 상점
   * ================================================================= */
  showDayEnd(day, gold, rep, next) {
    this.renderHUD();
    this.showSkip(false);
    this.clear();
    const s = el('div', 'screen center fade-in');
    s.innerHTML = `
      <div class="big-emoji">🌟🐾</div>
      <h1>Day ${day} 영업 종료!</h1>
      <p class="muted">오늘의 정산</p>
      <div class="tally"><div>💰 보유 골드 <b>${gold}</b></div><div>⭐ 평판 <b>${rep}</b></div></div>
      <button class="btn primary" id="to-hub">🍸 가게로 돌아가기</button>
    `;
    this.root.appendChild(s);
    s.querySelector('#to-hub').addEventListener('click', next);
  },

  showShop() { this.renderShop(); },

  renderShop() {
    this.renderHUD();
    this.showSkip(false);
    this.clear();
    const s = el('div', 'screen fade-in');
    s.innerHTML = `
      <h2 class="tight">상점 🛒</h2>
      <p class="muted small">보유 💰 ${Game.gold}</p>
      <h3 class="shop-h">🧪 희귀 재료</h3>
      <div class="shop-list" id="ing-shop"></div>
      <h3 class="shop-h">⚙️ 장비 업그레이드</h3>
      <div class="shop-list" id="shop-list"></div>
      <div class="shop-actions">
        <button class="btn primary" id="shop-back">← 가게로</button>
      </div>
    `;
    this.root.appendChild(s);
    s.querySelector('#shop-back').addEventListener('click', () => this.showHub());

    // 희귀 재료 상점
    const ingShop = s.querySelector('#ing-shop');
    const rares = INGREDIENTS.filter(i => i.tier === 'rare');
    const allOwned = rares.every(i => Game.hasIngredient(i.id));
    if (allOwned) {
      ingShop.innerHTML = '<div class="muted small" style="padding:4px 2px">모든 희귀 재료를 보유중이다냥! ✨</div>';
    }
    rares.forEach(ing => {
      const owned = Game.hasIngredient(ing.id);
      if (owned) return;
      const afford = Game.gold >= ing.cost;
      const item = el('div', 'shop-item');
      item.style.setProperty('--ic', ing.color);
      item.innerHTML = `
        <div class="shop-emoji">${ing.emoji}</div>
        <div class="shop-info">
          <div class="shop-name">${ing.name}</div>
          <div class="shop-desc muted small">${ing.place}에서도 채집 가능</div>
        </div>
        <button class="btn small ${afford ? 'primary' : 'disabled'}" ${afford ? '' : 'disabled'} data-id="${ing.id}">💰 ${ing.cost}</button>`;
      ingShop.appendChild(item);
      if (afford) item.querySelector('button').addEventListener('click', () => {
        if (Game.buyIngredient(ing.id)) this.renderShop();
      });
    });

    const list = s.querySelector('#shop-list');
    UPGRADES.forEach(up => {
      const owned = !!Game.upgrades[up.id];
      const afford = Game.gold >= up.cost;
      const item = el('div', 'shop-item' + (owned ? ' owned' : ''));
      item.innerHTML = `
        <div class="shop-emoji">${up.emoji}</div>
        <div class="shop-info">
          <div class="shop-name">${up.name}</div>
          <div class="shop-desc muted small">${up.desc}</div>
        </div>
        <button class="btn small ${owned ? '' : afford ? 'primary' : 'disabled'}" ${owned || !afford ? 'disabled' : ''} data-id="${up.id}">
          ${owned ? '보유중 ✓' : '💰 ' + up.cost}
        </button>`;
      list.appendChild(item);
      if (!owned && afford) item.querySelector('button').addEventListener('click', () => Game.buyUpgrade(up.id));
    });
  },

  /* =================================================================
   * 모험 — 희귀 재료 채집 (하루 1회)
   * ================================================================= */
  showAdventure() {
    this.renderHUD();
    this.showSkip(false);
    this.clear();
    const rares = INGREDIENTS.filter(i => i.tier === 'rare');
    const s = el('div', 'screen fade-in');
    s.innerHTML = `
      <div class="dex-header">
        <button class="btn small" id="adv-back">← 뒤로</button>
        <h2 class="tight">🗺️ 모험</h2>
        <span class="dex-progress">${Game.adventuredToday ? '오늘 완료' : '하루 1회'}</span>
      </div>
      <p class="muted small">희귀 재료를 채집할 장소를 고르세요. (하루 한 곳만!)</p>
      <div class="adv-list" id="adv-list"></div>
    `;
    this.root.appendChild(s);

    const list = s.querySelector('#adv-list');
    rares.forEach(ing => {
      const owned = Game.hasIngredient(ing.id);
      const disabled = owned || Game.adventuredToday;
      const item = el('button', 'adv-card' + (owned ? ' owned' : ''));
      item.style.setProperty('--ic', ing.color);
      item.disabled = disabled;
      item.innerHTML = `
        <div class="adv-place">${ing.place}</div>
        <div class="adv-ing">${ing.emoji} ${ing.name}</div>
        <div class="adv-status">${owned ? '보유중 ✓' : (Game.adventuredToday ? '오늘은 끝' : '채집하기 →')}</div>`;
      if (!disabled) item.addEventListener('click', () => this.doGather(ing.id));
      list.appendChild(item);
    });

    s.querySelector('#adv-back').addEventListener('click', () => this.showHub());
  },

  doGather(id) {
    if (!Game.gatherIngredient(id)) return;
    const ing = INGREDIENT_MAP[id];
    this.clear();
    const s = el('div', 'screen center fade-in');
    s.innerHTML = `
      <div class="adv-found-place muted">${ing.place}</div>
      <div class="big-emoji adv-pop">${ing.emoji}</div>
      <h2>${ing.name} 획득!</h2>
      <p class="muted">희귀 재료를 채집했다냥! 이제 제조에 쓸 수 있어요.</p>
      <button class="btn primary" id="adv-ok">돌아가기</button>
    `;
    this.root.appendChild(s);
    s.querySelector('#adv-ok').addEventListener('click', () => this.showAdventure());
  },
};

/* ------------------------------------------------------------------ */
/* 유틸                                                               */
/* ------------------------------------------------------------------ */
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function pips(n, total) {
  let out = '';
  for (let i = 1; i <= total; i++) out += `<span class="pip ${i <= n ? 'on' : ''}"></span>`;
  return out;
}
function heartStr(visits) {           // 친밀도 하트 (최대 5칸)
  const cap = 5, filled = Math.min(visits, cap);
  return '❤'.repeat(filled) + '♡'.repeat(cap - filled);
}
