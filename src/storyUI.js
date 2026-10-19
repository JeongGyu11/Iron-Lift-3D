// Story mode screens: 메인 메뉴, 스테이지 지도, 대화창, 결과 화면, 확인창
import { CHAPTERS, ALL_STAGES, CHARACTERS, findStage, nextStageId } from './story.js';
import { ITEMS, EXERCISE_NAMES } from './config.js';
import { store } from './save.js';
import { portrait, buildForChapter, inferMood } from './portraits.js';
import { fillNames, givenName, josa, cleanName, DEFAULT_NAMES } from './names.js';

const ITEM_KEYS = ['ammonia', 'belt', 'booster'];

function randomItem() {
  const roll = Math.random();
  return roll < 0.4 ? 'ammonia' : roll < 0.8 ? 'booster' : 'belt';
}

function itemsText(items) {
  return Object.entries(items || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => `${ITEMS[k].icon} ${ITEMS[k].name} +${n}`).join(' · ');
}

function strengthText(gain) {
  return Object.entries(gain || {}).filter(([, n]) => n > 0)
    .map(([k, n]) => `${EXERCISE_NAMES[k]} +${n}kg`).join(' · ');
}

export class StoryUI {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.dom = {
      menu: $('menu-screen'),
      menuStats: $('menu-stats'),
      btnStory: $('btn-menu-story'),
      btnFree: $('btn-menu-free'),
      btnTutorial: $('btn-menu-tutorial'),
      btnReset: $('btn-menu-reset'),
      map: $('map-screen'),
      mapBody: $('map-body'),
      mapItems: $('map-items'),
      btnMapBack: $('btn-map-back'),
      dlg: $('dialogue-box'),
      dlgAvatar: $('dlg-avatar'),
      dlgName: $('dlg-name'),
      dlgText: $('dlg-text'),
      dlgSkip: $('dlg-skip'),
      result: $('result-screen'),
      resTitle: $('res-title'),
      resStars: $('res-stars'),
      resBody: $('res-body'),
      resActions: $('res-actions'),
      names: $('name-screen'),
      nameMe: $('name-me'),
      nameHer: $('name-her'),
      confirm: $('confirm-box'),
      confirmText: $('confirm-text'),
      confirmYes: $('confirm-yes'),
      confirmNo: $('confirm-no')
    };

