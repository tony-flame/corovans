// Процедурные текстуры: без внешних ассетов, детерминированный шум.
export const TEX_SIZE = 64;

function pack(r, g, b) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

export function rand2(x, y, seed = 1) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function makeTexture(fn, seed = 1) {
  const data = new Uint32Array(TEX_SIZE * TEX_SIZE);
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const c = fn(x, y, seed);
      data[y * TEX_SIZE + x] = pack(clamp255(c[0]), clamp255(c[1]), clamp255(c[2]));
    }
  }
  return data;
}

function brickTexture() {
  return makeTexture((x, y) => {
    const row = (y / 8) | 0;
    const offset = (row & 1) * 8;
    const bx = (x + offset) % 16;
    const by = y % 8;
    const n = rand2(x, y, 11) * 18 - 9;
    if (by === 0 || bx === 0) {
      const m = rand2(x, y, 12) * 10 - 5;
      return [56 + m, 48 + m, 40 + m];
    }
    const brick = rand2((x + offset) / 16 | 0, row, 13);
    const base = 98 + brick * 28 + n;
    return [base, base * 0.48 + n * 0.4, base * 0.34 + n * 0.3];
  }, 11);
}

function woodTexture() {
  return makeTexture((x, y) => {
    const plank = (x / 8) | 0;
    const localX = x % 8;
    const grain = rand2(x, y >> 1, 21) * 16 - 8;
    const pv = rand2(plank, 0, 22) * 18 - 9;
    if (localX === 0) {
      return [34 + grain * 0.3, 24, 14];
    }
    const base = 86 + pv + grain;
    return [base, base * 0.62, base * 0.36];
  }, 21);
}

function stoneTexture() {
  return makeTexture((x, y) => {
    const row = (y / 12) | 0;
    const offset = (row & 1) * 10;
    const bx = (x + offset) % 20;
    const by = y % 12;
    const n = rand2(x, y, 31) * 20 - 10;
    if (by === 0 || bx === 0) {
      return [44 + n * 0.3, 43 + n * 0.3, 40 + n * 0.3];
    }
    const block = rand2((x + offset) / 20 | 0, row, 32);
    const base = 82 + block * 34 + n;
    return [base, base * 0.98, base * 0.9];
  }, 31);
}

function grassTexture() {
  return makeTexture((x, y) => {
    const patch = rand2(x >> 2, y >> 2, 41) * 16 - 8;
    const n = rand2(x, y, 42) * 14 - 7;
    if (rand2(x, y, 43) > 0.975) {
      return [66 + n, 94 + n, 42 + n];
    }
    return [40 + patch + n, 64 + patch + n, 32 + patch * 0.6 + n];
  }, 41);
}

function roadTexture() {
  return makeTexture((x, y) => {
    const patch = rand2(x >> 2, y >> 2, 51) * 14 - 7;
    const n = rand2(x, y, 52) * 18 - 9;
    const r = rand2(x, y, 53);
    if (r > 0.965) return [64 + n, 60 + n, 52 + n];
    if (r > 0.93) return [122 + n, 112 + n, 94 + n];
    return [92 + patch + n, 84 + patch + n, 70 + patch * 0.8 + n];
  }, 51);
}

function dirtTexture() {
  return makeTexture((x, y) => {
    const patch = rand2(x >> 2, y >> 2, 61) * 16 - 8;
    const n = rand2(x, y, 62) * 16 - 8;
    // Грязь и следы: пятна темнее, редкие камешки светлее.
    const stain = rand2(x >> 3, y >> 3, 64) > 0.82 ? -14 : 0;
    if (rand2(x, y, 63) > 0.96) return [110 + n, 88 + n, 58 + n];
    return [86 + patch + n + stain, 66 + patch + n + stain, 42 + patch * 0.7 + n + stain];
  }, 61);
}

// Штукатурка с фахверком: светлая стена и тёмные балки.
function plasterTexture() {
  return makeTexture((x, y) => {
    const n = rand2(x, y, 71) * 14 - 7;
    // Балки: горизонталь по верху, вертикали через каждые 21 px.
    const beam = y < 5 || y > 58 || x % 21 < 3;
    if (beam) return [52 + n * 0.4, 38 + n * 0.4, 26 + n * 0.4];
    // Штукатурка: тёплая, но не белая — иначе стена сливается с фоном.
    const patch = rand2(x >> 3, y >> 3, 72) * 14 - 7;
    const moss = y > 52 ? 12 : 0;
    return [
      146 + patch + n - moss,
      134 + patch + n - moss,
      112 + patch + n - moss * 1.4,
    ];
  }, 71);
}

// Булыжник: круглая мостовая, темнее обычной дороги.
function cobbleTexture() {
  return makeTexture((x, y) => {
    const cx = (x / 11) | 0;
    const cy = (y / 9) | 0;
    const ox = (cx & 1) * 5;
    const px = (x + ox) % 11;
    const py = y % 9;
    const n = rand2(x, y, 81) * 16 - 8;
    const seam = px < 2 || py < 2;
    if (seam) return [38 + n * 0.4, 36 + n * 0.4, 32 + n * 0.4];
    const stone = rand2(cx, cy, 82);
    const base = 74 + stone * 30 + n;
    return [base, base * 0.97, base * 0.92];
  }, 81);
}

