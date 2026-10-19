// ---------------------------------------------------------------
// 플레이어가 정하는 이름 (주인공 / 짝사랑) + 한국어 조사 자동 처리
//   fillNames('{me:아} 사랑해', names) → '민준아 사랑해' / '지호야 사랑해'
// ---------------------------------------------------------------

export const DEFAULT_NAMES = { me: '김민준', her: '한서연' };
export const NAME_MAX = 8;

// Korean surnames that are two syllables (남궁민수 → 민수)
const DOUBLE_SURNAMES = ['남궁', '황보', '제갈', '선우', '독고', '사공', '서문', '동방'];

export function isHangulOnly(s) {
  return /^[가-힣]+$/.test(s);
}

// What friends call you: 김민준 → 민준, 남궁민수 → 민수, 지호 → 지호, Alex → Alex
export function givenName(full) {
  const n = (full || '').trim();
  if (!isHangulOnly(n)) return n;
  if (n.length >= 4 && DOUBLE_SURNAMES.includes(n.slice(0, 2))) return n.slice(2);
  if (n.length === 3 || n.length === 4) return n.slice(1);
  return n;
}

// True when the last syllable has a final consonant (받침)
export function hasBatchim(word) {
  const ch = (word || '').trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  // Non-Hangul: digits/letters that are read with a final consonant in Korean
  return /[013678LMNRlmnr]$/.test(ch);
}

// [with batchim, without batchim]
const JOSA = {
  '아': ['아', '야'],
  '이라는': ['이라는', '라는'],
  '이': ['이', '가'],
  '은': ['은', '는'],
  '을': ['을', '를'],
  '과': ['과', '와'],
  '이랑': ['이랑', '랑'],
  '이에요': ['이에요', '예요'],
  '이야': ['이야', '야'],
  '으로': ['으로', '로']
};

export function josa(word, particle) {
  const pair = JOSA[particle];
  if (!pair) return word + particle;
  return word + (hasBatchim(word) ? pair[0] : pair[1]);
}

export function cleanName(raw, fallback) {
  const n = (raw || '').replace(/[<>{}"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return n || fallback;
}

export function fillNames(text, names) {
  const n = names || DEFAULT_NAMES;
  const words = {
    ME: n.me, me: givenName(n.me),
    HER: n.her, her: givenName(n.her)
  };
  return (text || '').replace(/\{(ME|me|HER|her)(?::([^}]+))?\}/g, (m, key, particle) => {
    const w = words[key];
    return particle ? josa(w, particle) : w;
  });
}
