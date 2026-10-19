// ---------------------------------------------------------------
// 난이도/손맛 조절값. 바벨 위치는 0(바닥/가슴) ~ 1(락아웃) 진행도 단위.
// 기준 비율 r = 바벨 무게 / 현재 1RM(근력)
//
// 종목별 조작
//   벤치   : 파워 게이지. 왕복하는 바늘이 초록 구간에 올 때 클릭 (노란 구간 = PERFECT). 빨간 구간 = MISS + 게이지 멈춤. 좌우 균형 없음
//   스쿼트 : 홀드. 누르고 있으면 앉기 → 깊이 구간에서 떼기 → 다시 눌러 밀기. 복압 게이지 관리
//   데드   : 휠. 마우스 휠을 아래로 굴려 당기기. 그립 슬립 때 표시된 키(A/D) 즉시 입력
//
// 측정 결과 (봇 3단계: 초보/보통/고수, 장비 없음)
//   r 0.65 × 3회 : 초보도 성공
//   r 0.80 × 1회 : 보통 성공, 초보는 대부분 실패
//   r 0.88 × 1회 : 고수만 성공
//   r 0.95+      : 장비 없이는 고수도 실패
//   r 1.04~1.08  : 암모니아+부스터를 써야 고수 성공
//   벤치 무작정 연타(초당 9회) : 실패
// 시뮬레이션으로 맞춘 값이니 바꿀 땐 조금씩.
// ---------------------------------------------------------------
export const TUNING = {
  // 공통 수직 물리
  velKeepPerSec: 0.06,      // 1초 뒤 남는 속도 비율
  maxUpVel: 2.8,
  // 바가 바닥 근처(진행도 8% 아래)에 머문 누적 시간. 넘으면 실패
  //   바닥 위에서 오르내려도 누적되고, 위로 올라가면 절반 속도로 줄어든다
  bottomZone: 0.08,
  repTimeLimit: 10,         // 한 번 들어 올리는 데 쓸 수 있는 최대 시간(초)
  bottomFailTime: { bench: 1.4, squat: 1.2, deadlift: 2.4 },

  // 공통 스태미나
  regenPerSec: 0.06,        // 리프팅 중 자연 회복
  restRecover: 0.40,        // 반복 사이 휴식 회복량
  powerFloor: 0.25,         // 스태미나 0일 때 힘 비율

  // 공통 한계 지점
  stickRatio: 0.80,         // r 이상이면 발생
  stickAt: 0.35,            // 진행도 35% 지점
  stickDrainPerSec: 0.16,
  breakVel: 1.05,

  // 펌핑
  pumpPower: 0.15,          // 펌핑 100%면 힘 +15%
  pumpPerAction: 0.008,
  pumpDecayPerSec: 0.02,
  pumpMin: 0.2,

  bench: {
    gravity: 5.8,           // × r
    descBase: 0.8, descR: 0.25,
    perfectZone: 0.15,      // 가슴 터치 PERFECT 구간
    goodZone: 0.30,
    perfectVel: 1.15, goodVel: 0.75, bounceVel: 0.2, bouncePenalty: 0.08,
    needleBase: 0.6,        // 바늘 속도 (게이지 한쪽 끝→끝, 초당) = base + R × r
    needleR: 0.6,
    zoneBase: 0.24,         // 초록 구간 반폭 = base - R × r
    zoneR: 0.08,
    perfectFrac: 0.35,      // 노란(PERFECT) 구간 = 초록 반폭 × 이 값
    jamTime: 0.4,           // MISS 후 게이지 멈춤(초)
    zoneDelay: 0.25,        // 맞힌 뒤 다음 구간이 켜지기까지(초)
    zoneSpread: 0.12,       // 다음 구간은 바늘 진행 방향 앞쪽, 이만큼 범위 안에서 랜덤
    driveTime: 0.3,         // 한 번 민 힘이 들어가는 시간(초)
    stickZoneMul: 0.85,     // 한계 지점: 구간 × 0.85
    stickSpeedMul: 1.0,     //            바늘 속도 그대로
    impulse: 5.4,           // PERFECT 1회 힘 (driveTime 동안 나눠서 들어감)
    goodMul: 0.5,
    missMul: 0.1,
    cost: 0.035,            // × (0.5 + r)
    missCostMul: 1.6,
    stickBase: 2, stickPerR: 8    // 한계 지점 필요 히트 수
  },

  squat: {
    gravity: 3.2,
    descSpeed: 0.9,         // 누르고 있을 때 하강 속도
    depthZone: 0.12,        // 이 아래에서 떼야 인정 (깊이)
    perfectDepth: 0.05,
    perfectVel: 1.1, goodVel: 0.75, bounceVel: 0.2,
    bottomHoldMax: 0.45,    // 바닥에서 버틸 수 있는 시간
    force: 6.5,             // 누르고 있을 때 초당 상승 가속
    tensionRise: 0.47,      // × (0.5 + r) 초당 복압 상승
    tensionDecay: 2.8,      // 뗐을 때 초당 감소
    overloadTime: 0.6,      // 복압 터지면 강제로 못 미는 시간
    overloadPenalty: 0.08,
    holdCost: 0.15,         // × (0.5 + r) 초당 스태미나
    stickHoldBase: 0.5, stickHoldPerR: 2.5,  // 한계 지점 버티기 필요 시간(초)
    stickTensionMul: 1.6
  },

  deadlift: {
    gravity: 3.3,
    startVel: 0.3,
    impulse: 0.5,           // 휠 1칸
    maxNotchPerSec: 15,     // 이보다 빠른 휠 입력은 무시
    cost: 0.02,             // × (0.5 + r) 휠 1칸
    stickBase: 6, stickPerR: 18,   // 무릎 통과 필요 휠 칸 수
    slipMinGap: 1.0, slipMaxGap: 2.2,
    slipWindowBase: 0.8, slipWindowR: 0.3,  // 그립 반응 시간 = base - R × r
    slipVel: 0.9,           // 놓치면 아래로 미끄러지는 속도
    slipPenalty: 0.08
  },

  minClickMs: 50            // 클릭 연타 상한 (오토클릭 방지)
};

