// ---------------------------------------------------------------
// Character portraits (inline SVG, no image files)
//   portrait(who, mood, opts) → SVG string
//   who  : me | seoyeon | boss | aunt | taesan | dongsu | leo | mc
//   mood : normal | happy | shock | angry | sad | smug | think | blush
//   opts : { build } — 주인공 체형: skinny(멸치) | lean | fit | buff(헬창)
//
// 모든 캐릭터는 같은 얼굴 리그(머리형, 눈, 눈썹, 입)를 공유하고
// 머리카락/옷/소품만 다르게 얹는다. viewBox 0 0 200 240 (흉상).
// ---------------------------------------------------------------

const INK = '#1d1512';
let uid = 0;

// ---------- palettes ----------
const SKIN = {
  me:      ['#e0a873', '#bf834d'],
  seoyeon: ['#f7d6c1', '#e3b096'],
  boss:    ['#c98f5f', '#9f6c43'],
  aunt:    ['#f1caa7', '#d6a581'],
  taesan:  ['#e7b98f', '#c8916a'],
  dongsu:  ['#ebc196', '#c99b6d'],
  leo:     ['#a96b3e', '#83502b'],
  mc:      ['#f0c7a3', '#d3a07c']
};

// ---------- shapes ----------
const HEAD = {
  square: 'M62 84 C62 50 78 36 100 36 C122 36 138 50 138 84 L137 104 C135 124 124 138 108 143 C103 145 97 145 92 143 C76 138 65 124 63 104 Z',
  soft:   'M64 84 C64 50 80 38 100 38 C120 38 136 50 136 84 C136 110 128 128 112 138 C104 143 96 143 88 138 C72 128 64 110 64 84 Z',
  round:  'M60 86 C60 52 78 38 100 38 C122 38 140 52 140 86 C140 114 128 134 100 140 C72 134 60 114 60 86 Z',
  thin:   'M66 84 C66 50 81 38 100 38 C119 38 134 50 134 84 C134 110 126 130 110 140 C104 144 96 144 90 140 C74 130 66 110 66 84 Z'
};
const FACE_SHADE = 'M128 66 C138 90 134 120 114 138 C108 142 104 143 100 143 C114 128 126 104 128 66 Z';

const TORSO = {
  skinny: 'M44 240 C46 214 58 200 78 194 C88 190 92 182 93 166 L107 166 C108 182 112 190 122 194 C142 200 154 214 156 240 Z',
  slim:   'M38 240 C40 210 56 194 78 188 C88 184 92 174 92 160 L108 160 C108 174 112 184 122 188 C144 194 160 210 162 240 Z',
  normal: 'M30 240 C32 206 48 188 72 182 C84 178 88 168 88 154 L112 154 C112 168 116 178 128 182 C152 188 168 206 170 240 Z',
  fit:    'M18 240 C20 202 38 184 66 176 C80 172 85 162 86 150 L114 150 C115 162 120 172 134 176 C162 184 180 202 182 240 Z',
  buff:   'M4 240 C6 196 26 176 58 168 C74 164 82 156 84 144 L116 144 C118 156 126 164 142 168 C174 176 194 196 196 240 Z',
  big:    'M2 240 C4 196 32 172 70 166 L130 166 C168 172 196 196 198 240 Z'
};

