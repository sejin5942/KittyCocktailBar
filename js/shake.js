/* =========================================================================
 * 흔들기 감지 (Shake detection)
 *   - 모바일: DeviceMotion API (가속도 기반)
 *   - 데스크톱/미지원: 마우스·터치 드래그 속도, 스페이스바 연타로 대체
 *
 * 사용:
 *   const shaker = new ShakeSensor();
 *   await shaker.enable();          // iOS 권한 요청 포함
 *   shaker.onShake = (power) => {}; // 매 프레임 0~1 정규화 강도
 * ========================================================================= */

class ShakeSensor {
  constructor() {
    this.power = 0;              // 현재 흔들기 강도 (0~1, 감쇠 적용)
    this.rawImpulse = 0;         // 이번 프레임 순간 충격량
    this.hasMotion = false;      // DeviceMotion 지원 여부
    this.active = false;
    this.onShake = null;
    this.onBeat = null;          // 강한 순간 충격(박자) 콜백

    this._last = { x: 0, y: 0, z: 0 };
    this._decay = 0.90;          // 강도 감쇠
    this._beatCooldown = 0;

    // 데스크톱 드래그 추적
    this._pointer = { x: 0, y: 0, active: false, t: 0 };

    this._boundMotion = this._onMotion.bind(this);
    this._boundMove = this._onPointerMove.bind(this);
    this._boundDown = this._onPointerDown.bind(this);
    this._boundUp = this._onPointerUp.bind(this);
    this._boundKey = this._onKey.bind(this);

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  /** iOS 13+ 권한 요청 포함, 센서 활성화. Promise<boolean> 반환 */
  async enable() {
    // iOS 권한 요청
    const DME = window.DeviceMotionEvent;
    if (DME && typeof DME.requestPermission === 'function') {
      try {
        const res = await DME.requestPermission();
        this.hasMotion = res === 'granted';
      } catch (e) {
        this.hasMotion = false;
      }
    } else if (DME) {
      this.hasMotion = true;
    }

    if (this.hasMotion) {
      window.addEventListener('devicemotion', this._boundMotion, { passive: true });
    }
    // 항상 대체 입력도 함께 등록 (데스크톱 테스트 + 모션 미지원 대비)
    window.addEventListener('pointerdown', this._boundDown);
    window.addEventListener('pointermove', this._boundMove);
    window.addEventListener('pointerup', this._boundUp);
    window.addEventListener('keydown', this._boundKey);

    return this.hasMotion;
  }

  start() { this.active = true; }
  stop() { this.active = false; this.power = 0; this.rawImpulse = 0; }

  _onMotion(e) {
    const acc = e.accelerationIncludingGravity || e.acceleration;
    if (!acc) return;
    const x = acc.x || 0, y = acc.y || 0, z = acc.z || 0;
    const dx = x - this._last.x, dy = y - this._last.y, dz = z - this._last.z;
    this._last = { x, y, z };
    const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
    // 대략 0~30 범위를 0~1로 매핑
    this.rawImpulse = Math.max(this.rawImpulse, Math.min(1, delta / 22));
  }

  _onPointerDown(e) {
    this._pointer = { x: e.clientX, y: e.clientY, active: true, t: performance.now() };
  }
  _onPointerUp() { this._pointer.active = false; }
  _onPointerMove(e) {
    if (!this._pointer.active) return;
    const now = performance.now();
    const dt = Math.max(1, now - this._pointer.t);
    const dx = e.clientX - this._pointer.x;
    const dy = e.clientY - this._pointer.y;
    const speed = Math.sqrt(dx * dx + dy * dy) / dt; // px/ms
    this._pointer = { x: e.clientX, y: e.clientY, active: true, t: now };
    this.rawImpulse = Math.max(this.rawImpulse, Math.min(1, speed / 2.2));
  }

  _onKey(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      this.rawImpulse = Math.max(this.rawImpulse, 0.85);
    }
  }

  _loop() {
    // 강도 감쇠 + 순간 충격 반영
    this.power = Math.max(this.power * this._decay, this.rawImpulse);

    // 박자 감지: 강한 순간 충격이 임계값을 넘고 쿨다운이 끝났을 때
    if (this._beatCooldown > 0) this._beatCooldown--;
    if (this.active && this.rawImpulse > 0.5 && this._beatCooldown === 0) {
      this._beatCooldown = 6; // 약 100ms (초당 최대 ~10회)
      if (this.onBeat) this.onBeat(this.rawImpulse);
    }

    if (this.active && this.onShake) this.onShake(this.power);

    this.rawImpulse *= 0.4; // 순간 충격은 빠르게 사라짐
    requestAnimationFrame(this._loop);
  }
}