// Солома: жёлто-коричневые стебли.
function thatchTexture() {
  return makeTexture((x, y) => {
    const strand = rand2(x, y >> 2, 91) * 26 - 13;
    const n = rand2(x, y, 92) * 12 - 6;
    return [138 + strand + n, 112 + strand * 0.8 + n, 62 + strand * 0.5 + n];
  }, 91);
}

// Тёмное дерево для сараев: доски с щелями.
function woodDarkTexture() {
  return makeTexture((x, y) => {
    const plank = (x / 9) | 0;
    const gap = x % 9 < 1;
    const grain = rand2(plank, y >> 2, 101) * 18 - 9;
    const n = rand2(x, y, 102) * 10 - 5;
    if (gap) return [26 + n, 19 + n, 13 + n];
    const base = 66 + grain + n;
    return [base, base * 0.72, base * 0.48];
  }, 101);
}

// Фахверк: кирпичное заполнение с тёмным каркасом.
// Стойки каждые 24 px, ригель один, раскосы только в нижней трети.
// Частый каркас с широкими панелями читался как решётка, а не стена.
function fachwerkFrame(x, y) {
  const post = x % 24 < 3;
  const rail = y >= 30 && y <= 32;
  const braceTop = Math.abs((x % 24) - (y % 24)) < 3 && y > 34;
  const braceBottom = Math.abs((x % 24) - (24 - (y % 24))) < 3 && y > 34;
  return post || rail || braceTop || braceBottom;
}

function brickFrameTexture() {
  return makeTexture((x, y) => {
    const n = rand2(x, y, 111) * 14 - 7;
    if (fachwerkFrame(x, y)) {
      // Тёмные дубовые балки с продольной текстурой.
      const wood = rand2(x >> 1, y, 112) * 16 - 8;
      return [46 + wood * 0.5 + n * 0.3, 34 + wood * 0.4 + n * 0.3, 22 + wood * 0.3 + n * 0.3];
    }
    // Кирпичная кладка между балками.
    const row = (y / 8) | 0;
    const offset = (row & 1) * 8;
    const bx = (x + offset) % 16;
    const by = y % 8;
    if (bx === 0 || by === 0) return [52 + n * 0.4, 40 + n * 0.4, 34 + n * 0.4];
    const brick = rand2((x + offset) / 16 | 0, row, 113);
    const base = 108 + brick * 40 + n;
    return [base, base * 0.55, base * 0.42];
  }, 111);
}

function plasterFrameTexture() {
  return makeTexture((x, y) => {
    const n = rand2(x, y, 121) * 14 - 7;
    if (fachwerkFrame(x, y)) {
      const wood = rand2(x >> 1, y, 122) * 16 - 8;
      return [44 + wood * 0.5 + n * 0.3, 32 + wood * 0.4 + n * 0.3, 21 + wood * 0.3 + n * 0.3];
    }
    // Штукатурка: землистая, тёмная. Светлая на дистанции читается
    // как стекло, потому что сливается с небом.
    const patch = rand2(x >> 3, y >> 3, 123) * 18 - 9;
    const moss = y > 50 ? 14 : 0;
    const dirt = rand2(x >> 2, y >> 3, 124) > 0.8 ? -14 : 0;
    return [
      96 + patch + n - moss + dirt,
      86 + patch + n - moss + dirt,
      68 + patch + n - moss * 1.3 + dirt,
    ];
  }, 121);
}

// Затемнение к нижней кромке тайла — фейковое AO прямо в текстуре.
// Работает с упакованным Uint32Array (формат pack(r,g,b)).
function withBaseShadow(data, size = TEX_SIZE, strength = 0.34) {
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    if (t <= 0.68) continue;
    const dark = 1 - (t - 0.68) * strength * 1.6;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const i = row + x;
      const c = data[i];
      const r = (c & 255) * dark;
      const g = ((c >> 8) & 255) * dark;
      const b = ((c >> 16) & 255) * dark;
      data[i] = pack(clamp255(r), clamp255(g), clamp255(b));
    }
  }
  return data;
}

export function buildTextures() {
  return {
    walls: {
      1: withBaseShadow(brickTexture()),
      2: withBaseShadow(woodTexture()),
      3: withBaseShadow(stoneTexture()),
      // Фахверк: кирпич и штукатурка с тёмным каркасом.
      6: withBaseShadow(brickFrameTexture()),
      7: withBaseShadow(plasterFrameTexture()),
      // Новые материалы для разнообразия фасадов и сараев.
      plaster: withBaseShadow(plasterTexture()),
      thatch: withBaseShadow(thatchTexture(), TEX_SIZE, 0.22),
      woodDark: withBaseShadow(woodDarkTexture()),
    },
    floors: {
      0: grassTexture(),
      4: roadTexture(),
      5: dirtTexture(),
      cobble: cobbleTexture(),
    },
  };
}