export const BALANCE = {
  maxTilt: 0.30,            // 이 각도(rad) 넘으면 실패 (~17도)
  dangerTilt: 0.16,
  driftBase: 0.22, driftR: 0.30,      // 사인파 흔들림
  runawayStart: 0.035, runBase: 1.4, runR: 2.2,  // 기울수록 더 기움
  steer: 2.8,                          // A/D 조작 힘
  damping: 0.04,                       // 1초 뒤 남는 회전 속도
  clickBias: 0.06,                     // 벤치: 클릭마다 약한 팔 쪽 쏠림 (× r)
  clickRand: 0.06,
  holdBias: 0.35,                      // 스쿼트: 누르는 동안 초당 쏠림 (× r)
  gustMinGap: 1.4, gustMaxGap: 3.0,    // 돌풍 간격(초)
  gustWarn: 0.45,                      // 돌풍 예고 시간
  gustBase: 0.25, gustR: 0.35          // 돌풍 세기
};

export const ITEMS = {
  ammonia: {
    name: '암모니아', icon: '⚡', key: '1',
    desc: '6초간 힘 +15%, 한계 지점 부담 40% 감소',
    duration: 6, power: 1.15, stickMul: 0.6
  },
  belt: {
    name: '인저벨트', icon: '🥋', key: '2',
    desc: '이번 세트 동안 흔들림·그립 슬립 60% 감소, 힘 +5%',
    tiltMul: 0.4, power: 1.05
  },
  booster: {
    name: '부스터', icon: '🥤', key: '3',
    desc: '스태미나 100% 회복, 펌핑 100% (15초간 유지)',
    pumpLock: 15
  }
};

export const EXERCISE_NAMES = { bench: '벤치프레스', squat: '스쿼트', deadlift: '데드리프트' };