// ---------- small helpers ----------
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const outlined = (d, fill, w = 2.4) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const line = (d, w = 2.2, color = INK, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;

function mirrorX(d) {
  // Mirror simple absolute path data around x = 100
  return d.replace(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (m, x, y) => `${200 - parseFloat(x)} ${y}`);
}

// ---------- face rig ----------
function eyes(mood, style, iris, lid) {
  const L = 83, R = 117, Y = 93;
  let s = '';
  const one = (cx, side) => {
    if (mood === 'happy') return line(`M${cx - 7} ${Y + 1} Q${cx} ${Y - 6} ${cx + 7} ${Y + 1}`, 2.6);
    if (style === 'gentle') {
      const r = mood === 'shock' ? 3.6 : 3;
      return `<circle cx="${cx}" cy="${Y}" r="${r}" fill="${INK}"/><circle cx="${cx + 1}" cy="${Y - 1}" r="1" fill="#fff"/>`;
    }
    const big = mood === 'shock';
    const rx = big ? 8 : 7.2, ry = big ? 7 : (style === 'narrow' ? 3.6 : 5.2);
    let ix = cx, iy = Y;
    if (mood === 'think') { ix += side * 2.5; iy -= 2; }
    const ir = big ? 2.6 : (style === 'narrow' ? 3 : 3.9);
    let e = `<ellipse cx="${cx}" cy="${Y}" rx="${rx}" ry="${ry}" fill="#fff" stroke="${INK}" stroke-width="2"/>`;
    e += `<circle cx="${ix}" cy="${iy}" r="${ir}" fill="${iris}"/><circle cx="${ix}" cy="${iy}" r="${ir * 0.5}" fill="${INK}"/>`;
    e += `<circle cx="${ix + 1.3}" cy="${iy - 1.4}" r="1.1" fill="#fff"/>`;
    // upper lid
    if (mood === 'smug' || mood === 'angry') {
      const drop = mood === 'smug' ? 3.2 : 2;
      e += path(`M${cx - rx - 1} ${Y - ry - 1} L${cx + rx + 1} ${Y - ry - 1} L${cx + rx + 1} ${Y - ry + drop + 1} Q${cx} ${Y - ry + drop + 3} ${cx - rx - 1} ${Y - ry + drop + 1} Z`, lid);
    }
    if (style === 'lashes') e += line(`M${cx - rx} ${Y - ry + 1} Q${cx} ${Y - ry - 3} ${cx + rx + 2} ${Y - ry - 1}`, 2.6);
    else e += line(`M${cx - rx} ${Y - ry + 1} Q${cx} ${Y - ry - 2} ${cx + rx} ${Y - ry + 1}`, 2.4);
    return e;
  };
  s += one(L, -1) + one(R, 1);
  return s;
}

function brows(mood, color, thick = 3.4) {
  const B = {
    normal: ['M74 80 Q83 76 91 79', 'M109 79 Q117 76 126 80'],
    happy:  ['M74 79 Q83 74 91 77', 'M109 77 Q117 74 126 79'],
    shock:  ['M74 74 Q83 69 91 72', 'M109 72 Q117 69 126 74'],
    angry:  ['M74 76 Q84 79 92 84', 'M108 84 Q116 79 126 76'],
    sad:    ['M74 82 Q83 79 91 75', 'M109 75 Q117 79 126 82'],
    smug:   ['M74 79 Q83 76 91 80', 'M109 76 Q117 72 126 76'],
    think:  ['M74 80 Q83 77 91 80', 'M109 76 Q117 73 126 77'],
    blush:  ['M74 80 Q83 77 91 79', 'M109 79 Q117 77 126 80']
  }[mood] || ['M74 80 Q83 76 91 79', 'M109 79 Q117 76 126 80'];
  return line(B[0], thick, color) + line(B[1], thick, color);
}

function mouth(mood, kind = 'normal') {
  switch (mood) {
    case 'happy':
      return outlined('M86 116 Q100 134 114 116 Q100 121 86 116 Z', '#8a2a2a', 2.2) + path('M88 117 Q100 121 112 117 L111 120 Q100 123 89 120 Z', '#fff');
    case 'shock':
      return `<ellipse cx="100" cy="122" rx="6.5" ry="8" fill="#7a2323" stroke="${INK}" stroke-width="2.2"/>`;
    case 'angry':
      return outlined('M88 119 L112 119 L111 125 L89 125 Z', '#fff', 2.2) + line('M89 122 L111 122', 1.4);
    case 'sad':
      return line('M90 124 Q100 117 110 124', 2.4);
    case 'smug':
      return line('M89 119 Q101 124 112 115', 2.6);
    case 'think':
      return line('M93 121 Q100 119 106 121', 2.2);
    case 'blush':
      return line('M91 119 Q100 124 109 119', 2.4);
    default:
      return kind === 'grin'
        ? outlined('M87 117 Q100 128 113 117 Q100 120 87 117 Z', '#fff', 2.2)
        : line('M90 119 Q100 124 110 119', 2.4);
  }
}

function extrasFor(mood) {
  let s = '';
  if (mood === 'blush' || mood === 'happy') {
    s += `<ellipse cx="74" cy="108" rx="8" ry="4.5" fill="#ff6b8a" opacity="0.35"/><ellipse cx="126" cy="108" rx="8" ry="4.5" fill="#ff6b8a" opacity="0.35"/>`;
  }
  if (mood === 'shock') {
    s += outlined('M146 62 C141 70 140 76 146 79 C152 76 151 70 146 62 Z', '#9fe3ff', 1.8);
  }
  if (mood === 'angry') {
    s += line('M140 58 L148 52 M144 62 L154 60 M141 54 L144 46', 2.6, '#ff3b3b');
  }
  if (mood === 'sad') {
    s += outlined('M78 100 C75 106 75 110 78 112 C81 110 81 106 78 100 Z', '#9fe3ff', 1.6);
  }
  return s;
}

function face(o) {
  const [skin, shade] = o.skin;
  const id = o.id;
  let s = '';
  s += `<g>`;
  // ears
  s += `<ellipse cx="${o.head === 'thin' ? 65 : 61}" cy="95" rx="7" ry="11" fill="${skin}" stroke="${INK}" stroke-width="2.2"/>`;
  s += `<ellipse cx="${o.head === 'thin' ? 135 : 139}" cy="95" rx="7" ry="11" fill="${skin}" stroke="${INK}" stroke-width="2.2"/>`;
  // head
  s += outlined(HEAD[o.head], `url(#sk${id})`);
  s += path(FACE_SHADE, shade, 'opacity="0.55"');
  // nose
  s += line('M101 98 Q97 108 100 111 Q103 112 106 110', 2, shade === '#83502b' ? '#5a3418' : '#8c5a3a');
  s += eyes(o.mood, o.eyeStyle || 'normal', o.iris || '#3b2414', skin);
  s += brows(o.mood, o.browColor || INK, o.browThick || 3.4);
  s += mouth(o.mood, o.mouthKind);
  s += extrasFor(o.mood);
  s += `</g>`;
  return s;
}

function defs(id, skin, bg) {
  return `<defs>
    <linearGradient id="sk${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${skin[0]}"/><stop offset="1" stop-color="${skin[1]}"/>
    </linearGradient>
    <radialGradient id="bg${id}" cx="0.5" cy="0.35" r="0.75">
      <stop offset="0" stop-color="${bg}" stop-opacity="0.55"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shine${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>`;
}

let withBg = true;
function wrap(id, skin, bg, inner) {
  return `<svg viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" role="img">${defs(id, skin, bg)}` +
    (withBg ? `<rect width="200" height="240" fill="url(#bg${id})"/>` : '') + `${inner}</svg>`;
}

// Rim lights in the gym's neon colors (cyan left, orange right)
function rim(d) {
  return line(d, 3, '#5ce1e6', 'opacity="0.55"') + line(mirrorX(d), 3, '#ff8a3d', 'opacity="0.5"');
}

// ---------- protagonist: 김민준 (멸치 → 헬창) ----------
function drawMe(mood, build) {
  const id = `me${++uid}`;
  const skin = SKIN.me;
  let s = '';
  const torso = { skinny: 'skinny', lean: 'slim', fit: 'fit', buff: 'buff' }[build];

  // body
  s += outlined(TORSO[torso], `url(#sk${id})`);
  if (build === 'skinny') {
    // Oversized office shirt + loosened tie, slouched neck
    s += outlined('M40 240 C42 214 56 198 78 192 L90 178 L100 196 L110 178 L122 192 C144 198 158 214 160 240 Z', '#dfe6ee');
    s += outlined('M90 178 L100 196 L94 204 L84 186 Z', '#ffffff', 1.8) + outlined('M110 178 L100 196 L106 204 L116 186 Z', '#ffffff', 1.8);
    s += outlined('M97 198 L103 198 L106 228 L100 236 L94 228 Z', '#3a5a8c', 1.8);
    s += line('M70 214 Q74 226 72 240 M130 214 Q126 226 128 240', 1.6, '#9aa6b5');
    s += path('M93 166 L107 166 L107 180 L93 180 Z', `url(#sk${id})`);
  } else if (build === 'lean') {
    // Fitted gym tee
    s += outlined('M38 240 C40 210 56 194 78 188 C86 186 90 180 91 172 Q100 182 109 172 C110 180 114 186 122 188 C144 194 160 210 162 240 Z', '#2b3a55');
    s += line('M91 172 Q100 182 109 172', 2.4);
    s += line('M64 196 Q60 214 64 230 M136 196 Q140 214 136 230', 1.6, '#1b2638');
    s += `<text x="100" y="222" text-anchor="middle" font-family="Teko, Arial Narrow, sans-serif" font-size="16" fill="#00ff88" letter-spacing="1">IRON GYM</text>`;
  } else if (build === 'fit') {
    // Tank top, visible delts
    s += outlined('M70 180 C74 200 72 220 66 240 L134 240 C128 220 126 200 130 180 C122 196 78 196 70 180 Z', '#1f1f24');
    s += line('M50 190 Q40 208 44 230', 2, skin[1]) + line('M150 190 Q160 208 156 230', 2, skin[1]);
    s += line('M86 150 C76 164 62 172 46 178', 2, skin[1]) + line('M114 150 C124 164 138 172 154 178', 2, skin[1]);
    s += rim('M22 236 C24 204 40 186 66 178');
  } else {
    // 헬창: traps up to the ears, boulder delts, plate pecs, stringer tank
    const TRAPS = 'M0 240 L0 182 C8 170 30 160 56 150 C70 144 78 132 80 116 L120 116 C122 132 130 144 144 150 C170 160 192 170 200 182 L200 240 Z';
    s = outlined(TRAPS, `url(#sk${id})`, 2.6);
    s += path('M80 116 C78 134 70 146 56 152 C40 158 22 166 8 176 C26 160 52 150 66 140 C74 134 78 126 80 116 Z', skin[1], 'opacity="0.55"');
    s += path(mirrorX('M80 116 C78 134 70 146 56 152 C40 158 22 166 8 176 C26 160 52 150 66 140 C74 134 78 126 80 116 Z'), skin[1], 'opacity="0.55"');
    // sternocleidomastoid + trap ridge
    s += line('M86 118 L95 146 M114 118 L105 146', 2, skin[1]);
    s += line('M80 124 C72 142 52 152 26 162', 2.2) + line(mirrorX('M80 124 C72 142 52 152 26 162'), 2.2);
    // delts
    const DELT = 'M0 184 C12 170 36 166 52 178 C64 190 64 214 54 234 L50 240 L0 240 Z';
    s += outlined(DELT, `url(#sk${id})`, 2.4) + outlined(mirrorX(DELT), `url(#sk${id})`, 2.4);
    s += path('M6 190 C16 180 30 176 42 178 C28 184 18 194 12 210 Z', '#fff', 'opacity="0.4"');
    s += path(mirrorX('M6 190 C16 180 30 176 42 178 C28 184 18 194 12 210 Z'), '#fff', 'opacity="0.28"');
    s += line('M34 196 C40 208 40 222 34 234', 1.8, skin[1]) + line(mirrorX('M34 196 C40 208 40 222 34 234'), 1.8, skin[1]);
    // pecs
    const PEC = 'M56 192 C68 182 90 182 100 190 L100 222 C88 232 66 230 54 218 C50 208 50 198 56 192 Z';
    s += outlined(PEC, `url(#sk${id})`, 2.4) + outlined(mirrorX(PEC), `url(#sk${id})`, 2.4);
    s += path('M56 212 C66 224 86 226 100 220 L100 222 C88 232 66 230 54 218 Z', skin[1], 'opacity="0.7"');
    s += path(mirrorX('M56 212 C66 224 86 226 100 220 L100 222 C88 232 66 230 54 218 Z'), skin[1], 'opacity="0.7"');
    s += path('M64 190 C74 186 86 186 92 190 C82 190 72 194 66 198 Z', '#fff', 'opacity="0.35"');
    // stringer (thin straps, deep cut)
    s += outlined('M90 146 C92 176 96 200 96 240 L104 240 C104 200 108 176 110 146 C106 158 94 158 90 146 Z', '#00e07a', 2);
    s += outlined('M86 148 L90 146 C86 180 72 214 60 240 L54 240 C66 214 80 180 86 148 Z', '#00e07a', 1.8);
    s += outlined(mirrorX('M86 148 L90 146 C86 180 72 214 60 240 L54 240 C66 214 80 180 86 148 Z'), '#00e07a', 1.8);
    // veins + sweat shine
    s += line('M22 200 C28 208 24 216 30 226', 1.6, '#9a5d32') + line('M176 204 C170 212 174 220 168 228', 1.6, '#9a5d32');
    s += path('M70 200 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 Z', '#fff', 'opacity="0.85"');
    s += rim('M2 182 C10 170 32 160 58 150');
  }

  // neck
  const neck = {
    skinny: 'M93 132 L93 170 L107 170 L107 132 Z',
    lean: 'M90 132 L90 166 L110 166 L110 132 Z',
    fit: 'M86 130 L86 156 L114 156 L114 130 Z',
    buff: null
  }[build];
  if (neck) {
    s += outlined(neck, `url(#sk${id})`, 2.2);
    s += path(neck.replace(/L(\d+) (\d+) Z$/, 'Z'), skin[1], 'opacity="0.35"');
  }

  // head (skinny = forward head, slightly tilted down)
  const headTf = build === 'skinny' ? 'translate(0 4) rotate(4 100 100)'
    : build === 'buff' ? 'translate(100 128) scale(0.88) translate(-100 -136)' : '';
  s += `<g transform="${headTf}">`;
  s += face({ id, skin, head: build === 'skinny' ? 'thin' : build === 'buff' ? 'square' : 'soft', mood, mouthKind: build === 'buff' ? 'grin' : 'normal', browThick: build === 'buff' ? 4.2 : 3.2 });

  if (build === 'skinny') {
    // messy unstyled hair + round glasses + dark circles
    s += outlined('M64 84 C60 52 78 32 102 32 C124 32 140 50 136 82 C132 70 128 62 120 58 C116 64 110 58 106 52 C100 60 90 56 86 52 C80 60 72 66 66 70 C66 76 64 80 64 84 Z', '#2a221d');
    s += line('M84 40 Q90 34 96 40 M108 38 Q114 32 118 40', 2, '#4b3c32');
    s += `<circle cx="83" cy="93" r="11" fill="#bfe3ff" fill-opacity="0.18" stroke="${INK}" stroke-width="2.4"/><circle cx="117" cy="93" r="11" fill="#bfe3ff" fill-opacity="0.18" stroke="${INK}" stroke-width="2.4"/>`;
    s += line('M94 92 L106 92 M72 91 L66 89 M128 91 L134 89', 2.2);
    s += line('M76 103 Q83 106 90 103 M110 103 Q117 106 124 103', 1.4, '#9b7a8a', 'opacity="0.7"');
  } else {
    // short fade + red headband
    s += outlined('M62 84 C58 50 76 30 100 30 C126 30 142 48 138 84 C136 72 132 64 126 60 C118 64 106 60 98 54 C90 60 78 62 72 60 C68 66 64 76 62 84 Z', '#1c1714');
    s += path('M62 84 L63 100 L67 98 L67 80 Z', '#3a2f28', 'opacity="0.7"') + path(mirrorX('M62 84 L63 100 L67 98 L67 80 Z'), '#3a2f28', 'opacity="0.7"');
    s += line('M84 40 L90 34 M98 38 L104 31 M112 40 L118 34', 2, '#4b3c32');
    s += outlined('M61 70 C80 62 120 62 139 70 L139 80 C120 72 80 72 61 80 Z', '#e8202f', 2.2);
    s += outlined('M137 72 L152 66 L150 76 Z', '#e8202f', 1.8) + outlined('M137 76 L150 84 L142 88 Z', '#c4121f', 1.8);
    if (build === 'buff') {
      // jaw + cheekbone definition
      s += line('M66 108 C70 124 80 136 92 142', 1.6, skin[1]) + line('M134 108 C130 124 120 136 108 142', 1.6, skin[1]);
      s += line('M70 100 Q76 104 80 102 M130 100 Q124 104 120 102', 1.4, skin[1]);
      // stubble + sweat
      s += path('M70 112 C76 132 90 142 100 143 C110 142 124 132 130 112 C122 126 110 134 100 134 C90 134 78 126 70 112 Z', '#3a2a20', 'opacity="0.18"');
      s += outlined('M134 84 C131 90 131 94 134 96 C137 94 137 90 134 84 Z', '#bfefff', 1.4);
    }
  }
  s += `</g>`;
  return wrap(id, skin, build === 'skinny' ? '#5c6778' : '#00ff88', s);
}

// ---------- 한서연 ----------
function drawSeoyeon(mood) {
  const id = `sy${++uid}`;
  const skin = SKIN.seoyeon;
  let s = '';
  // back hair
  s += outlined('M56 90 C48 50 72 26 100 26 C130 26 152 50 144 92 C150 140 148 190 158 232 L42 232 C52 190 50 140 56 90 Z', '#3b2418');
  s += outlined(TORSO.slim, `url(#sk${id})`);
  // blouse + cardigan + lanyard
  s += outlined('M40 240 C42 212 56 196 78 190 L92 172 L100 184 L108 172 L122 190 C144 196 158 212 160 240 Z', '#f4f1ec');
  s += outlined('M40 240 C42 212 56 196 78 190 L86 200 L82 240 Z', '#c9b8d8') + outlined(mirrorX('M40 240 C42 212 56 196 78 190 L86 200 L82 240 Z'), '#c9b8d8');
  s += line('M92 174 L96 222 M108 174 L104 222', 2, '#ff5c8a');
  s += outlined('M90 220 L110 220 L110 238 L90 238 Z', '#ffffff', 1.8) + path('M93 224 L107 224 L107 228 L93 228 Z', '#ff5c8a');
  s += outlined('M92 132 L92 172 L108 172 L108 132 Z', `url(#sk${id})`, 2.2);
  s += face({ id, skin, head: 'soft', mood, eyeStyle: 'lashes', iris: '#5a3020', browColor: '#3b2418', browThick: 2.6 });
  s += `<ellipse cx="72" cy="108" rx="7" ry="3.5" fill="#ff8aa6" opacity="0.3"/><ellipse cx="128" cy="108" rx="7" ry="3.5" fill="#ff8aa6" opacity="0.3"/>`;
  // lips tint
  if (mood !== 'shock' && mood !== 'happy') s += line('M93 119 Q100 122 107 119', 3, '#e46a7f', 'opacity="0.55"');
  // bangs
  s += outlined('M62 86 C60 50 80 32 104 32 C126 32 142 48 138 84 C132 66 120 56 104 54 C98 68 82 78 62 86 Z', '#4a2d1e');
  s += path('M78 46 C90 38 108 36 122 42 C108 40 92 42 80 50 Z', '#fff', 'opacity="0.25"');
  // earrings
  s += `<circle cx="62" cy="108" r="2.6" fill="#ffd36b" stroke="${INK}" stroke-width="1.2"/><circle cx="138" cy="108" r="2.6" fill="#ffd36b" stroke="${INK}" stroke-width="1.2"/>`;
  return wrap(id, skin, '#ff9ecb', s);
}

// ---------- 강철구 관장 ----------
function drawBoss(mood) {
  const id = `bs${++uid}`;
  const skin = SKIN.boss;
  let s = '';
  s += outlined(TORSO.fit, `url(#sk${id})`);
  s += outlined('M18 240 C20 202 38 184 66 176 C78 172 84 166 86 158 Q100 170 114 158 C116 166 122 172 134 176 C162 184 180 202 182 240 Z', '#16181d');
  s += `<text x="100" y="224" text-anchor="middle" font-family="Teko, Arial Narrow, sans-serif" font-size="18" fill="#ffaa00" letter-spacing="2">철인짐</text>`;
  // towel over shoulder
  s += outlined('M128 176 C146 180 164 190 172 204 L160 214 C150 200 138 192 124 188 Z', '#f2f2f2', 2);
  s += line('M134 182 C146 186 156 194 164 206', 1.4, '#c9c9c9');
  // whistle on cord
  s += line('M90 160 Q86 190 96 206 M110 160 Q114 190 104 206', 1.6, '#ff3b3b');
  s += outlined('M94 204 L108 204 L110 212 L92 212 Z', '#c0c6cf', 1.8);
  s += outlined('M84 128 L84 160 L116 160 L116 128 Z', `url(#sk${id})`, 2.2);
  s += face({ id, skin, head: 'square', mood, eyeStyle: 'narrow', iris: '#2a1a10', browColor: '#9a9a9a', browThick: 4.6 });
  // grey sides, bald shiny top
  s += outlined('M61 96 C58 80 62 66 70 60 L74 63 C68 74 68 86 70 98 Z', '#a7a7a7', 2);
  s += outlined(mirrorX('M61 96 C58 80 62 66 70 60 L74 63 C68 74 68 86 70 98 Z'), '#a7a7a7', 2);
  s += path('M82 46 C92 40 110 40 120 46 C108 44 94 44 84 50 Z', '#fff', 'opacity="0.45"');
  // stubble beard + mustache
  s += path('M66 108 C70 132 86 146 100 146 C114 146 130 132 134 108 C128 124 114 134 100 134 C86 134 72 124 66 108 Z', '#8d8d8d', 'opacity="0.6"');
  s += outlined('M83 115 C89 108 97 110 100 113 C103 110 111 108 117 115 C112 121 104 119 100 117 C96 119 88 121 83 115 Z', '#b3b3b3', 1.8);
  // scar
  s += line('M80 72 L86 86', 2, '#e9b08a') + line('M79 76 L84 75 M81 81 L86 80', 1.2, '#e9b08a');
  return wrap(id, skin, '#ffaa00', s);
}

// ---------- 미숙 이모 ----------
function drawAunt(mood) {
  const id = `au${++uid}`;
  const skin = SKIN.aunt;
  let s = '';
  s += outlined(TORSO.normal, `url(#sk${id})`);
  s += outlined('M30 240 C32 206 48 188 72 182 L90 168 L100 180 L110 168 L128 182 C152 188 168 206 170 240 Z', '#ff8fb8');
  s += outlined('M30 240 C32 206 48 188 72 182 L82 192 L80 240 Z', '#8a5cc7') + outlined(mirrorX('M30 240 C32 206 48 188 72 182 L82 192 L80 240 Z'), '#8a5cc7');
  s += outlined('M52 206 L74 206 L74 220 L52 220 Z', '#fff', 1.6);
  s += `<text x="63" y="217" text-anchor="middle" font-family="Montserrat, sans-serif" font-weight="900" font-size="9" fill="#8a5cc7">미숙</text>`;
  s += outlined('M88 130 L88 168 L112 168 L112 130 Z', `url(#sk${id})`, 2.2);
  // curls behind
  const curls = [[66, 62], [78, 46], [94, 38], [110, 38], [124, 46], [136, 60], [140, 78], [60, 80]];
  s += curls.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="15" fill="#9b8aa6" stroke="${INK}" stroke-width="2.2"/>`).join('');
  s += face({ id, skin, head: 'round', mood: mood === 'normal' ? 'happy' : mood, iris: '#3b2414', browColor: '#6b5a76', browThick: 3 });
  // front curls
  s += [[76, 54], [92, 48], [108, 48], [124, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#ad9cb8" stroke="${INK}" stroke-width="2"/>`).join('');
  s += path('M82 44 C88 40 96 40 100 44', '#fff', 'opacity="0.4"');
  // glasses
  s += `<rect x="71" y="85" width="24" height="17" rx="7" fill="#fff" fill-opacity="0.12" stroke="#c43b7a" stroke-width="2.6"/>`;
  s += `<rect x="105" y="85" width="24" height="17" rx="7" fill="#fff" fill-opacity="0.12" stroke="#c43b7a" stroke-width="2.6"/>`;
  s += line('M95 92 L105 92', 2.4, '#c43b7a');
  return wrap(id, skin, '#c9a7ff', s);
}

