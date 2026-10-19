import { GymScene3D } from './scene.js';
import { sound } from './audio.js';
import { Tutorial } from './tutorial.js';
import { StoryUI } from './storyUI.js';
import { SaveData, store } from './save.js';
import { MECHANICS } from './lifts.js';
import { portrait, buildForChapter } from './portraits.js';
import { ALL_STAGES } from './story.js';
import { TUNING as T, BALANCE as B, ITEMS, EXERCISE_NAMES } from './config.js';

// Physics modifiers; the tutorial overrides these per step
const DEFAULT_FLAGS = {
  driftScale: 1,      // 좌우 흔들림 / 그립 슬립 배율 (0 = 없음)
  sticking: 'auto',   // 'auto' | 'force' | 'off'
  drainScale: 1,      // 한계 지점 스태미나 감소 배율
  ratio: null,        // 고정 r (튜토리얼용). null이면 근력 기준
  freeItems: false    // true면 아이템 재고 소모 없음
};

// Bar height (world units) for each exercise at progress 0 and 1
const LIMITS = {
  bench: { low: 0.88, high: 1.45 },
  squat: { low: 0.86, high: 1.45 },
  deadlift: { low: 0.45, high: 1.05 }
};

export class IronLiftGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene3d = new GymScene3D(this.container);
    this.save = new SaveData();

    this.mode = 'menu';       // 'menu' | 'free' | 'story'
    this.run = null;          // story stage run
    this.exercise = 'bench';
    this.weight = 40;
    this.set = { reps: 1, repDone: 0 };

    this.pr = {
      bench: parseInt(store.get('pr_bench') || '0'),
      squat: parseInt(store.get('pr_squat') || '0'),
      deadlift: parseInt(store.get('pr_deadlift') || '0')
    };

    this.buffs = { ammonia: 0, belt: false, pumpLock: 0 };

    // Lift state
    this.state = 'IDLE'; // IDLE, DESCENDING, ASCENDING, STICKING_POINT, LOCKED_OUT, PINNED
    this.prog = 1;       // 0 = bottom, 1 = lockout
    this.vel = 0;
    this.tilt = 0;
    this.tiltVel = 0;
    this.stamina = 1;
    this.pump = T.pumpMin;
    this.shownPump = -1;
    this.stickCount = 0;
    this.stickDone = false;
    this.weakSide = 1;
    this.driftWave = 0;
    this.heartbeatTimer = 0;
    this.gust = { timer: 2, warn: 0, dir: 1 };
    this.pg = { pos: 0, dir: 1, center: 0.5, hw: 0.2, pw: 0.07, jam: 0, wait: 0, inZone: false, sticking: false };
    this.sq = { bottomT: 0, tension: 0, overload: 0, grind: 0 };
    this.dl = { tokens: 3, slip: null, slipTimer: 0 };
    this.lastSlipAt = -99;
    this.bottomTimer = 0;
    this.lastDt = 0;
    this.simTime = 0;
    this.lastClickAt = 0;
    this.holding = false;
    this.pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.wheelAccum = 0;
    this.timers = [];

    this.keys = { left: false, right: false };

    this.initDOM();
    this.tutorial = new Tutorial(this);
    this.storyUI = new StoryUI(this);
    this.initInputs();
    this.applyLoadout('bench', 40);

    if (!store.get('ironlift_tutorial_seen')) {
      setTimeout(() => this.tutorial.start(), 400);
    } else {
      this.storyUI.showMenu();
    }

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  // ---------- helpers ----------
  get flags() {
    return this.tutorial && this.tutorial.active ? this.tutorial.flags : DEFAULT_FLAGS;
  }

  get mech() {
    return MECHANICS[this.exercise];
  }

  // Protagonist body: by the stage being played, otherwise by story progress
  currentBuild() {
    if (this.run && this.run.stage.chapterId) return buildForChapter(this.run.stage.chapterId);
    if (this.save.data.ending) return 'buff';
    const next = ALL_STAGES.find(st => !this.save.isCleared(st.id));
    return buildForChapter(next ? next.chapterId : 5);
  }

  // Face cam: protagonist reacts to the lift
  updateFaceCam() {
    let mood = 'normal';
    if (this.state === 'DESCENDING') mood = 'think';
    else if (this.state === 'ASCENDING') mood = this.stamina < 0.3 ? 'sad' : 'angry';
    else if (this.state === 'STICKING_POINT') mood = 'shock';
    else if (this.state === 'LOCKED_OUT') mood = 'happy';
    else if (this.state === 'PINNED') mood = 'sad';
    const key = `${mood}|${this.currentBuild()}`;
    if (key === this._faceKey) return;
    this._faceKey = key;
    this.dom.faceCam.innerHTML = portrait('me', mood, { build: this.currentBuild() });
    this.dom.faceCam.dataset.mood = mood;
  }

  mods() {
    return (this.run && this.run.stage.mods) || {};
  }

  capacity(ex = this.exercise) {
    if (this.flags.ratio) return this.weight / this.flags.ratio;
    return this.save.strength[ex];
  }

  ratio() {
    return this.weight / this.capacity();
  }

  isLifting() {
    return this.state === 'DESCENDING' || this.state === 'ASCENDING' || this.state === 'STICKING_POINT';
  }

  barY() {
    const l = LIMITS[this.exercise];
    return l.low + Math.max(-0.1, Math.min(1, this.prog)) * (l.high - l.low);
  }

  later(fn, ms) {
    const id = setTimeout(() => {
      this.timers = this.timers.filter(t => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  cancelTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  // Shared actions used by the mechanics (lifts.js)
  power() {
    return (T.powerFloor + (1 - T.powerFloor) * Math.max(0, this.stamina)) *
      (1 + T.pumpPower * this.pump) *
      (this.buffs.ammonia > 0 ? ITEMS.ammonia.power : 1) *
      (this.buffs.belt ? ITEMS.belt.power : 1);
  }

  spend(amount) {
    this.stamina = Math.max(0, this.stamina - amount);
  }

  pumpUp() {
    this.pump = Math.min(1, this.pump + T.pumpPerAction);
  }

  shake(x) {
    this.scene3d.addScreenShake(x);
  }

  fx(x, y, label, tone) {
    this.spawnClickFX(x, y, label, tone);
  }

  tiltScale() {
    return (this.buffs.belt ? ITEMS.belt.tiltMul : 1) * this.flags.driftScale * (this.mods().drift || 1);
  }

  clickWobble(r, mul) {
    this.tiltVel += (this.weakSide * B.clickBias + (Math.random() - 0.5) * B.clickRand) * r * this.tiltScale() * mul;
  }

  integrate(dt, gravity) {
    this.lastDt = dt;
    this.vel -= gravity * dt;
    this.vel *= Math.pow(T.velKeepPerSec, dt);
    this.prog += this.vel * dt;
  }

  drive(v) {
    this.state = 'ASCENDING';
    this.vel = v;
    sound.playBarbellClank(this.weight, 0.7);
    sound.playGrunt();
    this.shake(0.12);
  }

  checkAscent(r) {
    const f = this.flags;
    const sticks = f.sticking === 'force' || (f.sticking === 'auto' && r >= T.stickRatio);
    if (sticks && !this.stickDone && this.prog >= T.stickAt) {
      this.enterSticking(r);
    } else if (this.prog >= 1) {
      this.prog = 1;
      this.updateDepthHUD();
      this.onRepSuccess();
    } else {
      // The bar rests on the chest / in the hole / on the floor; it can't sink below.
      if (this.prog <= 0) {
        this.prog = 0;
        if (this.vel < 0) this.vel = 0;
      }
      // Time spent near the bottom accumulates (hovering just above it still counts)
      if (this.prog <= T.bottomZone) this.bottomTimer += this.lastDt;
      else this.bottomTimer = Math.max(0, this.bottomTimer - this.lastDt * 0.5);
      const limit = T.bottomFailTime[this.exercise];
      if (this.bottomTimer > limit) {
        const slipped = this.exercise === 'deadlift' && this.simTime - this.lastSlipAt < 2.5;
        this.onFail(slipped ? 'grip' : this.exercise === 'deadlift' ? 'floor' : 'stamina');
      } else if (this.bottomTimer > 0.35 && this.prog <= T.bottomZone) {
        this.dom.promptKey.innerText = this.exercise === 'deadlift' ? '바닥에서 떼라!! 휠!!' : '깔리기 직전!! 밀어!!';
      }
    }
  }

  enterSticking(r) {
    this.state = 'STICKING_POINT';
    this.prog = T.stickAt;
    this.vel = 0;
    this.stickCount = 0;
    this.heartbeatTimer = 0;
    this.dom.vignette.classList.add('active');
    this.shake(0.12);
    const hint = this.mech.onStick(this, r);
    this.setPrompt('⚡ STICKING POINT!! ⚡', hint);
    this.tutorial.onEvent('sticking');
  }

  breakThrough() {
    this.state = 'ASCENDING';
    this.stickDone = true;
    this.vel = T.breakVel;
    this.dom.vignette.classList.remove('active');
    sound.playLockoutBoom();
    this.shake(0.25);
    this.setPrompt('BREAKTHROUGH!! 💥', '돌파! 끝까지 밀어붙여라!');
    if (this.mech.onBreak) this.mech.onBreak(this);
  }

  // ---------- DOM ----------
  initDOM() {
    const $ = (id) => document.getElementById(id);
    this.dom = {
      totalVal: $('total-val'),
      progressFill: $('progress-fill'),
      tabBench: $('tab-bench'),
      tabSquat: $('tab-squat'),
      tabDeadlift: $('tab-deadlift'),
      weightVal: $('weight-val'),
      ratioVal: $('ratio-val'),
      btnWeightMinus: $('btn-weight-minus'),
      btnWeightPlus: $('btn-weight-plus'),
      btnLift: $('btn-lift'),
      depthIndicator: $('depth-indicator'),
      depthTargetZone: $('depth-target-zone'),
      balanceBubble: $('balance-bubble'),
      gustWarn: $('gust-warn'),
      staminaFill: $('stamina-fill'),
      tensionFill: $('tension-fill'),
      gaugeZone: $('pg-zone'),
      gaugePerfect: $('pg-perfect'),
      gaugeNeedle: $('pg-needle'),
      gaugeLabel: $('pg-label'),
      gauge: $('power-gauge'),
      gripAlert: $('grip-alert'),
      gripKey: $('grip-key'),
      gripBar: $('grip-bar'),
      pumpFill: $('pump-fill'),
      promptKey: $('prompt-key'),
      promptHint: $('prompt-hint'),
      vignette: $('sticking-vignette'),
      prModal: $('pr-modal'),
      prTitle: $('pr-title'),
      prDesc: $('pr-desc'),
      btnPrConfirm: $('btn-pr-confirm'),
      failModal: $('fail-modal'),
      failTitle: $('fail-title'),
      failDesc: $('fail-desc'),
      btnFailConfirm: $('btn-fail-confirm'),
      gear: { ammonia: $('gear-ammonia'), belt: $('gear-belt'), booster: $('gear-booster') },
      gearCount: { ammonia: $('cnt-ammonia'), belt: $('cnt-belt'), booster: $('cnt-booster') },
      btnMute: $('btn-mute'),
      btnHome: $('btn-home'),
      tutorialModal: $('tutorial-modal'),
      btnTutorial: $('btn-tutorial'),
      btnTutorialClose: $('btn-tutorial-close'),
      btnStartTraining: $('btn-start-training'),
      sbTitle: $('sb-title'),
      sbLift: $('sb-lift'),
      sbReps: $('sb-reps'),
      sbAttempts: $('sb-attempts'),
      toast: $('toast'),
      faceCam: $('face-cam'),
      prPortrait: $('pr-portrait'),
      failPortrait: $('fail-portrait')
    };

    this.dom.tabBench.onclick = () => this.switchExercise('bench');
    this.dom.tabSquat.onclick = () => this.switchExercise('squat');
    this.dom.tabDeadlift.onclick = () => this.switchExercise('deadlift');

    this.dom.btnWeightMinus.onclick = () => this.changeWeight(-5);
    this.dom.btnWeightPlus.onclick = () => this.changeWeight(+5);

    // #btn-lift is handled by the global pointerdown (so squat can hold it)

    Object.keys(this.dom.gear).forEach(k => {
      this.dom.gear[k].onclick = () => { if (!this.isLifting()) this.useItem(k); };
      this.dom.gear[k].title = `${ITEMS[k].name}: ${ITEMS[k].desc}`;
    });

    this.dom.btnPrConfirm.onclick = () => this.closeModals();
    this.dom.btnFailConfirm.onclick = () => this.closeModals();

    this.dom.btnTutorial.onclick = () => this.dom.tutorialModal.classList.add('show');
    this.dom.btnTutorialClose.onclick = () => {
      this.dom.tutorialModal.classList.remove('show');
      store.set('ironlift_tutorial_seen', 'true');
    };
    this.dom.btnStartTraining.onclick = () => {
      this.dom.tutorialModal.classList.remove('show');
      this.tutorial.start();
    };

    this.dom.btnHome.onclick = () => this.storyUI.requestHome();

    this.dom.btnMute.onclick = () => {
      const isMuted = sound.toggleMute();
      this.dom.btnMute.innerText = isMuted ? '🔇' : '🔊';
    };
  }

  initInputs() {
    window.addEventListener('keydown', (e) => {
      sound.init();
      if (!sound.bgmPlaying) sound.startBGM();

      if (this.storyUI.onKey(e)) return; // dialogue advance etc.

      if (e.code === 'Space') e.preventDefault();
      const left = e.code === 'KeyA' || e.code === 'ArrowLeft';
      const right = e.code === 'KeyD' || e.code === 'ArrowRight';
      if ((left || right) && !e.repeat && this.isLifting() && this.mech.key(this, left ? 'L' : 'R')) return;
      if (left) this.keys.left = true;
      if (right) this.keys.right = true;

      if (e.repeat) return;
      if (e.key === '1') this.useItem('ammonia');
      if (e.key === '2') this.useItem('belt');
      if (e.key === '3') this.useItem('booster');
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
    });

    // Losing focus (Alt+Tab etc.) would leave keys/mouse stuck down
    const releaseAll = () => {
      this.keys.left = false;
      this.keys.right = false;
      if (this.holding) { this.holding = false; this.onRelease(); }
    };
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

    let touchY = null;

    window.addEventListener('pointerdown', (e) => {
      sound.init();
      if (!sound.bgmPlaying) sound.startBGM();

      if (e.target.closest('.interactive') && !e.target.closest('#btn-lift')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (this.isModalOpen()) return;

      this.pointer = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'touch') touchY = e.clientY;
      this.holding = true;
      this.onPress(e.clientX, e.clientY);
    });

    window.addEventListener('pointermove', (e) => {
      this.pointer = { x: e.clientX, y: e.clientY };
      // Touch: swipe down = deadlift pull
      if (touchY !== null && this.exercise === 'deadlift') {
        const dy = e.clientY - touchY;
        if (dy > 40) { this.onWheel(dy / 40); touchY = e.clientY; }
        else if (dy < 0) touchY = e.clientY;
      }
    });

    const up = () => {
      touchY = null;
      if (!this.holding) return;
      this.holding = false;
      this.onRelease();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse wheel = deadlift pull (page never scrolls during play)
    window.addEventListener('wheel', (e) => {
      if (this.storyUI.isBlocking() || this.isModalOpen() || this.mode === 'menu') return;
      e.preventDefault();
      if (e.deltaY <= 0) { this.wheelAccum = 0; return; }
      const px = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      this.onWheel(px / 100);
    }, { passive: false });
  }

  isModalOpen() {
    return [this.dom.prModal, this.dom.failModal, this.dom.tutorialModal]
      .some(m => m && m.classList.contains('show')) || this.storyUI.isBlocking();
  }

  inputBlocked() {
    return this.tutorial.blocksPush || this.mode === 'menu' || this.storyUI.isBlocking();
  }

  // ---------- input dispatch ----------
  onPress(x, y) {
    if (this.inputBlocked()) return;
    const now = performance.now();
    if (now - this.lastClickAt < T.minClickMs) return; // autoclicker guard
    this.lastClickAt = now;

    if (this.state === 'IDLE') {
      this.startRep();
      this.fx(x, y, 'GO!', 'strong');
      return;
    }
    if (this.isLifting()) this.mech.press(this, x, y);
  }

  onRelease() {
    if (this.inputBlocked() || !this.isLifting()) return;
    this.mech.release(this);
  }

  onWheel(units) {
    if (this.inputBlocked() || this.exercise !== 'deadlift' || !this.isLifting()) return;
    this.wheelAccum += units;
    const n = Math.floor(this.wheelAccum);
    if (n <= 0) return;
    this.wheelAccum -= n;
    this.mech.wheel(this, Math.min(n, 4));
  }

  spawnClickFX(x, y, label, tone = '') {
    if (x == null || y == null) return;
    const fx = document.createElement('div');
    fx.className = 'click-fx' + (tone ? ` ${tone}` : '');
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;
    if (label) fx.dataset.label = label;
    document.body.appendChild(fx);
    fx.addEventListener('animationend', () => fx.remove(), { once: true });
  }

  toast(msg, tone = '') {
    const t = this.dom.toast;
    t.className = 'toast show' + (tone ? ` ${tone}` : '');
    t.innerHTML = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  setPrompt(key, hint) {
    if (key != null) this.dom.promptKey.innerText = key;
    if (hint != null) this.dom.promptHint.innerText = hint;
  }

  // ---------- modes ----------
  enterFree() {
    this.cancelTimers();
    this.mode = 'free';
    this.run = null;
    document.body.classList.remove('mode-story', 'mode-menu');
    document.body.classList.add('mode-free');
    const ex = this.exercise;
    this.applyLoadout(ex, this.roundWeight(this.save.strength[ex] * 0.7));
    this.setPrompt('FREE TRAINING', '종목과 무게를 고르고 시작하세요');
  }

  enterMenu() {
    this.cancelTimers();
    this.mode = 'menu';
    this.run = null;
    this.closeModals(false);
    document.body.classList.remove('mode-story', 'mode-free');
    document.body.classList.add('mode-menu');
    this.resetExercise();
  }

  startStage(stage) {
    this.cancelTimers();
    this.mode = 'story';
    this.run = { stage, liftIdx: 0, attemptsLeft: stage.attempts, failures: 0, itemsUsed: 0 };
    document.body.classList.remove('mode-free', 'mode-menu');
    document.body.classList.add('mode-story');
    this.loadLift();
  }

  loadLift() {
    const lift = this.run.stage.lifts[this.run.liftIdx];
    this.applyLoadout(lift.exercise, lift.weight, lift.reps);
    const n = this.run.stage.lifts.length;
    if (n > 1) this.setPrompt(`LIFT ${this.run.liftIdx + 1}/${n}: ${EXERCISE_NAMES[lift.exercise]}`, null);
  }

  roundWeight(w) {
    return Math.max(20, Math.round(w / 5) * 5);
  }

  applyLoadout(mode, weight, reps = 1) {
    this.exercise = mode;
    this.scene3d.setExercise(mode);
    [this.dom.tabBench, this.dom.tabSquat, this.dom.tabDeadlift].forEach(t => t.classList.remove('active'));
    ({ bench: this.dom.tabBench, squat: this.dom.tabSquat, deadlift: this.dom.tabDeadlift })[mode].classList.add('active');
    document.body.classList.remove('ex-bench', 'ex-squat', 'ex-deadlift');
    document.body.classList.add(`ex-${mode}`);

    this.weight = weight;
    this.set = { reps, repDone: 0 };
    this.resetExercise();
    this.updateHUD();
  }

  switchExercise(mode) {
    if (this.state !== 'IDLE' || this.tutorial.active || this.mode !== 'free') return;
    this.applyLoadout(mode, this.roundWeight(this.save.strength[mode] * 0.7));
  }

  changeWeight(delta) {
    if (this.state !== 'IDLE' || this.tutorial.active || this.mode !== 'free') return;
    this.weight = Math.max(20, Math.min(400, this.weight + delta));
    this.scene3d.updatePlates(this.weight);
    sound.playBarbellClank(this.weight, 0.4);
    this.updateHUD();
  }

  // Full reset: new attempt (stamina full, belt off)
  resetExercise() {
    this.cancelTimers(); // a stale "reset after success" timer must not interrupt the next attempt
    this.resetBar();
    this.stamina = 1;
    this.buffs.belt = false;
    this.set.repDone = 0;
    this.updateGearHUD();
    this.setPrompt(this.mech.idle.key, this.mech.idle.hint);
  }

  // Bar back to start position; keeps stamina/pump/belt (between reps)
  resetBar() {
    this.state = 'IDLE';
    this.prog = this.exercise === 'deadlift' ? 0 : 1;
    this.vel = 0;
    this.tilt = 0;
    this.tiltVel = 0;
    this.stickCount = 0;
    this.stickDone = false;
    this.heartbeatTimer = 0;
    this.bottomTimer = 0;
    this.gust.warn = 0;
    this.pg = { pos: 0, dir: 1, center: 0.5, hw: 0.2, pw: 0.07, jam: 0, wait: 0, inZone: false, sticking: false };
    this.sq = { bottomT: 0, tension: 0, overload: 0, grind: 0 };
    this.dl = { tokens: 3, slip: null, slipTimer: 0 };
    this.wheelAccum = 0;
    this.dom.gustWarn.className = 'gust-warn';
    this.dom.vignette.classList.remove('active');
    this.dom.balanceBubble.style.left = '50%';
    this.dom.balanceBubble.classList.remove('danger');
    this.dom.gripAlert.className = 'grip-alert';
    document.body.classList.remove('gauge-on');
    this.updateTension(0, false);
    this.scene3d.updatePlates(this.weight);
    this.updateDepthHUD();
    this.dom.btnLift.innerText = this.exercise === 'squat' ? 'HOLD TO START' : 'LIFT START (CLICK)';
  }

  // ---------- items ----------
  useItem(k) {
    if (this.mode === 'menu' || this.isModalOpen()) return;
    if (this.state === 'LOCKED_OUT' || this.state === 'PINNED') return;
    const item = ITEMS[k];
    if (this.mods().noItems) { this.toast('🚫 이 스테이지는 장비 사용 금지!', 'bad'); return; }
    if (k === 'ammonia' && this.buffs.ammonia > 0) { this.toast('⚡ 암모니아 효과가 이미 진행 중'); return; }
    if (k === 'belt' && this.buffs.belt) { this.toast('🥋 이미 벨트를 차고 있습니다'); return; }
    if (!this.flags.freeItems && !this.save.useItem(k)) {
      this.toast(`${item.icon} ${item.name} 재고가 없습니다`, 'bad');
      return;
    }
    if (this.run) this.run.itemsUsed++;

    if (k === 'ammonia') {
      sound.playAmmoniaRush();
      this.buffs.ammonia = item.duration;
      this.shake(0.15);
      this.toast('⚡ 암모니아! 6초간 파워업', 'hot');
    } else if (k === 'belt') {
      sound.playChalkSlap();
      this.buffs.belt = true;
      this.toast('🥋 벨트 착용: 이번 세트 흔들림·그립 슬립 감소');
    } else if (k === 'booster') {
      sound.playAmmoniaRush();
      this.stamina = 1;
      this.pump = 1;
      this.buffs.pumpLock = item.pumpLock;
      this.toast('🥤 부스터! 스태미나·펌핑 최대', 'hot');
    }
    this.updateGearHUD();
    this.tutorial.onEvent('gear', k);
  }

  updateGearHUD() {
    Object.keys(this.dom.gear).forEach(k => {
      const n = this.save.items[k] || 0;
      const active = (k === 'ammonia' && this.buffs.ammonia > 0) ||
                     (k === 'belt' && this.buffs.belt) ||
                     (k === 'booster' && this.buffs.pumpLock > 0);
      this.dom.gear[k].classList.toggle('active', active);
      const banned = !!this.mods().noItems;
      this.dom.gear[k].classList.toggle('empty', (!this.flags.freeItems && n <= 0) || banned);
      this.dom.gearCount[k].textContent = this.flags.freeItems ? '∞' : `×${n}`;
    });
    this.scene3d.setBeltVisible(this.buffs.belt);
  }

  // ---------- rep flow ----------
  startRep() {
    sound.init();
    sound.startBGM();
    sound.playChalkSlap();
    this.scene3d.triggerChalkBurst();

    this.weakSide = Math.random() < 0.5 ? -1 : 1;
    this.driftWave = Math.random() * Math.PI * 2;
    this.stickCount = 0;
    this.stickDone = false;
    this.scheduleGust(true);
    this.repTime = 0;
    this.mech.start(this);
    this.dom.btnLift.innerText = 'LIFTING...';
    this.tutorial.onEvent('liftStart');
  }

  scheduleGust(first = false) {
    const mul = Math.max(0.3, this.mods().gust || 1);
    const gap = B.gustMinGap + Math.random() * (B.gustMaxGap - B.gustMinGap);
    this.gust.timer = (first ? gap * 0.7 : gap) / mul;
    this.gust.warn = 0;
  }

  onRepSuccess() {
    this.state = 'LOCKED_OUT';
    this.dom.vignette.classList.remove('active');
    this.dom.gripAlert.className = 'grip-alert';
    document.body.classList.remove('gauge-on');
    sound.playLockoutBoom();
    this.shake(0.3);
    this.scene3d.triggerChalkBurst();
    this.pump = Math.min(1, this.pump + 0.1);

    if (this.tutorial.active) {
      sound.playPRCelebration();
      this.setPrompt('GOOD REP! 💪', '완벽한 반복!');
      this.tutorial.onEvent('lockout');
      return;
    }

    this.set.repDone++;
    this.updateBanner();
    const newPR = this.weight > this.pr[this.exercise];
    if (newPR) {
      this.pr[this.exercise] = this.weight;
      store.set(`pr_${this.exercise}`, String(this.weight));
      this.updateHUD();
    }

    if (this.set.repDone < this.set.reps) {
      this.stamina = Math.min(1, this.stamina + T.restRecover);
      this.setPrompt(`REP ${this.set.repDone}/${this.set.reps} ✓`, '숨 고르고...');
      sound.playBarbellClank(this.weight, 0.5);
      this.later(() => {
        this.resetBar();
        this.setPrompt(`REP ${this.set.repDone + 1}/${this.set.reps}`, `${this.mech.idle.hint} (스태미나는 이어집니다)`);
      }, 900);
      return;
    }

    sound.playPRCelebration();
    if (this.mode === 'free') {
      if (newPR) this.showPRModal(this.weight);
      else {
        this.setPrompt('SUCCESSFUL REP!', '득근 성공!');
        this.later(() => this.resetExercise(), 1600);
      }
      return;
    }

    if (newPR) this.toast(`🏆 NEW PR! ${EXERCISE_NAMES[this.exercise]} ${this.weight}kg`, 'hot');
    this.buffs.belt = false;
    this.run.liftIdx++;
    if (this.run.liftIdx < this.run.stage.lifts.length) {
      this.setPrompt('SET CLEAR! ✅', '다음 종목 준비...');
      this.later(() => this.loadLift(), 1600);
    } else {
      this.setPrompt('STAGE CLEAR!! 🏆', '');
      this.later(() => this.storyUI.onStageClear(this.run), 1400);
    }
  }

  failReason(reason) {
    return {
      balance: '좌우 균형을 잃고 바벨이 기울어졌습니다!',
      sticking: '한계 지점에서 스태미나가 바닥났습니다!',
      depth: '깊이가 부족합니다! (NO REP) DEPTH 초록 구간까지 앉은 뒤 떼세요.',
      grip: '그립을 놓쳐 바벨을 떨어뜨렸습니다!',
      floor: '바벨을 바닥에서 떼지 못했습니다!',
      timeout: '시간 초과! 10초 안에 끝까지 들어 올리지 못했습니다.',
      stamina: '바벨 무게를 이기지 못하고 깔렸습니다!'
    }[reason] || '바벨 무게를 이기지 못하고 깔렸습니다!';
  }

  onFail(reason = 'stamina') {
    this.state = 'PINNED';
    this.dom.vignette.classList.remove('active');
    this.dom.gripAlert.className = 'grip-alert';
    document.body.classList.remove('gauge-on');
    this.gust.warn = 0;
    this.dom.gustWarn.className = 'gust-warn';
    sound.playFailure();
    sound.playBarbellClank(this.weight, 1.2);
    this.shake(0.4);

    if (this.tutorial.active) {
      this.tutorial.onEvent('fail', reason);
      return;
    }

    const why = this.failReason(reason);
    if (this.mode === 'story') {
      this.run.failures++;
      this.run.attemptsLeft--;
      this.updateBanner();
      if (this.run.attemptsLeft > 0) {
        this.setPrompt(reason === 'depth' ? 'NO REP!! ❌' : 'PINNED!! 😵', `${why} 남은 기회 ${this.run.attemptsLeft}번`);
        this.toast(`😵 실패! 남은 기회 ${'♥'.repeat(this.run.attemptsLeft)}`, 'bad');
        this.later(() => this.loadLift(), 1900);
      } else {
        this.setPrompt('FAILED...', why);
        this.later(() => this.storyUI.onStageFail(this.run, why, reason), 1500);
      }
      return;
    }

    this.showFailModal(why, reason);
  }

  showPRModal(weight) {
    const total = this.pr.bench + this.pr.squat + this.pr.deadlift;
    this.dom.prTitle.innerText = `NEW PR: ${weight}KG!`;
    let quote = '괴물 같은 스트렝스! 점진적 과부하 달성!';
    if (total >= 500) quote = '🎉 3대 500 돌파! 언더아머 단속반 무사 통과! 🎉';
    this.dom.prDesc.innerText = quote;
    this.dom.prPortrait.innerHTML = portrait('me', 'happy', { build: this.currentBuild() });
    this.dom.prModal.classList.add('show');
  }

  showFailModal(desc, reason) {
    this.dom.failTitle.innerText = reason === 'depth' ? 'NO REP (깊이 부족)' : 'PINNED (깔림!)';
    this.dom.failDesc.innerText = `${desc}\n🚨 관장님 긴급 출동! 근손실 -200g 🚨`;
    this.dom.failPortrait.innerHTML = portrait('boss', 'angry');
    this.dom.failModal.classList.add('show');
  }

  closeModals(reset = true) {
    this.dom.prModal.classList.remove('show');
    this.dom.failModal.classList.remove('show');
    if (reset) this.resetExercise();
  }

  // ---------- HUD ----------
  updateHUD() {
    const total = this.pr.bench + this.pr.squat + this.pr.deadlift;
    this.dom.totalVal.innerHTML = `${total} <small>/ 500kg</small>`;
    this.dom.progressFill.style.width = `${Math.min(100, (total / 500) * 100)}%`;
    this.dom.weightVal.innerText = this.weight;

    const cap = Math.round(this.capacity());
    const pct = Math.round(this.ratio() * 100);
    const cls = pct > 100 ? 'over' : pct >= 90 ? 'max' : pct >= 78 ? 'heavy' : 'ok';
    this.dom.ratioVal.className = `ratio-val ${cls}`;
    this.dom.ratioVal.textContent = this.flags.ratio ? `강도 ${pct}%` : `1RM ${cap}kg · ${pct}%${pct > 100 ? ' 한계 초과' : ''}`;

    this.updateGearHUD();
    this.updateBanner();
  }

  updateBanner() {
    if (!this.run) return;
    const s = this.run.stage;
    const lift = s.lifts[Math.min(this.run.liftIdx, s.lifts.length - 1)];
    this.dom.sbTitle.textContent = `${s.id}  ${s.title}`;
    this.dom.sbLift.textContent = `${EXERCISE_NAMES[lift.exercise]} ${lift.weight}kg` +
      (s.lifts.length > 1 ? ` (${this.run.liftIdx + 1}/${s.lifts.length})` : '');
    this.dom.sbReps.innerHTML = Array.from({ length: this.set.reps }, (_, i) =>
      `<span class="rep-dot${i < this.set.repDone ? ' done' : ''}"></span>`).join('');
    const left = Math.max(0, this.run.attemptsLeft);
    this.dom.sbAttempts.textContent = '♥'.repeat(left) + '♡'.repeat(Math.max(0, s.attempts - left));
  }

  updateDepthHUD() {
    this.dom.depthIndicator.style.top = `${(1 - Math.max(0, Math.min(1, this.prog))) * 100}%`;
    const zone = (topFrac, h) => {
      this.dom.depthTargetZone.style.top = `${topFrac * 100}%`;
      this.dom.depthTargetZone.style.height = `${h * 100}%`;
    };
    if (this.exercise === 'deadlift') zone(0, 0.06);
    else if (this.exercise === 'squat') zone(1 - T.squat.depthZone, T.squat.depthZone);
    else zone(1 - T.bench.perfectZone, T.bench.perfectZone);
  }

  updateGauge() {
    const pg = this.pg;
    this.dom.gaugeZone.style.left = `${(pg.center - pg.hw) * 100}%`;
    this.dom.gaugeZone.style.width = `${pg.hw * 200}%`;
    this.dom.gaugePerfect.style.left = `${(pg.center - pg.pw) * 100}%`;
    this.dom.gaugePerfect.style.width = `${pg.pw * 200}%`;
    this.dom.gaugeNeedle.style.left = `${pg.pos * 100}%`;
    this.dom.gauge.classList.toggle('jam', pg.jam > 0);
    this.dom.gauge.classList.toggle('wait', pg.wait > 0);
    this.dom.gauge.classList.toggle('hot', pg.inZone);
    document.body.classList.add('gauge-on');
  }

  flashGauge(label) {
    const el = this.dom.gaugeLabel;
    el.textContent = label;
    el.className = `pg-label show ${label.toLowerCase()}`;
    clearTimeout(this.gaugeFlashTimer);
    this.gaugeFlashTimer = setTimeout(() => { el.className = 'pg-label'; }, 300);
  }

  updateTension(t, overloaded) {
    this.dom.tensionFill.style.width = `${Math.min(1, t) * 100}%`;
    this.dom.tensionFill.classList.toggle('hot', t > 0.8 || overloaded);
  }

  showGripAlert(side) {
    this.dom.gripKey.textContent = side === 'L' ? 'A ◀' : '▶ D';
    this.dom.gripAlert.dataset.side = side === 'L' ? '왼손이 미끄러진다!' : '오른손이 미끄러진다!';
    this.dom.gripAlert.className = `grip-alert show ${side === 'L' ? 'left' : 'right'}`;
    this.dom.gripBar.style.width = '100%';
  }

  updateGripAlert(frac) {
    this.dom.gripBar.style.width = `${Math.max(0, frac) * 100}%`;
  }

  hideGripAlert(label) {
    this.dom.gripAlert.dataset.side = '';
    this.dom.gripAlert.className = `grip-alert result ${label === 'GRIP!' ? 'ok' : 'bad'}`;
    this.dom.gripKey.textContent = label;
    clearTimeout(this.gripTimer);
    this.gripTimer = setTimeout(() => {
      if (!this.dl.slip) this.dom.gripAlert.className = 'grip-alert';
    }, 350);
  }

  updateMeters(dt) {
    if (this.buffs.pumpLock > 0) {
      this.buffs.pumpLock -= dt;
      if (this.buffs.pumpLock <= 0) this.updateGearHUD();
    } else {
      this.pump = Math.max(T.pumpMin, this.pump - T.pumpDecayPerSec * dt);
    }

    if (Math.abs(this.pump - this.shownPump) > 0.003) {
      this.shownPump = this.pump;
      this.dom.pumpFill.style.height = `${this.pump * 100}%`;
      this.scene3d.setMusclePump(this.pump);
      sound.setPumpLevel(this.pump);
    }
    const st = Math.max(0, this.stamina);
    this.dom.staminaFill.style.width = `${st * 100}%`;
    this.dom.staminaFill.classList.toggle('low', st < 0.3);
  }

  // ---------- loop ----------
  tick(dt) {
    this.simTime += dt;
    if (this.buffs.ammonia > 0) {
      this.buffs.ammonia -= dt;
      if (this.buffs.ammonia <= 0) this.updateGearHUD();
    }

    const lifting = this.isLifting();
    if (lifting !== this._liftingClass) {
      this._liftingClass = lifting;
      document.body.classList.toggle('lifting', lifting);
    }

    if (lifting) this.updatePhysics(dt);
    this.updateMeters(dt);
    this.updateFaceCam();
  }

  gameLoop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;
    this.tick(dt);
    this.scene3d.render(dt, this.barY(), this.exercise === 'deadlift' ? 0 : this.tilt, this.weight, this.vel, this.prog);
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  updateBalance(dt, r) {
    const k = this.tiltScale();

    this.driftWave += (1.3 + r * 1.2) * dt;
    this.tiltVel += Math.sin(this.driftWave) * (B.driftBase + B.driftR * r) * k * dt;

    const over = Math.abs(this.tilt) - B.runawayStart;
    if (over > 0) this.tiltVel += Math.sign(this.tilt) * over * (B.runBase + B.runR * r) * Math.min(1, k) * dt;

    if (this.flags.driftScale > 0) {
      if (this.gust.warn > 0) {
        this.gust.warn -= dt;
        if (this.gust.warn <= 0) {
          const g = (this.mods().gust || 1);
          this.tiltVel += this.gust.dir * (B.gustBase + B.gustR * r) * k * (0.7 + 0.3 * g);
          this.shake(0.1);
          this.dom.gustWarn.className = 'gust-warn';
          this.scheduleGust();
        }
      } else {
        this.gust.timer -= dt;
        if (this.gust.timer <= 0) {
          this.gust.dir = Math.random() < 0.5 ? -1 : 1;
          this.gust.warn = B.gustWarn;
          this.dom.gustWarn.className = `gust-warn show ${this.gust.dir > 0 ? 'right' : 'left'}`;
          this.dom.gustWarn.textContent = this.gust.dir > 0 ? '⚠ 오른쪽으로 쏠림! ▶' : '◀ 왼쪽으로 쏠림! ⚠';
          sound.playBarbellClank(this.weight, 0.25);
        }
      }
    }

    if (this.keys.left) this.tiltVel -= B.steer * dt;
    if (this.keys.right) this.tiltVel += B.steer * dt;

    this.tiltVel *= Math.pow(B.damping, dt);
    this.tilt += this.tiltVel * dt;
    if (this.buffs.belt) this.tilt *= (1 - 0.3 * dt);

    const pct = 50 + (this.tilt / B.maxTilt) * 50;
    this.dom.balanceBubble.style.left = `${Math.max(4, Math.min(96, pct))}%`;
    const danger = Math.abs(this.tilt) > B.dangerTilt;
    this.dom.balanceBubble.classList.toggle('danger', danger);
    if (danger) {
      this.dom.promptHint.innerText = this.tilt > 0
        ? '⚠️ 오른쪽 쏠림! [A] 또는 [◀]로 복구!'
        : '⚠️ 왼쪽 쏠림! [D] 또는 [▶]로 복구!';
    }
    return Math.abs(this.tilt) > B.maxTilt;
  }

  updatePhysics(dt) {
    const r = this.ratio();

    if (this.mech.usesBalance && this.updateBalance(dt, r)) { this.onFail('balance'); return; }

    // A rep can't grind forever
    this.repTime = (this.repTime || 0) + dt;
    if (this.repTime > T.repTimeLimit) { this.onFail('timeout'); return; }
    if (this.repTime > T.repTimeLimit - 3 && this.state === 'ASCENDING') this.dom.promptKey.innerText = `⏱ ${Math.ceil(T.repTimeLimit - this.repTime)}초!! 밀어!!`;

    this.stamina = Math.min(1, this.stamina + T.regenPerSec * dt);

    if (this.state === 'STICKING_POINT') {
      this.prog = T.stickAt + (Math.random() - 0.5) * 0.02;
      this.stamina -= T.stickDrainPerSec * this.flags.drainScale * dt;
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        sound.playHeartbeat(1.4 + (1 - Math.max(0, this.stamina)) * 0.4);
        this.heartbeatTimer = 0.35 + Math.max(0, this.stamina) * 0.35;
      }
      if (this.stamina <= 0) { this.stamina = 0; this.onFail('sticking'); return; }
    }

    this.mech.update(this, dt, r);
    if (this.isLifting()) this.updateDepthHUD();
  }
}

// Debug handle (tuning in devtools: __ironlift.TUNING.bench.gravity = 3)
window.__ironlift = { TUNING: T, BALANCE: B };

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => { window.__game = new IronLiftGame(); });
} else {
  window.__game = new IronLiftGame();
}
