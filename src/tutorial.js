import { portrait } from './portraits.js';

// ---------------------------------------------------------------
// Interactive Training Tutorial (관장님 코칭 모드)
// 실제 게임 위에서 단계별 행동을 시키고, 해내면 다음 단계로 넘어간다.
//
// Step fields
//   title / text   : 코치 카드 내용 (text는 HTML 허용)
//   button         : 있으면 버튼을 눌러야 진행 (그동안 클릭 연타 입력 차단)
//   waitFor        : 'liftStart' | 'lockout' | 'gearAll' — 이 이벤트가 오면 진행
//   loadout        : [종목, 무게] — 단계 시작 시 세팅
//   flags          : 물리 보정 (driftScale, sticking, drainScale)
//   retry          : 실패 시 돌아갈 단계 id
//   highlight      : 반짝일 HUD 요소 selector
//   blockPush      : true면 화면 입력으로 리프팅 시작 안 됨
// ---------------------------------------------------------------

const BASE_FLAGS = { driftScale: 0, sticking: 'off', drainScale: 1, ratio: 0.5, freeItems: false };

const STEPS = [
  {
    id: 'intro',
    title: '🏋️ 관장님의 기본기 트레이닝',
    text: '어서 와라! 3대 운동은 <b>조작이 전부 다르다</b>. 하나씩 몸에 익혀라.<br>' +
          '<b>왼손은 키보드(A/D)</b>, <b>오른손은 마우스</b>.',
    button: '시작하기 💪',
    loadout: ['bench', 40]
  },
  {
    id: 'bench',
    num: 1,
    title: '벤치프레스: 파워 게이지',
    text: '클릭으로 시작 → 바가 <b>가슴에 닿는 순간 클릭</b>(PERFECT 반동).<br>' +
          '그다음 화면 가운데 게이지를 왕복하는 <b>바늘이 초록 구간에 오면 클릭</b>! 노란 칸이면 PERFECT, 빨간 칸은 MISS다.',
    waitFor: 'lockout',
    loadout: ['bench', 40],
    retry: 'bench',
    highlight: '.center-meters'
  },
  {
    id: 'squat',
    num: 2,
    title: '스쿼트: 누르기 · 떼기',
    text: '마우스를 <b>꾹 누르고 있으면 앉는다</b>. DEPTH 초록 구간까지 내려가서 <b>떼면</b> 반동!<br>' +
          '다시 <b>꾹 누르면 밀어 올린다</b>. BRACE 게이지가 꽉 차기 전에 <b>살짝 떼서 숨 쉬기</b>.',
    waitFor: 'lockout',
    loadout: ['squat', 50],
    flags: { driftScale: 0, ratio: 0.55 },
    retry: 'squat',
    highlight: '.depth-gauge-container'
  },
  {
    id: 'balance',
    num: 3,
    title: '좌우 균형',
    text: '스쿼트는 누르고 있을수록 <b>약한 다리 쪽으로 쏠린다</b>. 수평계에 ⚠ 예고가 뜨면 곧 <b>돌풍</b>!<br>' +
          '<kbd>A</kbd>/<kbd>D</kbd> (또는 <kbd>◀</kbd>/<kbd>▶</kbd>)로 초록 막대를 가운데에. (벤치는 균형 신경 안 써도 된다)',
    waitFor: 'lockout',
    loadout: ['squat', 55],
    flags: { driftScale: 1, ratio: 0.6 },
    retry: 'balance',
    highlight: '.balance-bubble-wrap'
  },
  {
    id: 'deadlift',
    num: 4,
    title: '데드리프트: 휠 + 그립',
    text: '클릭으로 바를 잡고, <b>마우스 휠을 아래로 계속 굴려서</b> 당긴다.<br>' +
          '"손이 미끄러진다!" 경고와 함께 <kbd>A</kbd> 또는 <kbd>D</kbd>가 뜨면 <b>바로 그 키</b>를 눌러라.',
    waitFor: 'lockout',
    loadout: ['deadlift', 60],
    flags: { driftScale: 1, ratio: 0.6 },
    retry: 'deadlift',
    highlight: '.stamina-wrap'
  },
  {
    id: 'sticking',
    num: 5,
    title: '스태미나와 한계 지점',
    text: '1RM의 80% 이상이면 바벨이 중간에 <b>멈춘다</b>. 그동안 스태미나가 계속 빠진다.<br>' +
          '벤치는 <b>좁아진 초록 구간</b>을 N번, 스쿼트는 <b>누른 채 버티기</b>, 데드는 <b>휠 폭풍</b>.',
    waitFor: 'lockout',
    loadout: ['bench', 60],
    flags: { driftScale: 0.4, sticking: 'force', drainScale: 0.6, ratio: 0.82 },
    retry: 'sticking',
    highlight: '.stamina-wrap'
  },
  {
    id: 'gear',
    num: 6,
    title: '장비 사용',
    text: '키보드 <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 이나 장비 칸 클릭으로 하나씩 써봐라. (연습이라 공짜)<br>' +
          '<small>스토리 모드에서 장비는 한정 수량! 결승은 장비 없이 못 든다. 아껴라.</small>',
    waitFor: 'gearAll',
    checklist: [
      { key: 'ammonia', label: '<kbd>1</kbd> 암모니아: 6초간 힘 +15%, 한계 지점 부담 40% 감소' },
      { key: 'belt', label: '<kbd>2</kbd> 인저벨트: 이번 세트 흔들림·그립 슬립 60% 감소' },
      { key: 'booster', label: '<kbd>3</kbd> 부스터: 스태미나·펌핑 100%' }
    ],
    flags: { freeItems: true },
    blockPush: true,
    highlight: '.gear-dock'
  },
  {
    id: 'outro',
    title: '🔥 기본기 완료!',
    text: '이제 <b>스토리 모드</b>에서 철인 짐의 문을 열어라.<br>' +
          '1RM보다 무거운 무게는 장비 없이는 절대 안 들린다. 3대 500까지 장비를 아껴라!',
    button: '메인 메뉴로'
  }
];