// ---------- 박태산 ----------
function drawTaesan(mood) {
  const id = `ts${++uid}`;
  const skin = SKIN.taesan;
  let s = '';
  s += outlined(TORSO.fit, `url(#sk${id})`);
  // tight white deep-V tee
  s += outlined('M18 240 C20 202 38 184 66 176 C78 172 84 164 86 156 L100 200 L114 156 C116 164 122 172 134 176 C162 184 180 202 182 240 Z', '#f6f6f6');
  s += line('M60 200 Q66 216 62 236 M140 200 Q134 216 138 236', 1.6, '#c9c9c9');
  s += path('M86 156 L100 200 L114 156 Z', `url(#sk${id})`);
  s += line('M90 176 Q100 186 110 176', 1.6, skin[1]);
  // gold chain
  s += line('M86 160 Q100 196 114 160', 3, '#f0c040') + `<circle cx="100" cy="183" r="4" fill="#f0c040" stroke="${INK}" stroke-width="1.4"/>`;
  s += outlined('M86 128 L86 158 L114 158 L114 128 Z', `url(#sk${id})`, 2.2);
  s += face({ id, skin, head: 'square', mood: mood === 'normal' ? 'smug' : mood, iris: '#2a1a10', browThick: 3.6 });
  // pompadour + undercut
  s += path('M62 92 L62 76 L70 70 L70 94 Z', '#7a6a60', 'opacity="0.8"') + path(mirrorX('M62 92 L62 76 L70 70 L70 94 Z'), '#7a6a60', 'opacity="0.8"');
  s += outlined('M64 76 C58 50 72 22 106 18 C134 16 150 34 144 60 C142 68 140 72 136 76 C134 62 124 52 110 50 C96 48 80 56 64 76 Z', '#2d1e16');
  s += path('M84 30 C100 22 122 22 136 32 C120 28 102 28 88 36 Z', '#fff', 'opacity="0.35"');
  // aviator shades (eyes hidden unless shocked)
  if (mood !== 'shock') {
    s += outlined('M70 86 L94 86 L92 100 C88 106 76 106 72 100 Z', '#1a1f2b', 2.2) + outlined('M106 86 L130 86 L128 100 C124 106 112 106 108 100 Z', '#1a1f2b', 2.2);
    s += line('M94 88 Q100 85 106 88', 2.2) + path('M74 89 L84 89 L76 98 Z', '#7ad7ff', 'opacity="0.45"') + path('M110 89 L120 89 L112 98 Z', '#7ad7ff', 'opacity="0.45"');
  } else {
    s += outlined('M70 74 L94 74 L92 82 C88 86 76 86 72 82 Z', '#1a1f2b', 2) + outlined('M106 74 L130 74 L128 82 C124 86 112 86 108 82 Z', '#1a1f2b', 2);
  }
  s += `<circle cx="139" cy="106" r="2.8" fill="#f0c040" stroke="${INK}" stroke-width="1.2"/>`;
  return wrap(id, skin, '#ff5c5c', s);
}

