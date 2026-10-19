// ---------------------------------------------------------------
// 종목별 조작 (mechanics)
//   bench    : 파워 게이지 타이밍 클릭
//   squat    : 홀드 & 릴리즈 + 복압 게이지
//   deadlift : 휠 당기기 + 그립 슬립 반응
//
// 각 종목은 같은 인터페이스를 가진다:
//   usesBalance                 좌우 수평(A/D) 사용 여부
//   idle                        { key, hint } 대기 상태 안내 문구
//   start(g)                    IDLE에서 첫 입력 → 리프팅 시작
//   press(g, x, y) / release(g) 마우스 버튼
//   wheel(g, notches)           휠 아래로 n칸
//   key(g, side)                'L' | 'R' 키 입력 (true 반환 시 소비됨)
//   update(g, dt, r)            매 프레임 (수직 물리 포함)
//   onStick(g, r)               한계 지점 진입 시 → 안내 문구 반환
// ---------------------------------------------------------------
import { TUNING as T, BALANCE as B, ITEMS } from './config.js';
import { sound } from './audio.js';

function stickMul(g) {
  return g.buffs.ammonia > 0 ? ITEMS.ammonia.stickMul : 1;
}

// ===============================================================
// BENCH — 파워 게이지 타이밍
//   바늘이 게이지를 왕복한다. 초록 구간에서 클릭 = 밀기, 가운데 노란 구간 = PERFECT.
//   맞출 때마다 구간 위치가 바뀌고, 빨간 구간 클릭(MISS)은 게이지가 잠깐 멈춘다(JAM).
// ===============================================================
export const Bench = {
  id: 'bench',
  usesBalance: true,
  idle: { key: 'CLICK TO UNRACK', hint: '클릭으로 시작 → 가슴에 닿는 순간 클릭 → 바늘이 초록 구간에 오면 클릭' },

  start(g) {
    g.state = 'DESCENDING';
    g.prog = 1;
    this.resetGauge(g);
    g.setPrompt('LOWER...', '가슴에 닿는 순간 클릭! (PERFECT 타이밍)');
  },

  resetGauge(g, sticking = false) {
    g.pg = { pos: 0.05, dir: 1, center: 0.5, hw: 0.2, pw: 0.07, jam: 0, wait: 0, inZone: false, sticking };
    this.newZone(g, g.ratio());
  },

  newZone(g, r) {
    const P = T.bench;
    const pg = g.pg;
    const mul = pg.sticking ? P.stickZoneMul : 1;
    pg.hw = Math.max(0.05, (P.zoneBase - P.zoneR * r) * mul);
    pg.pw = pg.hw * P.perfectFrac;
    // New target somewhere away from the needle so it has to travel to it
    let c;
    do { c = pg.hw + 0.02 + Math.random() * (1 - 2 * (pg.hw + 0.02)); } while (Math.abs(c - pg.pos) < 0.18);
    pg.center = c;
    pg.inZone = false;
    pg.wait = T.bench.zoneDelay; // new zone lights up after a short delay
  },

  press(g, x, y) {
    const P = T.bench;
    const r = g.ratio();
    if (g.state === 'DESCENDING') {
      if (g.prog <= P.perfectZone) {
        g.drive(P.perfectVel);
        g.fx(x, y, 'PERFECT!', 'perfect');
        g.setPrompt('PERFECT DRIVE!! 🔥', '이제 바늘이 초록 구간에 들어올 때 클릭!');
      } else if (g.prog <= P.goodZone) {
        g.drive(P.goodVel);
        g.fx(x, y, 'GOOD', 'strong');
        g.setPrompt('GOOD! 초록 구간에서 클릭!', '조금 일렀다. 가슴에 닿는 순간을 노려라');
      } else {
        g.fx(x, y, 'EARLY', 'weak');
      }
      return;
    }
    if (g.state !== 'ASCENDING' && g.state !== 'STICKING_POINT') return;

    const pg = g.pg;
    if (pg.jam > 0) { g.fx(x, y, 'JAM', 'weak'); return; }
    if (pg.wait > 0) return; // zone not lit yet: ignore without penalty

    const d = Math.abs(pg.pos - pg.center);
    let q, label, tone;
    if (d <= pg.pw) { q = 1; label = 'PERFECT'; tone = 'perfect'; }
    else if (d <= pg.hw) { q = P.goodMul; label = 'GOOD'; tone = 'strong'; }
    else { q = P.missMul; label = 'MISS'; tone = 'weak'; }
    const miss = q === P.missMul;

    g.spend(P.cost * (0.5 + r) * (miss ? P.missCostMul : 1));
    g.clickWobble(r, miss ? 2 : 1);
    g.flashGauge(label);
    if (miss) {
      pg.jam = P.jamTime;
      sound.playFailure();
    } else {
      sound.playGrunt();
      this.newZone(g, r);
    }

    if (g.state === 'ASCENDING') {
      if (!miss) {
        g.vel = Math.min(T.maxUpVel, g.vel + P.impulse * q * g.power());
        g.pumpUp();
      }
      g.shake(miss ? 0.02 : 0.05);
      g.fx(x, y, label, tone);
    } else {
      if (!miss) g.stickCount++;
      const need = this.stickNeed(g, r);
      g.shake(0.06);
      g.fx(x, y, miss ? 'MISS' : `${Math.min(g.stickCount, need)}/${need}`, tone);
      if (g.stickCount >= need) g.breakThrough();
    }
  },

  release() {},
  wheel() {},
  key() { return false; },

  stickNeed(g, r) {
    const P = T.bench;
    return Math.max(2, Math.round((P.stickBase + P.stickPerR * Math.max(0, r - T.stickRatio)) * stickMul(g)));
  },

  onStick(g, r) {
    this.resetGauge(g, true);
    return `🔥 구간이 좁아지고 바늘이 빨라진다! ${this.stickNeed(g, r)}번 맞춰라! 🔥`;
  },

  onBreak(g) {
    this.resetGauge(g, false);
  },

  update(g, dt, r) {
    const P = T.bench;
    if (g.state === 'DESCENDING') {
      g.prog -= (P.descBase + P.descR * r) * dt;
      if (g.prog <= P.perfectZone && g.prog > 0) g.dom.promptKey.innerText = 'NOW!! CLICK!! 🔥';
      if (g.prog <= 0) {
        g.prog = 0;
        g.stamina = Math.max(0, g.stamina - P.bouncePenalty);
        g.drive(P.bounceVel);
        g.setPrompt('NO DRIVE! 초록 구간에서 클릭!', '반동을 놓쳤다! 가슴에 닿는 순간 클릭해야 PERFECT');
      }
      return;
    }

    // Needle sweeps back and forth; faster when heavy and at the sticking point
    const pg = g.pg;
    pg.jam = Math.max(0, pg.jam - dt);
    pg.wait = Math.max(0, pg.wait - dt);
    if (pg.jam <= 0) {
      const speed = (P.needleBase + P.needleR * r) * (pg.sticking ? P.stickSpeedMul : 1);
      pg.pos += pg.dir * speed * dt;
      if (pg.pos >= 1) { pg.pos = 2 - pg.pos; pg.dir = -1; }
      if (pg.pos <= 0) { pg.pos = -pg.pos; pg.dir = 1; }
    }
    const inZone = pg.wait <= 0 && Math.abs(pg.pos - pg.center) <= pg.hw;
    if (inZone && !pg.inZone) sound.playTick(pg.sticking);
    pg.inZone = inZone;
    g.updateGauge();

    if (g.state === 'ASCENDING') {
      g.integrate(dt, P.gravity * r);
      g.checkAscent(r);
    }
  }
};

