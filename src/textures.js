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
    if (rand2(x, y, 63) > 0.96) return [110 + n, 88 + n, 58 + n];
    return [86 + patch + n, 66 + patch + n, 42 + patch * 0.7 + n];
  }, 61);
}

export function buildTextures() {
  return {
    walls: {
      1: brickTexture(),
      2: woodTexture(),
      3: stoneTexture(),
    },
    floors: {
      0: grassTexture(),
      4: roadTexture(),
      5: dirtTexture(),
    },
  };
}