// ---------- 마동수 (곰) ----------
function drawDongsu(mood) {
  const id = `ds${++uid}`;
  const skin = SKIN.dongsu;
  let s = '';
  s += outlined(TORSO.big, '#7d8794');
  s += outlined('M70 166 C74 184 88 192 100 192 C112 192 126 184 130 166 Z', '#6a7380', 2);
  s += line('M90 192 L88 220 M110 192 L112 220', 2.2, '#f2f2f2');
  s += `<circle cx="88" cy="222" r="3" fill="#f2f2f2"/><circle cx="112" cy="222" r="3" fill="#f2f2f2"/>`;
  s += outlined('M60 214 L140 214 L136 240 L64 240 Z', '#6a7380', 2);
  s += outlined('M82 130 L80 168 L120 168 L118 130 Z', `url(#sk${id})`, 2.2);
  s += face({ id, skin, head: 'round', mood, eyeStyle: 'gentle', browColor: '#3b2414', browThick: 4.4 });
  // full beard
  s += outlined('M62 100 C62 130 80 152 100 154 C120 152 138 130 138 100 C132 114 120 122 100 124 C80 122 68 114 62 100 Z', '#4a2f1f', 2.2);
  s += path('M90 118 C94 114 106 114 110 118 C106 122 94 122 90 118 Z', '#4a2f1f');
  if (mood === 'shock') s += `<ellipse cx="100" cy="128" rx="5" ry="6" fill="#7a2323" stroke="${INK}" stroke-width="2"/>`;
  else if (mood === 'happy' || mood === 'blush') s += line('M92 127 Q100 133 108 127', 2.4, '#f2c4a0');
  // knit beanie with pom-pom
  s += outlined('M58 78 C58 42 78 26 100 26 C122 26 142 42 142 78 L142 84 L58 84 Z', '#b5651d');
  s += outlined('M56 72 L144 72 L144 86 L56 86 Z', '#9a5216', 2);
  s += [66, 76, 86, 96, 106, 116, 126, 136].map(x => line(`M${x} 74 L${x} 84`, 1.4, '#7a400f')).join('');
  s += `<circle cx="100" cy="22" r="10" fill="#e9d3b4" stroke="${INK}" stroke-width="2"/>`;
  return wrap(id, skin, '#d4a373', s);
}