    this.dom.btnStory.onclick = () => {
      if (this.game.save.data.namesSet) this.showMap();
      else this.showNames(() => this.showMap());
    };
    $('btn-menu-names').onclick = () => this.showNames(() => this.showMenu());
    $('btn-name-ok').onclick = () => this.submitNames();
    $('btn-name-default').onclick = () => {
      this.dom.nameMe.value = DEFAULT_NAMES.me;
      this.dom.nameHer.value = DEFAULT_NAMES.her;
      this.submitNames();
    };
    [this.dom.nameMe, this.dom.nameHer].forEach(inp => {
      inp.addEventListener('input', () => this.previewNames());
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.submitNames(); });
    });
    this.dom.btnFree.onclick = () => { this.hideAll(); this.game.enterFree(); };
    this.dom.btnTutorial.onclick = () => { this.hideAll(); this.game.tutorial.start(); };
    this.dom.btnReset.onclick = () => this.confirm(
      '스토리 진행, 근력, 아이템, PR 기록이 모두 처음으로 돌아갑니다. 초기화할까요?',
      () => {
        this.game.save.reset();
        ['bench', 'squat', 'deadlift'].forEach(k => { store.remove(`pr_${k}`); this.game.pr[k] = 0; });
        this.game.updateHUD();
        this.showMenu();
        this.game.toast('진행이 초기화되었습니다');
      });
    this.dom.btnMapBack.onclick = () => this.showMenu();

    this.dom.dlg.onclick = () => this.advance();
    this.dom.dlgSkip.onclick = (e) => { e.stopPropagation(); this.finishDialogue(); };
    this.dom.confirmNo.onclick = () => this.dom.confirm.classList.remove('show');
  }

  // ---------- visibility ----------
  isBlocking() {
    return [this.dom.menu, this.dom.map, this.dom.dlg, this.dom.result, this.dom.confirm, this.dom.names]
      .some(el => el.classList.contains('show'));
  }

  hideAll() {
    [this.dom.menu, this.dom.map, this.dom.dlg, this.dom.result, this.dom.confirm, this.dom.names]
      .forEach(el => el.classList.remove('show'));
  }

  onKey(e) {
    if (this.dom.dlg.classList.contains('show') && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      if (!e.repeat) this.advance();
      return true;
    }
    if (this.dom.confirm.classList.contains('show') && e.code === 'Escape') {
      this.dom.confirm.classList.remove('show');
      return true;
    }
    return this.isBlocking();
  }

  confirm(text, onYes) {
    this.dom.confirmText.textContent = text;
    this.dom.confirmYes.onclick = () => { this.dom.confirm.classList.remove('show'); onYes(); };
    this.dom.confirm.classList.add('show');
  }

  // 🏠 button
  requestHome() {
    const g = this.game;
    if (g.tutorial.active) {
      this.confirm('튜토리얼을 그만두고 메인 메뉴로 갈까요?', () => { g.tutorial.finish(true); });
      return;
    }
    if (g.mode === 'story') {
      this.confirm('스테이지를 포기하고 지도로 돌아갈까요? 사용한 장비는 돌려받지 못합니다.', () => {
        g.enterMenu();
        this.showMap();
      });
      return;
    }
    g.enterMenu();
    this.showMenu();
  }

  fill(text) {
    return fillNames(text, this.game.save.names);
  }

  // ---------- names ----------
  showNames(onDone) {
    this.game.enterMenu();
    this.hideAll();
    this.afterNames = onDone;
    const n = this.game.save.names;
    this.dom.nameMe.value = n.me;
    this.dom.nameHer.value = n.her;
    document.getElementById('name-me-art').innerHTML = portrait('me', 'think', { build: 'skinny' });
    document.getElementById('name-her-art').innerHTML = portrait('seoyeon', 'happy');
    this.previewNames();
    this.dom.names.classList.add('show');
    setTimeout(() => { this.dom.nameMe.focus(); this.dom.nameMe.select(); }, 50);
  }

  previewNames() {
    const me = cleanName(this.dom.nameMe.value, DEFAULT_NAMES.me);
    const her = cleanName(this.dom.nameHer.value, DEFAULT_NAMES.her);
    document.getElementById('name-me-preview').textContent = `탄탄클럽: "${josa(givenName(me), '아')} 사랑해 (형님 되기 전까지)"`;
    document.getElementById('name-her-preview').textContent = `이모: "${josa(givenName(her), '이라는')} 처자한테 티켓 보내놨어"`;
  }

  submitNames() {
    const me = cleanName(this.dom.nameMe.value, DEFAULT_NAMES.me);
    const her = cleanName(this.dom.nameHer.value, DEFAULT_NAMES.her);
    this.game.save.setNames(me, her);
    this.dom.names.classList.remove('show');
    this.game.toast(`✏️ 주인공 ${me} · 짝사랑 ${her}`);
    const cb = this.afterNames;
    this.afterNames = null;
    if (cb) cb();
  }

  // ---------- menu ----------
  showMenu() {
    this.game.enterMenu();
    this.hideAll();
    const s = this.game.save;
    const next = this.nextPlayable();
    const total = this.game.pr.bench + this.game.pr.squat + this.game.pr.deadlift;
    this.dom.menuStats.innerHTML = `
      <div class="stat-row"><span>현재 1RM</span>
        <b>벤치 ${s.strength.bench} · 스쿼트 ${s.strength.squat} · 데드 ${s.strength.deadlift}kg</b></div>
      <div class="stat-row"><span>3대 PR 합계</span><b>${total}kg / 500kg</b></div>
      <div class="stat-row"><span>장비 재고</span><b>${ITEM_KEYS.map(k => `${ITEMS[k].icon}×${s.items[k] || 0}`).join('  ')}</b></div>`;
    this.dom.btnStory.innerHTML = s.data.ending
      ? '📖 스토리 모드 <small>완주! 스테이지 다시 하기</small>'
      : next && next.id !== '1-1'
        ? `📖 스토리 이어하기 <small>${next.id} ${next.title}</small>`
        : '📖 스토리 모드 <small>철인 짐의 문을 열다</small>';
    document.querySelector('.menu-tag').textContent =
      `짝사랑 ${givenName(s.names.her)} 씨의 이상형은 "몸 좋은 남자". 그런데 몸이 좋아질수록 꼬이는 건 몸 좋은 형님들뿐...`;
    const ch = s.data.ending ? 5 : (next ? next.chapterId : 5);
    document.getElementById('menu-portrait').innerHTML = portrait('me', s.data.ending ? 'happy' : 'normal', { build: buildForChapter(ch) });
    this.dom.menu.classList.add('show');
  }

  nextPlayable() {
    return ALL_STAGES.find(st => !this.game.save.isCleared(st.id)) || null;
  }

  isUnlocked(id) {
    const i = ALL_STAGES.findIndex(s => s.id === id);
    return i === 0 || this.game.save.isCleared(ALL_STAGES[i - 1].id);
  }

  // ---------- map ----------
  showMap() {
    this.game.enterMenu();
    this.hideAll();
    const save = this.game.save;
    this.dom.mapItems.innerHTML = ITEM_KEYS.map(k =>
      `<span class="map-item" title="${ITEMS[k].desc}">${ITEMS[k].icon} ${ITEMS[k].name} ×${save.items[k] || 0}</span>`).join('');

    this.dom.mapBody.innerHTML = '';
    CHAPTERS.forEach(ch => {
      const sec = document.createElement('section');
      sec.className = 'map-chapter';
      const chUnlocked = this.isUnlocked(ch.stages[0].id);
      const feat = { 1: 'seoyeon', 2: 'taesan', 3: 'dongsu', 4: 'mc', 5: 'me' }[ch.id];
      const featArt = chUnlocked ? portrait(feat, feat === 'taesan' ? 'smug' : 'normal', { build: 'buff' }) : '';
      sec.innerHTML = `<header>${featArt ? `<span class="ch-portrait">${featArt}</span>` : '<span class="ch-portrait locked">?</span>'}<span class="ch-num">CHAPTER ${ch.id}</span>
        <h3>${chUnlocked ? ch.title : '???'}</h3><p>${chUnlocked ? ch.subtitle : '이전 챕터를 클리어하세요'}</p></header>`;
      const row = document.createElement('div');
      row.className = 'stage-row';
      ch.stages.forEach(st => {
        const rec = save.stageRecord(st.id);
        const unlocked = this.isUnlocked(st.id);
        const card = document.createElement('button');
        card.className = 'stage-card' + (unlocked ? '' : ' locked') + (rec && rec.clears ? ' cleared' : '');
        const stars = rec ? rec.stars : 0;
        const mods = st.mods || {};
        const tags = [
          st.lifts.some(l => l.reps === 1) ? '<i class="tag heavy">고중량</i>' : '',
          mods.noItems ? '<i class="tag ban">장비 금지</i>' : '',
          mods.gust ? '<i class="tag gust">돌풍 ×' + mods.gust + '</i>' : '',
          st.lifts.some(l => l.weight > (save.strength[l.exercise] || 1)) ? '<i class="tag over">1RM 초과</i>' : ''
        ].join('');
        card.innerHTML = `
          <span class="sc-id">${st.id}</span>
          <span class="sc-title">${unlocked ? st.title : '🔒 잠김'}</span>
          <span class="sc-goal">${unlocked ? st.goal : ''}</span>
          <span class="sc-tags">${unlocked ? tags : ''}</span>
          <span class="sc-stars">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>`;
        if (unlocked) card.onclick = () => this.openStage(st.id);
        else card.disabled = true;
        row.appendChild(card);
      });
      sec.appendChild(row);
      this.dom.mapBody.appendChild(sec);
    });
    this.dom.map.classList.add('show');
  }

  openStage(id) {
    const stage = findStage(id);
    this.chapter = stage.chapterId;
    this.hideAll();
    const replay = this.game.save.isCleared(id);
    const lines = replay ? stage.before.slice(-2) : stage.before;
    this.playDialogue(lines, () => {
      this.game.startStage(stage);
      this.game.toast(`${stage.id} ${stage.title} · ${stage.goal}`);
    });
  }

  // ---------- dialogue ----------
  playDialogue(lines, onDone) {
    this.lines = lines || [];
    this.lineIdx = -1;
    this.lastSpeaker = null;
    this.onDialogueDone = onDone;
    if (!this.lines.length) { this.finishDialogue(); return; }
    this.dom.dlg.classList.add('show');
    this.advance();
  }

  advance() {
    if (this.typing) {
      // Finish the current line instantly
      clearInterval(this.typeTimer);
      this.typing = false;
      this.dom.dlgText.textContent = this.fullText;
      return;
    }
    this.lineIdx++;
    if (this.lineIdx >= this.lines.length) { this.finishDialogue(); return; }
    const [who, text, moodTag] = this.lines[this.lineIdx];
    const c = CHARACTERS[who] || CHARACTERS.sys;
    const mood = inferMood(who, text, moodTag);
    const art = portrait(who, mood, { build: buildForChapter(this.chapter || 1), bg: false });
    if (who !== this.lastSpeaker) {
      this.dom.dlgAvatar.classList.remove('enter');
      void this.dom.dlgAvatar.offsetWidth;
      this.dom.dlgAvatar.classList.add('enter');
    }
    this.lastSpeaker = who;
    this.dom.dlgAvatar.innerHTML = art;
    this.dom.dlgName.textContent = this.fill(c.name);
    this.dom.dlg.style.setProperty('--speaker', c.color);
    this.dom.dlg.classList.toggle('narration', who === 'sys' || !art);
    this.fullText = this.fill(text);
    this.dom.dlgText.textContent = '';
    this.typing = true;
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 2;
      this.dom.dlgText.textContent = this.fullText.slice(0, i);
      if (i >= this.fullText.length) { clearInterval(this.typeTimer); this.typing = false; }
    }, 22);
  }

  finishDialogue() {
    clearInterval(this.typeTimer);
    this.typing = false;
    this.dom.dlg.classList.remove('show');
    const cb = this.onDialogueDone;
    this.onDialogueDone = null;
    if (cb) cb();
  }

  // ---------- results ----------
  onStageClear(run) {
    const g = this.game;
    const stage = run.stage;
    this.chapter = stage.chapterId || (findStage(stage.id) || {}).chapterId || 1;
    const stars = 1 + (run.failures === 0 ? 1 : 0) + (run.itemsUsed === 0 ? 1 : 0);
    const { firstClear, prevStars } = g.save.recordClear(stage.id, stars);

    const rewardsLines = [];
    if (firstClear) {
      const rw = stage.reward || {};
      if (rw.strength) { g.save.addStrength(rw.strength); rewardsLines.push(`💪 근력 상승: ${strengthText(rw.strength)}`); }
      if (rw.items) { g.save.addItems(rw.items); rewardsLines.push(`🎁 ${itemsText(rw.items)}`); }
    } else {
      const k = randomItem();
      g.save.addItems({ [k]: 1 });
      rewardsLines.push(`🔁 보충 훈련 보상: ${ITEMS[k].icon} ${ITEMS[k].name} +1`);
    }
    if (stars === 3 && prevStars < 3) {
      const k = randomItem();
      g.save.addItems({ [k]: 1 });
      rewardsLines.push(`⭐ 첫 3성 보너스: ${ITEMS[k].icon} ${ITEMS[k].name} +1`);
    }
    if (stage.final) { g.save.data.ending = true; g.save.save(); }
    g.updateHUD();

    const buildBefore = buildForChapter(this.chapter || 1);
    const nextSt = findStage(nextStageId(stage.id) || '') || null;
    const buildAfter = stage.final ? 'buff' : buildForChapter(nextSt ? nextSt.chapterId : this.chapter || 1);
    const BUILD_NAME = { skinny: '멸치', lean: '헬린이', fit: '근육맨', buff: '헬창' };
    if (firstClear && buildAfter !== buildBefore) rewardsLines.unshift(`🔥 몸이 변했다! ${BUILD_NAME[buildBefore]} → ${BUILD_NAME[buildAfter]}`);

    const showResult = () => {
      g.enterMenu();
      this.hideAll();
      document.getElementById('res-portrait').innerHTML = portrait('me', 'happy', { build: buildAfter });
      this.dom.resTitle.textContent = stage.final ? '🏆 3대 500 달성!' : 'STAGE CLEAR!';
      this.dom.resTitle.className = 'res-title good';
      this.dom.resStars.innerHTML = [0, 1, 2].map(i => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
      this.dom.resBody.innerHTML = `
        <p class="res-stage">${stage.id} ${stage.title}</p>
        <ul class="res-criteria">
          <li class="on">★ 클리어</li>
          <li class="${run.failures === 0 ? 'on' : ''}">★ 실패 없이 (실패 ${run.failures}회)</li>
          <li class="${run.itemsUsed === 0 ? 'on' : ''}">★ 장비 없이 (사용 ${run.itemsUsed}개)</li>
        </ul>
        ${rewardsLines.length ? `<div class="res-rewards">${rewardsLines.map(l => `<p>${l}</p>`).join('')}</div>` : ''}
        <p class="res-now">현재 1RM · 벤치 ${g.save.strength.bench} · 스쿼트 ${g.save.strength.squat} · 데드 ${g.save.strength.deadlift}kg</p>`;
      this.dom.resActions.innerHTML = '';
      const nextId = nextStageId(stage.id);
      if (nextId && !stage.final) this.addAction('다음 스테이지 ▶', () => this.openStage(nextId), true);
      if (stage.final) this.addAction('자유 훈련으로 PR 도전', () => { this.hideAll(); g.enterFree(); }, true);
      this.addAction('지도로', () => this.showMap());
      this.dom.result.classList.add('show');
    };

    if (firstClear) this.playDialogue(stage.after, showResult);
    else showResult();
  }

  onStageFail(run, why, reason = 'stamina') {
    const g = this.game;
    const stage = run.stage;
    g.enterMenu();
    this.hideAll();
    this.dom.resTitle.textContent = 'STAGE FAILED';
    this.dom.resTitle.className = 'res-title bad';
    this.dom.resStars.innerHTML = '';
    const lift = stage.lifts[Math.min(run.liftIdx, stage.lifts.length - 1)];
    const r = lift.weight / g.save.strength[lift.exercise];
    const byExercise = {
      bench: '벤치는 바늘이 초록 구간에 들어왔을 때만 클릭하세요. 가운데 노란 구간이면 PERFECT입니다. 빨간 곳에서 누르면 게이지가 멈추고 스태미나만 빠집니다.',
      squat: '스쿼트는 꾹 누르고 있어야 올라갑니다. BRACE 게이지가 꽉 차기 직전에 아주 잠깐만 떼세요. 오래 떼면 바가 내려옵니다.',
      deadlift: '데드는 휠을 쉬지 않고 아래로 굴려야 합니다. 그립 경고가 뜨면 휠보다 키 입력이 먼저입니다.'
    };
    const stickTips = {
      bench: '한계 지점에서는 초록 구간이 좁아지고 바늘이 빨라집니다. 서두르지 말고 정확히 맞추세요. 암모니아를 쓰면 필요 횟수가 줄어듭니다.',
      squat: '한계 지점에서는 누른 채로 GRIND 100%까지 버텨야 합니다. 복압이 터지면 진행도가 깎이니 짧게 끊어서 버티세요.',
      deadlift: '무릎 통과 구간에서는 휠을 최대한 빨리 굴리세요. 암모니아를 쓰면 필요한 칸 수가 줄어듭니다.'
    };
    let tip = byExercise[lift.exercise];
    if (reason === 'balance') tip = '누를 때마다 약한 팔 쪽으로 쏠립니다. ⚠ 예고가 뜨면 반대쪽 키를 미리 누르세요. 벨트를 차면 흔들림이 크게 줄어듭니다.';
    else if (reason === 'depth') tip = '스쿼트는 DEPTH 게이지의 초록 구간까지 내려간 다음에 떼야 인정됩니다. 너무 일찍 떼면 NO REP입니다.';
    else if (reason === 'floor') tip = '데드는 클릭 후 바로 휠을 굴려야 합니다. 바닥 근처에 오래 머물면 실패입니다. 휠을 멈추지 마세요.';
    else if (reason === 'grip') tip = '그립 경고가 뜨면 화면에 표시된 키(A 또는 D)를 바로 누르세요. 벨트를 차면 미끄러지는 횟수가 줄어듭니다.';
    else if (reason === 'sticking') tip = stickTips[lift.exercise];
    else if (r >= 1) tip = '1RM보다 무거운 무게입니다. 암모니아(힘)와 부스터(스태미나·펌핑)를 함께 써야 합니다. 암모니아는 시작 직전에!';
    else if (lift.reps > 1) tip += ' 반복 사이 회복량은 정해져 있으니 초반에 스태미나를 아끼세요.';
    this.dom.resBody.innerHTML = `
      <p class="res-stage">${stage.id} ${stage.title}</p>
      <p class="res-why">${why}</p>
      <div class="res-tip"><span class="tip-portrait">${portrait('boss', 'angry', { bg: false })}</span><div><b>강철구 관장의 조언</b><p>${tip}</p></div></div>`;
    document.getElementById('res-portrait').innerHTML = portrait('me', 'sad', { build: buildForChapter(stage.chapterId || this.chapter || 1) });
    this.dom.resActions.innerHTML = '';
    this.addAction('다시 도전', () => { this.hideAll(); g.startStage(stage); }, true);
    this.addAction('지도로', () => this.showMap());
    this.dom.result.classList.add('show');
  }

  addAction(label, fn, primary = false) {
    const b = document.createElement('button');
    b.className = primary ? 'modal-btn' : 'coach-skip';
    b.textContent = label;
    b.onclick = fn;
    this.dom.resActions.appendChild(b);
  }
}