// ===============================================================
// SQUAT — 홀드 & 릴리즈
// ===============================================================
export const Squat = {
  id: 'squat',
  usesBalance: true,
  idle: { key: 'HOLD TO SQUAT', hint: '마우스를 누르고 있으면 앉는다 → 깊이 구간에서 떼기 → 다시 눌러 밀기' },

  start(g) {
    g.state = 'DESCENDING';
    g.prog = 1;
    g.sq = { bottomT: 0, tension: 0, overload: 0, grind: 0 };
    g.setPrompt('HOLD... 깊이 앉아라', '누른 채로! 왼쪽 DEPTH 초록 구간에서 떼세요');
  },

  press(g) {
    // holding flag is managed by the game; nothing else to do
  },

  release(g) {
    const P = T.squat;
    if (g.state !== 'DESCENDING') return;
    if (g.prog <= P.depthZone) {
      const perfect = g.prog <= P.perfectDepth;
      g.drive(perfect ? P.perfectVel : P.goodVel);
      g.fx(g.pointer.x, g.pointer.y, perfect ? 'DEEP!' : 'DEPTH OK', perfect ? 'perfect' : 'strong');
      g.setPrompt(perfect ? 'PERFECT DEPTH!! 🔥' : 'DEPTH OK!', '다시 눌러서 밀어라! 복압 게이지가 차면 잠깐 떼기');
    } else if (g.prog >= 0.92) {
      // Barely moved: cancel quietly
      g.resetBar();
      g.setPrompt('HOLD TO SQUAT', '누르고 있어야 앉습니다');
    } else {
      g.onFail('depth');
    }
  },

  wheel() {},
  key() { return false; },

  stickNeed(g, r) {
    const P = T.squat;
    return (P.stickHoldBase + P.stickHoldPerR * Math.max(0, r - T.stickRatio)) * stickMul(g);
  },

  onStick(g, r) {
    g.sq.grind = 0;
    return `🔥 버텨라! 누른 채로 ${this.stickNeed(g, r).toFixed(1)}초, 복압이 터지면 밀린다! 🔥`;
  },

  update(g, dt, r) {
    const P = T.squat;
    const s = g.sq;

    if (g.state === 'DESCENDING') {
      if (!g.holding) return;
      g.prog -= P.descSpeed * dt;
      if (g.prog <= P.depthZone && g.prog > 0) g.dom.promptKey.innerText = 'RELEASE!! 떼라!';
      if (g.prog <= 0) {
        g.prog = 0;
        s.bottomT += dt;
        g.stamina = Math.max(0, g.stamina - 0.3 * dt);
        if (s.bottomT > P.bottomHoldMax) {
          g.drive(P.bounceVel);
          g.setPrompt('늦었다! 밀어!!', '바닥에서 너무 오래 버텼다. 깊이 구간에서 떼야 반동이 붙는다');
        }
      }
      return;
    }

    s.overload = Math.max(0, s.overload - dt);
    const pushing = g.holding && s.overload <= 0;
    const tMul = g.state === 'STICKING_POINT' ? P.stickTensionMul : 1;

    if (pushing) {
      s.tension += P.tensionRise * (0.5 + r) * tMul * dt;
      g.spend(P.holdCost * (0.5 + r) * dt);
      g.tiltVel += g.weakSide * B.holdBias * r * g.tiltScale() * dt;
      g.pump = Math.min(1, g.pump + T.pumpPerAction * 6 * dt);
      if (g.state === 'ASCENDING') g.vel = Math.min(T.maxUpVel, g.vel + P.force * g.power() * dt);
      else s.grind += dt;
    } else {
      s.tension = Math.max(0, s.tension - P.tensionDecay * dt);
    }

    if (s.tension >= 1) {
      s.tension = 0.65;
      s.overload = P.overloadTime;
      g.stamina = Math.max(0, g.stamina - P.overloadPenalty);
      g.shake(0.15);
      sound.playFailure();
      g.fx(g.pointer.x, g.pointer.y, '숨 터짐!', 'weak');
      if (g.state === 'STICKING_POINT') s.grind = Math.max(0, s.grind - 0.35 * this.stickNeed(g, r));
      g.setPrompt('💨 숨 터짐!!', '복압 게이지가 꽉 차기 전에 잠깐 떼서 숨을 골라라');
    }
    g.updateTension(s.tension, s.overload > 0);

    if (g.state === 'ASCENDING') {
      g.integrate(dt, P.gravity * r);
      g.checkAscent(r);
    } else if (g.state === 'STICKING_POINT') {
      const need = this.stickNeed(g, r);
      const pct = Math.min(100, Math.round((s.grind / need) * 100));
      g.dom.promptKey.innerText = `⚡ GRIND ${pct}% ⚡`;
      if (s.grind >= need) g.breakThrough();
    }
  }
};