// ---------- 레오 ----------
function drawLeo(mood) {
  const id = `le${++uid}`;
  const skin = SKIN.leo;
  let s = '';
  // bare glossy competition physique
  s += outlined(TORSO.fit, `url(#sk${id})`);
  s += line('M58 204 C76 220 94 220 100 210', 2.4) + line('M142 204 C124 220 106 220 100 210', 2.4);
  s += line('M100 210 L100 240 M90 226 L110 226', 1.6, skin[1]);
  s += path('M30 198 C38 184 52 178 64 178 C50 188 42 200 38 216 Z', '#fff', 'opacity="0.35"');
  s += path(mirrorX('M30 198 C38 184 52 178 64 178 C50 188 42 200 38 216 Z'), '#fff', 'opacity="0.3"');
  s += path('M72 200 C80 196 88 198 92 204 C84 202 78 202 72 206 Z', '#fff', 'opacity="0.4"');
  // contest number
  s += outlined('M112 220 L138 216 L140 236 L114 240 Z', '#ffffff', 1.6);
  s += `<text x="126" y="234" text-anchor="middle" font-family="Teko, Arial Narrow, sans-serif" font-size="16" fill="#1d1512" transform="rotate(-8 126 230)">17</text>`;
  s += outlined('M86 128 L86 156 L114 156 L114 128 Z', `url(#sk${id})`, 2.2);
  s += face({ id, skin, head: 'soft', mood: mood === 'normal' ? 'smug' : mood, eyeStyle: 'lashes', iris: '#1a120c', browColor: '#2a1a10', browThick: 2.4 });
  // styled wavy hair with blond tips
  s += outlined('M62 84 C56 52 76 28 104 28 C130 28 146 46 140 80 C136 66 130 58 120 54 C124 62 118 66 112 60 C108 66 100 66 96 58 C90 66 80 66 76 60 C70 66 64 74 62 84 Z', '#2a1a10');
  s += path('M84 36 C96 30 116 30 128 38 C118 36 108 40 100 46 C96 40 90 38 84 40 Z', '#e8c060');
  s += path('M100 34 C108 32 116 34 122 38', '#fff', 'opacity="0.4"');
  // earrings + sparkle
  s += `<circle cx="61" cy="108" r="3" fill="#e6f2ff" stroke="${INK}" stroke-width="1.2"/><circle cx="139" cy="108" r="3" fill="#e6f2ff" stroke="${INK}" stroke-width="1.2"/>`;
  s += path('M160 60 L163 70 L173 73 L163 76 L160 86 L157 76 L147 73 L157 70 Z', '#ffffff', 'opacity="0.9"');
  s += path('M40 120 L42 126 L48 128 L42 130 L40 136 L38 130 L32 128 L38 126 Z', '#ffffff', 'opacity="0.7"');
  return wrap(id, skin, '#5ce1e6', s);
}

