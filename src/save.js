// Save data: 근력(1RM), 아이템 재고, 스테이지 기록. localStorage 실패해도 게임은 동작.
import { START_STRENGTH, START_ITEMS } from './story.js';
import { DEFAULT_NAMES } from './names.js';

const KEY = 'ironlift_save_v2';

export const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } },
  remove(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
};

function fresh() {
  return {
    strength: { ...START_STRENGTH },
    items: { ...START_ITEMS },
    stages: {},          // id -> { stars, clears }
    ending: false,
    names: { ...DEFAULT_NAMES },
    namesSet: false      // 처음 스토리 시작 때 이름 정하기 화면
  };
}

export class SaveData {
  constructor() {
    this.data = fresh();
    try {
      const raw = store.get(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.data = {
          ...fresh(), ...d,
          strength: { ...START_STRENGTH, ...(d.strength || {}) },
          items: { ...START_ITEMS, ...(d.items || {}) },
          stages: d.stages || {},
          names: { ...DEFAULT_NAMES, ...(d.names || {}) }
        };
      }
    } catch (e) { this.data = fresh(); }
  }

  save() { store.set(KEY, JSON.stringify(this.data)); }

  reset() {
    this.data = fresh();
    this.save();
  }

  get strength() { return this.data.strength; }
  get items() { return this.data.items; }
  get names() { return this.data.names; }

  setNames(me, her) {
    this.data.names = { me, her };
    this.data.namesSet = true;
    this.save();
  }

  stageRecord(id) { return this.data.stages[id] || null; }

  isCleared(id) { const r = this.data.stages[id]; return !!(r && r.clears > 0); }

  addItems(items = {}) {
    Object.entries(items).forEach(([k, n]) => { this.data.items[k] = (this.data.items[k] || 0) + n; });
    this.save();
  }

  useItem(k) {
    if ((this.data.items[k] || 0) <= 0) return false;
    this.data.items[k] -= 1;
    this.save();
    return true;
  }

  addStrength(gain = {}) {
    Object.entries(gain).forEach(([k, n]) => { this.data.strength[k] = (this.data.strength[k] || 0) + n; });
    this.save();
  }

  // Returns { firstClear, newStars }
  recordClear(id, stars) {
    const prev = this.data.stages[id];
    const firstClear = !prev || !prev.clears;
    const best = Math.max(prev ? prev.stars : 0, stars);
    this.data.stages[id] = { stars: best, clears: (prev ? prev.clears : 0) + 1 };
    this.save();
    return { firstClear, prevStars: prev ? prev.stars : 0 };
  }
}
