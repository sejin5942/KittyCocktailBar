/* =========================================================================
 * UI 컨트롤러 — 화면 전환 + 제조 미니게임(으깨기/따르기/두드리기/흔들기/멈추기)
 * ========================================================================= */

const INTENSITY_TARGET = { gentle: 0.30, medium: 0.58, strong: 0.85 };

const UI = {
  cache() {
    this.root = document.getElementById('app');
    this.hud = document.getElementById('hud');
  },

  /* ---- 상단 HUD ---- */
  renderHUD() {
    this.hud.innerHTML = `
      <span class="hud-item">📅 Day ${Game.day}</span>
      <span class="hud-item">💰 ${Game.gold}</span>
      <span class="hud-item">⭐ ${Game.reputation}</span>
    `;
    this.hud.style.display = 'flex';
  },

  showScreen(name) {
    // 타이틀에서는 HUD 숨김
    if (name === 'title') this.hud.style.display = 'none';
  },

  clear() { this.root.innerHTML = ''; },

  /* =================================================================
   * 하루 시작 인트로
   * ================================================================= */
  showDayIntro(day, next) {
    this.renderHUD();
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
   * 1) 손님 주문
   * ================================================================= */
  showOrder(order, n, total) {
    this.renderHUD();
    this.clear();
    const cust = CUSTOMERS[order.customer];
    const s = el('div', 'screen fade-in');
    s.innerHTML = `
      <div class="progress-pips">${pips(n, total)}</div>
      <div class="customer-card" style="--cc:${cust.color}">
        <div class="customer-face">${cust.emoji}</div>
        <div class="customer-name">${cust.name} 손님</div>
        <div class="speech-bubble">${order.want}</div>
      </div>
      <div class="order-hint">필요한 것: <b>${order.hint}</b> 물약일까?</div>
      <button class="btn primary" id="to-ingredients">재료 고르기 🧺</button>
    `;
    this.root.appendChild(s);
    s.querySelector('#to-ingredients').addEventListener('click', () => this.showIngredients(order));
  },

  /* =================================================================
   * 2) 재료 선택
   * ================================================================= */
  showIngredients(order) {
    this.clear();
    const s = el('div', 'screen fade-in');
    s.innerHTML = `
      <h2 class="tight">재료를 골라 담으세요</h2>
      <p class="muted small">주문: “${order.want}”</p>
      <div class="ingredient-grid" id="ing-grid"></div>
      <div class="selected-bar" id="sel-bar"></div>
      <button class="btn primary" id="confirm-ing" disabled>제조 시작 🍹</button>
    `;
    this.root.appendChild(s);

    const grid = s.querySelector('#ing-grid');
    INGREDIENTS.forEach(ing => {
      const b = el('button', 'ing-cell');
      b.dataset.id = ing.id;
      b.style.setProperty('--ic', ing.color);
      b.innerHTML = `<span class="ing-emoji">${ing.emoji}</span><span class="ing-name">${ing.name}</span>`;
      b.addEventListener('click', () => Game.toggleIngredient(ing.id));
      grid.appendChild(b);
    });

    s.querySelector('#confirm-ing').addEventListener('click', () => Game.confirmIngredients());
    this.updateIngredientSelection();
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
   * 3) 제조 조작 — 재료별 (으깨기/따르기/두드리기)
   * ================================================================= */
  startPrep(ids) {
    this.prepQueue = ids.slice();
    this.nextPrep();
  },

  nextPrep() {
    if (this.prepQueue.length === 0) {
      return this.startShake();
    }
    const id = this.prepQueue.shift();
    const ing = INGREDIENT_MAP[id];
    this.clear();

    const s = el('div', 'screen center fade-in');
    const verb = { mash: '으깨기', pour: '따르기', tap: '두드려 넣기' }[ing.prep];
    const guide = {
      mash: '재료를 여러 번 <b>탭</b>해서 으깨세요!',
      pour: '병을 <b>기울여(길게 눌러)</b> 액체를 따르세요!',
      tap:  '가루를 <b>톡톡</b> 여러 번 두드려 넣으세요!',
    }[ing.prep];

    s.innerHTML = `
      <div class="prep-label">${ing.name} · ${verb}</div>
      <div class="prep-stage">
        <div class="prep-item" id="prep-item" style="--ic:${ing.color}">${ing.emoji}</div>
        <div class="prep-bowl">🥣</div>
      </div>
      <div class="meter"><div class="meter-fill" id="prep-fill" style="--mc:${ing.color}"></div></div>
      <p class="muted small">${guide}</p>
    `;
    this.root.appendChild(s);

    let progress = 0;
    let finished = false;              // 완료 후 중복 진행 방지
    let pourTimer = null;
    let pourEnd = null;                // 전역 pointerup 리스너 참조(정리용)
    const item = s.querySelector('#prep-item');
    const fill = s.querySelector('#prep-fill');
    const need = 100;

    const complete = () => {
      if (finished) return;           // 정확히 한 번만
      finished = true;
      Game.prepDone[id] = true;
      if (pourTimer) clearInterval(pourTimer);
      if (pourEnd) window.removeEventListener('pointerup', pourEnd);
      setTimeout(() => this.nextPrep(), 260);
    };

    const bump = (amount, cls) => {
      if (finished) return;           // 완료 후 입력 무시
      progress = Math.min(need, progress + amount);
      fill.style.width = progress + '%';
      item.classList.remove('anim-mash', 'anim-tap', 'anim-pour');
      void item.offsetWidth;
      item.classList.add(cls);
      if (progress >= need) complete();
    };

    if (ing.prep === 'mash') {
      item.addEventListener('pointerdown', () => bump(22, 'anim-mash'));
    } else if (ing.prep === 'tap') {
      item.addEventListener('pointerdown', () => bump(18, 'anim-tap'));
    } else { // pour: 길게 누르는 동안 채워짐
      let holding = false;
      const startHold = () => {
        if (finished) return;
        holding = true;
        item.classList.add('anim-pour');
        if (!pourTimer) pourTimer = setInterval(() => { if (holding) bump(6, 'anim-pour'); }, 60);
      };
      pourEnd = () => { holding = false; item.classList.remove('anim-pour'); };
      item.addEventListener('pointerdown', startHold);
      window.addEventListener('pointerup', pourEnd);
    }
  },

  /* =================================================================
   * 4) 흔들기 미니게임 — 강도 유지 + 리듬 맞추기
   * ================================================================= */
  startShake() {
    this.clear();
    const order = Game.order;
    const target = INTENSITY_TARGET[order.shake.intensity];
    const s = el('div', 'screen center shake-screen fade-in');
    s.innerHTML = `
      <div class="shake-title">흔들어 섞기! <span class="muted small">(${labelIntensity(order.shake.intensity)} · ${labelRhythm(order.shake.rhythm)})</span></div>
      <div class="bottle-wrap">
        <div class="bottle" id="bottle" style="--liq:${order.color}">
          <div class="liquid" id="liquid"></div>
          <div class="foam" id="foam"></div>
          <div class="bottle-neck"></div>
        </div>
        <div class="aura" id="aura"></div>
      </div>
      <div class="intensity-gauge">
        <div class="target-zone" id="target-zone"></div>
        <div class="needle" id="needle"></div>
      </div>
      <div class="beat-track" id="beat-track"></div>
      <div class="shake-status" id="shake-status">준비...</div>
      <p class="muted small hint-motion">📱 휴대폰을 흔드세요 · (PC: 화면을 빠르게 드래그하거나 Space)</p>
    `;
    this.root.appendChild(s);

    const target01 = target;
    // 목표 존 표시 (±폭, 셰이커 업그레이드로 넓어짐) — 가로 게이지
    const band = 0.16 + Game.effects.shakeTolerance;
    const zone = s.querySelector('#target-zone');
    zone.style.left = (Math.max(0, target01 - band) * 100) + '%';
    zone.style.width = (band * 2 * 100) + '%';

    const needle = s.querySelector('#needle');
    const liquid = s.querySelector('#liquid');
    const aura = s.querySelector('#aura');
    const bottle = s.querySelector('#bottle');
    const status = s.querySelector('#shake-status');
    const beatTrack = s.querySelector('#beat-track');

    // ---- 리듬 트랙 세팅 ----
    const beatInterval = 60000 / order.shake.bpm; // ms
    let beatSamples = [];   // 각 박자에서의 정확도 0~1
    let intensitySamples = [];
    const duration = 6500;  // 흔들기 지속(ms)
    const started = performance.now();
    let nextBeatAt = started + 800;

    this.pulses = [];       // 화면 박자 펄스

    Game.sensor.start();

    // 흔들기 강도 → 게이지/시각효과
    Game.sensor.onShake = (power) => {
      needle.style.left = (Math.min(1, power) * 100) + '%';
      const inZone = Math.abs(power - target01) <= band;
      needle.classList.toggle('in-zone', inZone);
      // 액체 출렁임 + 오라
      liquid.style.setProperty('--sway', (power * 18).toFixed(1) + 'px');
      aura.style.opacity = Math.min(0.9, power).toFixed(2);
      aura.style.transform = `scale(${1 + power * 0.5})`;
      bottle.classList.toggle('over', power > 0.94);
      bottle.classList.toggle('shaking', power > 0.15);
      intensitySamples.push(inZone ? 1 : Math.max(0, 1 - Math.abs(power - target01) * 2.2));
    };

    // 박자에 맞춘 충격 감지
    Game.sensor.onBeat = (imp) => {
      const now = performance.now();
      // 가장 가까운 박자와의 시간차
      const diff = Math.abs(now - nextBeatAt);
      const acc = Math.max(0, 1 - diff / (beatInterval * 0.6));
      if (diff < beatInterval * 0.9) {
        beatSamples.push(acc);
        this.flashBeat(beatTrack, acc);
      }
    };

    // 박자 표시 루프
    const beatLoop = () => {
      const now = performance.now();
      if (now >= nextBeatAt) {
        this.spawnBeatCue(beatTrack);
        nextBeatAt += beatInterval;
      }
      const t = now - started;
      const pct = Math.min(1, t / duration);
      status.textContent = pct < 1 ? '섞는 중...' : '';
      if (t < duration) {
        this._shakeRAF = requestAnimationFrame(beatLoop);
      } else {
        finishShake();
      }
    };
    this._shakeRAF = requestAnimationFrame(beatLoop);

    const finishShake = () => {
      Game.sensor.stop();
      Game.sensor.onShake = null;
      Game.sensor.onBeat = null;
      cancelAnimationFrame(this._shakeRAF);

      const avgInt = avg(intensitySamples);
      const avgRhythm = beatSamples.length ? avg(beatSamples) : 0.2;
      Game.metrics.intensity = clamp01(avgInt);
      Game.metrics.rhythm = clamp01(avgRhythm * (0.6 + Math.min(1, beatSamples.length / 6) * 0.4));
      this.startStop();
    };
  },

  spawnBeatCue(track) {
    const cue = el('div', 'beat-cue');
    track.appendChild(cue);
    // 애니메이션이 중앙 판정선으로 이동
    requestAnimationFrame(() => cue.classList.add('go'));
    setTimeout(() => cue.remove(), 1200);
  },

  flashBeat(track, acc) {
    const line = document.createElement('div');
    line.className = 'beat-hit ' + (acc > 0.7 ? 'good' : acc > 0.4 ? 'ok' : 'bad');
    track.appendChild(line);
    setTimeout(() => line.remove(), 400);
  },

  /* =================================================================
   * 5) 멈추기 미니게임 — 거품이 병목에 닿기 직전에 STOP
   * ================================================================= */
  startStop() {
    this.clear();
    const order = Game.order;
    const s = el('div', 'screen center fade-in');
    s.innerHTML = `
      <div class="shake-title">지금 멈춰!</div>
      <div class="stop-tube">
        <div class="stop-fill" id="stop-fill" style="--liq:${order.color}"></div>
        <div class="stop-danger-line"></div>
        <div class="stop-neck">병목</div>
      </div>
      <button class="btn danger big" id="stop-btn">STOP ✋</button>
      <p class="muted small">거품이 <b>병목선</b>에 닿기 직전에 멈추세요. 늦으면 뚜껑이 날아가요!</p>
    `;
    this.root.appendChild(s);

    const fill = s.querySelector('#stop-fill');
    const dangerAt = 0.88; // 88%가 병목선
    let level = 0;
    let stopped = false;
    const speed = 0.010 + Math.random() * 0.006;
    const started = performance.now();
    let last = started;

    const loop = (now) => {
      if (stopped) return;
      const dt = (now - last) / 16.67;
      last = now;
      level += speed * dt;
      fill.style.height = Math.min(100, level * 100) + '%';
      if (level >= 1.0) {
        // 넘침 = 폭발 처리
        return doStop(1.2);
      }
      this._stopRAF = requestAnimationFrame(loop);
    };
    this._stopRAF = requestAnimationFrame(loop);

    const doStop = (lvl) => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(this._stopRAF);
      // 판정: dangerAt에 가까울수록 좋음, 넘으면 0
      let stopScore;
      if (lvl >= 1.0) stopScore = 0;
      else if (lvl > dangerAt) stopScore = Math.max(0, 1 - (lvl - dangerAt) * 8); // 살짝 넘으면 급감
      else stopScore = Math.max(0, 1 - (dangerAt - lvl) * 1.6);
      Game.metrics.stop = clamp01(stopScore);
      // 시각 피드백
      if (lvl >= 1.0) fill.classList.add('overflow');
      setTimeout(() => this.showResult(), 500);
    };

    s.querySelector('#stop-btn').addEventListener('click', () => doStop(level));
  },

  /* =================================================================
   * 6) 결과 판정
   * ================================================================= */
  showResult() {
    const r = Game.judge();
    this.renderHUD();
    this.clear();
    const cust = CUSTOMERS[Game.order.customer];
    const s = el('div', `screen center fade-in result ${r.grade.cls}`);

    const bars = [
      ['재료 정확도', r.metrics.recipe],
      ['흔든 강도', r.metrics.intensity],
      ['리듬 정확도', r.metrics.rhythm],
      ['멈춤 타이밍', r.metrics.stop],
    ].map(([label, v]) => `
      <div class="score-row">
        <span class="score-label">${label}</span>
        <div class="score-bar"><div class="score-bar-fill" style="width:${Math.round(v * 100)}%"></div></div>
      </div>`).join('');

    s.innerHTML = `
      <div class="result-emoji ${r.grade.key === 'explode' ? 'boom' : ''}">${r.grade.emoji}</div>
      <h2 class="result-title">${r.grade.title}</h2>
      <div class="customer-reaction">
        <span class="react-face">${cust.emoji}</span>
        <span class="speech-bubble small">${r.quip}</span>
      </div>
      ${r.prefNote ? `<div class="pref-note">💗 ${r.prefNote}</div>` : ''}
      ${r.sideEffect ? `<div class="side-effect">🌀 ${r.sideEffect}</div>` : ''}
      ${r.grade.charmSaved ? `<div class="pref-note">🧿 부적이 폭발을 막았다냥!</div>` : ''}
      <div class="score-panel">${bars}</div>
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
    this.clear();
    const s = el('div', 'screen center fade-in');
    s.innerHTML = `
      <div class="big-emoji">🌟🐾</div>
      <h1>Day ${day} 영업 종료!</h1>
      <p class="muted">오늘의 정산</p>
      <div class="tally">
        <div>💰 보유 골드 <b>${gold}</b></div>
        <div>⭐ 평판 <b>${rep}</b></div>
      </div>
      <button class="btn primary" id="to-shop">상점으로 🛒</button>
    `;
    this.root.appendChild(s);
    s.querySelector('#to-shop').addEventListener('click', next);
  },

  showShop() { this.renderShop(); },

  renderShop() {
    this.renderHUD();
    this.clear();
    const s = el('div', 'screen fade-in');
    s.innerHTML = `
      <h2 class="tight">상점 🛒</h2>
      <p class="muted small">골드로 장비를 업그레이드하세요. (보유 💰 ${Game.gold})</p>
      <div class="shop-list" id="shop-list"></div>
      <button class="btn primary" id="next-day">다음 날 시작 🌅</button>
    `;
    this.root.appendChild(s);

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
      if (!owned && afford) {
        item.querySelector('button').addEventListener('click', () => Game.buyUpgrade(up.id));
      }
    });

    s.querySelector('#next-day').addEventListener('click', () => Game.leaveShop());
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
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function labelIntensity(k) { return { gentle: '약하게', medium: '적당히', strong: '강하게' }[k]; }
function labelRhythm(k) { return { steady: '일정한 박자', fast: '빠른 박자', burst: '폭발적으로' }[k]; }