// ---------- 사회자 ----------
function drawMC(mood) {
  const id = `mc${++uid}`;
  const skin = SKIN.mc;
  let s = '';
  s += outlined(TORSO.normal, '#1f2a44');
  s += outlined('M84 160 L100 200 L116 160 L110 156 L100 172 L90 156 Z', '#ffffff', 2);
  s += outlined('M30 240 C32 206 48 188 72 182 L86 160 L100 200 L92 240 Z', '#26335a', 2) + outlined(mirrorX('M30 240 C32 206 48 188 72 182 L86 160 L100 200 L92 240 Z'), '#26335a', 2);
  s += outlined('M88 164 L100 170 L112 164 L112 176 L100 170 L88 176 Z', '#e8202f', 1.8);
  s += outlined('M88 130 L88 162 L112 162 L112 130 Z', `url(#sk${id})`, 2.2);
  s += face({ id, skin, head: 'square', mood: mood === 'normal' ? 'happy' : mood, iris: '#2a1a10', browThick: 3.2 });
  // slick side part
  s += outlined('M62 84 C58 50 78 32 104 32 C128 32 144 48 138 84 C134 64 120 52 96 50 C84 56 70 66 62 84 Z', '#151b2b');
  s += path('M90 40 C104 34 122 36 132 46 C118 42 104 42 92 46 Z', '#fff', 'opacity="0.35"');
  // microphone
  s += outlined('M146 150 L160 132 L170 140 L156 158 Z', '#30343c', 2);
  s += `<circle cx="168" cy="128" r="12" fill="#5d6470" stroke="${INK}" stroke-width="2.2"/>`;
  s += line('M160 122 L176 134 M162 118 L174 126 M158 128 L172 138', 1.2, '#2a2e35');
  s += outlined('M136 168 C134 156 142 148 152 150 C158 154 158 164 150 170 Z', `url(#sk${id})`, 2);
  return wrap(id, skin, '#c4d1e2', s);
}