const TOTAL_NUMBERED = STEPS.filter(s => s.num).length;

export class Tutorial {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.index = 0;
    this.busy = false;          // showing feedback between steps
    this.flags = { ...BASE_FLAGS };
    this.gearUsed = new Set();
    this.timer = null;

    this.dom = {
      card: document.getElementById('coach-card'),
      progress: document.getElementById('coach-progress'),
      title: document.getElementById('coach-title'),
      text: document.getElementById('coach-text'),
      feedback: document.getElementById('coach-feedback'),
      checklist: document.getElementById('coach-checklist'),
      next: document.getElementById('coach-next'),
      skip: document.getElementById('coach-skip'),
      avatar: document.getElementById('coach-avatar')
    };

    this.dom.next.onclick = () => this.onButton();
    this.dom.skip.onclick = () => this.finish(true);
  }

  get step() {
    return STEPS[this.index];
  }

  // Game asks this before treating a click as a push
  get blocksPush() {
    if (!this.active) return false;
    return this.busy || !!this.step.button || !!this.step.blockPush;
  }

  start() {
    if (this.active) return;
    const g = this.game;
    g.cancelTimers();
    g.storyUI.hideAll();
    [g.dom.prModal, g.dom.failModal, g.dom.tutorialModal].forEach(m => m && m.classList.remove('show'));
    g.mode = 'free';
    g.run = null;
    document.body.classList.remove('mode-story', 'mode-menu');
    document.body.classList.add('mode-free');
    g.buffs = { ammonia: 0, belt: false, pumpLock: 0 };
    this.active = true;
    this.dom.card.classList.add('show');
    this.goTo(0);
  }

  goTo(target, { reset = true } = {}) {
    clearTimeout(this.timer);
    this.index = typeof target === 'number' ? target : STEPS.findIndex(s => s.id === target);
    const s = this.step;

    this.flags = { ...BASE_FLAGS, ...(s.flags || {}) };
    this.gearUsed = new Set();
    this.busy = false;

    if (reset) {
      if (s.loadout) this.game.applyLoadout(s.loadout[0], s.loadout[1]);
      else this.game.resetExercise();
    }
    this.game.updateHUD();

    this.render();
  }

  render() {
    const s = this.step;
    this.dom.progress.textContent = s.num ? `STEP ${s.num} / ${TOTAL_NUMBERED}` : 'TRAINING';
    this.dom.title.innerHTML = s.title;
    this.dom.text.innerHTML = s.text;
    this.setFeedback('');

    // Checklist (gear step)
    this.dom.checklist.innerHTML = '';
    if (s.checklist) {
      s.checklist.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = item.label;
        if (this.gearUsed.has(item.key)) li.classList.add('done');
        this.dom.checklist.appendChild(li);
      });
    }

    // Button
    if (s.button) {
      this.dom.next.textContent = s.button;
      this.dom.next.style.display = '';
    } else {
      this.dom.next.style.display = 'none';
    }
    this.dom.skip.style.display = s.id === 'outro' ? 'none' : '';

    // HUD highlight
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    if (s.highlight) {
      const el = document.querySelector(s.highlight);
      if (el) el.classList.add('tut-highlight');
    }

    // Re-trigger entrance animation
    this.dom.card.classList.remove('pop');
    void this.dom.card.offsetWidth;
    this.dom.card.classList.add('pop');
  }

  setFeedback(msg, tone = '') {
    this.dom.feedback.className = 'coach-feedback' + (tone ? ` ${tone}` : '');
    this.dom.feedback.innerHTML = msg;
    // 관장님 expression follows the feedback: praise → happy, fail → angry, sticking → shock
    const mood = { good: 'happy', bad: 'angry', hot: 'shock' }[tone] || (this.step && this.step.button ? 'normal' : 'think');
    this.dom.avatar.innerHTML = portrait('boss', mood, { bg: false });
  }

  onButton() {
    if (this.step.id === 'outro') this.finish(false);
    else this.goTo(this.index + 1);
  }

  // Events from the game: liftStart, sticking, lockout, fail, gear
  onEvent(name, data) {
    if (!this.active || this.busy) return;
    const s = this.step;

    if (name === 'fail') {
      this.busy = true;
      const msg = {
        balance: '😵 바벨이 기울어 미끄러졌다! <kbd>A</kbd>/<kbd>D</kbd>로 초록 막대를 가운데에 붙잡아라.',
        sticking: '😵 한계 지점에서 버티지 못했다! 스태미나가 바닥나기 전에 뚫어야 한다.',
        depth: '😵 깊이 부족 (NO REP)! DEPTH 초록 구간까지 내려간 다음에 떼라.',
        grip: '😵 그립을 놓쳤다! 경고가 뜨면 표시된 키를 바로 눌러라.',
        floor: '😵 바닥에서 못 뗐다! 클릭하고 바로 휠을 아래로 굴려라.',
        timeout: '😵 시간 초과! 10초 안에 끝까지 올려야 한다.'
      }[data] || ({
        bench: '😵 힘이 빠졌다! 바늘이 초록 구간에 들어왔을 때만 클릭해라. 빨간 칸은 MISS다.',
        squat: '😵 힘이 빠졌다! 꾹 누르고 있어야 올라간다. BRACE가 차면 아주 잠깐만 떼라.',
        deadlift: '😵 힘이 빠졌다! 휠을 쉬지 말고 아래로 굴려라.'
      })[this.game.exercise];
      this.setFeedback(msg + ' 다시!', 'bad');
      this.timer = setTimeout(() => this.goTo(s.retry || s.id), 1800);
      return;
    }

    if (name === 'sticking' && s.id === 'sticking') {
      this.setFeedback('⚡ 지금이다! 좁아진 초록 구간을 노려라!!', 'hot');
      return;
    }

    if (name === 'gear' && s.checklist) {
      this.gearUsed.add(data);
      [...this.dom.checklist.children].forEach((li, i) => {
        li.classList.toggle('done', this.gearUsed.has(s.checklist[i].key));
      });
      if (s.checklist.every(item => this.gearUsed.has(item.key))) this.complete();
      return;
    }

    if (name === s.waitFor) {
      if (name === 'liftStart') {
        // Same rep continues into the next step — no reset
        this.goTo(this.index + 1, { reset: false });
      } else {
        this.complete();
      }
    }
  }

  complete() {
    this.busy = true;
    const cheers = ['💪 좋아! 완벽하다!', '🔥 그거지! 득근 완료!', '👏 훌륭해! 다음 단계!'];
    this.setFeedback(cheers[Math.floor(Math.random() * cheers.length)], 'good');
    this.timer = setTimeout(() => this.goTo(this.index + 1), 1600);
  }

  finish(skipped) {
    clearTimeout(this.timer);
    this.active = false;
    this.busy = false;
    this.flags = { ...BASE_FLAGS };
    this.dom.card.classList.remove('show', 'pop');
    document.querySelectorAll('.tut-highlight').forEach(el => el.classList.remove('tut-highlight'));
    try { localStorage.setItem('ironlift_tutorial_seen', 'true'); } catch (e) { /* ignore */ }

    const g = this.game;
    g.buffs = { ammonia: 0, belt: false, pumpLock: 0 };
    g.cancelTimers();
    g.storyUI.showMenu();
    g.updateHUD();
  }
}