// ===============================================================
// DEADLIFT — 휠 당기기 + 그립
// ===============================================================
export const Deadlift = {
  id: 'deadlift',
  usesBalance: false,
  idle: { key: 'CLICK TO GRIP', hint: '클릭으로 바 잡기 → 마우스 휠을 아래로 굴려 당기기 → 손이 미끄러지면 표시된 키!' },

  start(g) {
    const P = T.deadlift;
    g.state = 'ASCENDING';
    g.prog = 0;
    g.vel = P.startVel;
    g.dl = { tokens: 3, slip: null, slipTimer: 0 };
    this.scheduleSlip(g, true);
    g.setPrompt('PULL!! 휠을 아래로! 🔥', '마우스 휠을 아래로 계속 굴려라');
    sound.playBarbellClank(g.weight, 0.6);
  },

  scheduleSlip(g, first = false) {
    const P = T.deadlift;
    const mul = Math.max(0.3, g.mods().gust || 1) * (g.buffs.belt ? ITEMS.belt.tiltMul : 1);
    const gap = P.slipMinGap + Math.random() * (P.slipMaxGap - P.slipMinGap);
    g.dl.slipTimer = (first ? gap * 0.8 : gap) / mul;
  },

  press(g, x, y) {
    if (g.state === 'ASCENDING' || g.state === 'STICKING_POINT') g.fx(x, y, '휠!', 'weak');
  },

  release() {},

  wheel(g, notches) {
    const P = T.deadlift;
    if (g.state !== 'ASCENDING' && g.state !== 'STICKING_POINT') return;
    const r = g.ratio();
    let n = Math.min(notches, Math.floor(g.dl.tokens));
    if (n <= 0) return;
    g.dl.tokens -= n;
    for (let i = 0; i < n; i++) {
      g.spend(P.cost * (0.5 + r));
      if (g.state === 'ASCENDING') {
        g.vel = Math.min(T.maxUpVel, g.vel + P.impulse * g.power());
        g.pumpUp();
      } else {
        g.stickCount++;
      }
    }
    g.shake(0.02);
    if (g.state === 'STICKING_POINT') {
      const need = this.stickNeed(g, r);
      g.dom.promptKey.innerText = `⚡ 무릎 통과 ${Math.min(g.stickCount, need)}/${need} ⚡`;
      if (g.stickCount >= need) g.breakThrough();
    } else if (Math.random() < 0.25) {
      sound.playGrunt();
    }
  },

  key(g, side) {
    const slip = g.dl && g.dl.slip;
    if (!slip) return false;
    if (side === slip.side) {
      g.dl.slip = null;
      g.hideGripAlert('GRIP!');
      g.fx(g.pointer.x, g.pointer.y, 'GRIP!', 'strong');
      sound.playChalkSlap();
      this.scheduleSlip(g);
    } else {
      this.applySlip(g);
    }
    return true;
  },

  applySlip(g) {
    const P = T.deadlift;
    g.dl.slip = null;
    g.vel = Math.min(g.vel, 0) - P.slipVel;
    g.stamina = Math.max(0, g.stamina - P.slipPenalty);
    g.lastSlipAt = g.simTime;
    g.shake(0.25);
    sound.playBarbellClank(g.weight, 0.9);
    g.hideGripAlert('SLIP!');
    g.setPrompt('미끄러졌다!! 다시 당겨!', '그립 경고가 뜨면 표시된 키를 바로 누르세요');
    this.scheduleSlip(g);
  },

  stickNeed(g, r) {
    const P = T.deadlift;
    return Math.max(3, Math.round((P.stickBase + P.stickPerR * Math.max(0, r - T.stickRatio)) * stickMul(g)));
  },

  onStick(g, r) {
    return `🔥 무릎 통과! 휠 ${this.stickNeed(g, r)}칸 폭풍 회전! 🔥`;
  },

  update(g, dt, r) {
    const P = T.deadlift;
    const d = g.dl;
    d.tokens = Math.min(3, d.tokens + P.maxNotchPerSec * dt);

    // Grip slips (disabled when the tutorial turns drift off)
    if (g.flags.driftScale > 0) {
      if (d.slip) {
        d.slip.t -= dt;
        g.updateGripAlert(d.slip.t / d.slip.total);
        if (d.slip.t <= 0) this.applySlip(g);
      } else {
        d.slipTimer -= dt;
        if (d.slipTimer <= 0) {
          const total = Math.max(0.35, P.slipWindowBase - P.slipWindowR * r);
          d.slip = { side: Math.random() < 0.5 ? 'L' : 'R', t: total, total };
          g.showGripAlert(d.slip.side);
          sound.playTick(true);
        }
      }
    }

    if (g.state === 'ASCENDING') {
      g.integrate(dt, P.gravity * r);
      g.checkAscent(r);
    }
  }
};

export const MECHANICS = { bench: Bench, squat: Squat, deadlift: Deadlift };