const DRAW = {
  me: drawMe, seoyeon: drawSeoyeon, boss: drawBoss, aunt: drawAunt,
  taesan: drawTaesan, dongsu: drawDongsu, leo: drawLeo, mc: drawMC
};

const cache = new Map();

export function portrait(who, mood = 'normal', opts = {}) {
  const fn = DRAW[who];
  if (!fn) return '';
  const build = opts.build || 'buff';
  const bg = opts.bg !== false;
  const key = `${who}|${mood}|${who === 'me' ? build : ''}|${bg}`;
  if (!cache.has(key)) {
    withBg = bg;
    cache.set(key, fn(mood, build));
    withBg = true;
  }
  return cache.get(key);
}

// Protagonist body by chapter: 1 멸치 → 2 입문 → 3 근육 → 4~5 헬창
export function buildForChapter(chapterId) {
  if (chapterId <= 1) return 'skinny';
  if (chapterId === 2) return 'lean';
  if (chapterId === 3) return 'fit';
  return 'buff';
}

// Expression from the line itself (explicit mood wins)
export function inferMood(who, text, explicit) {
  if (explicit) return explicit;
  const t = text || '';
  if (/!!!|\?!|!\?|오해|말도 안|어, 어떻게|대회요|이모!!/.test(t)) return 'shock';
  if (/울먹|\(울|눈물|ㅠ/.test(t)) return 'sad';
  if (/♡|~$|~\)|반하/.test(t)) return who === 'dongsu' || who === 'seoyeon' ? 'blush' : 'smug';
  if (/흥|쳇|하,|반올림|아깝다/.test(t)) return 'smug';
  if (/귀가 빨개|얼굴 붉|화이팅|응원/.test(t) && (who === 'dongsu' || who === 'seoyeon')) return 'blush';
  if (/뽑아|밀어|집중|시끄럽|금지|집에 보낸|끝\./.test(t) && (who === 'boss')) return 'angry';
  if (/해냈|성공|우승|축하|최고|잘했|좋아|굿 리프트|꺄악|와\.\.\.|멋있/.test(t)) return 'happy';
  if (/^\(/.test(t) && who === 'me') return 'think';
  if (/!!$|!$/.test(t) && who === 'me') return 'angry';
  return 'normal';
}
