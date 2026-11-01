// Дизеринг и зерно в духе 256-цветных игр 1996 года.
// Чистый модуль: всё считается от координат пикселя, без Math.random,
// поэтому кадр детерминирован и тестируем.

// Матрица Байера 4×4, значения 0..15.
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Порог дизера для пикселя, нормализованный в [-0.5, 0.5).
export function bayerOffset(x, y, strength = 1) {
  const v = BAYER4[y & 3][x & 3] / 16 - 0.5;
  return v * strength;
}

// Квантование канала с дизером. levels — число уровней (например, 6).
// Возвращает целое 0..255 без выхода за границы.
export function quantize(value, levels, x, y, strength = 1) {
  if (!Number.isFinite(value)) return 0;
  const safeLevels = Math.max(2, Math.floor(levels) || 2);
  const step = 255 / (safeLevels - 1);
  const wobble = bayerOffset(x, y, strength) * step;
  const scaled = (value + wobble) / step;
  const level = Math.round(scaled);
  const clamped = Math.max(0, Math.min(safeLevels - 1, level));
  return Math.round(clamped * step);
}

// Дизер для трёх каналов сразу: смещение Байера одно и то же,
// поэтому нет смысла считать его трижды.
export function quantize3(r, g, b, levels, x, y, strength, out) {
  const safeLevels = Math.max(2, Math.floor(levels) || 2);
  const step = 255 / (safeLevels - 1);
  const wobble = bayerOffset(x, y, strength) * step;

  const q = (v) => {
    if (!Number.isFinite(v)) return 0;
    const level = Math.round((v + wobble) / step);
    return Math.round(Math.max(0, Math.min(safeLevels - 1, level)) * step);
  };

  out[0] = q(r);
  out[1] = q(g);
  out[2] = q(b);
  return out;
}

// Таблицы для горячего цикла пола. quantize() вызывается на каждый пиксель
// трижды, и два Math.round плюс двумерный BAYER4 съедали больше времени,
// чем весь остальной рендер. Здесь все константы считаются один раз.
//   wobble — 16 смещений Байера (по strength и step)
//   lut    — уровень → значение канала
export function makeQuantTables(levels, strength = 1) {
  const safeLevels = Math.max(2, Math.floor(levels) || 2);
  const step = 255 / (safeLevels - 1);

  const wobble = new Float32Array(16);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      wobble[(y << 2) | x] = (BAYER4[y][x] / 16 - 0.5) * strength * step;
    }
  }

  const lut = new Float32Array(safeLevels);
  for (let i = 0; i < safeLevels; i++) lut[i] = Math.round(i * step);

  return { wobble, lut, levels: safeLevels, maxLevel: safeLevels - 1, step, inv: 1 / step };
}

// Один канал по готовым таблицам: без делений, без Math.round.
export function quantizeFast(value, tables, x, y) {
  if (!Number.isFinite(value)) return 0;
  const w = tables.wobble[((y & 3) << 2) | (x & 3)];
  // Умножение на обратный шаг вместо деления; +0.5 и | 0 — округление.
  let level = ((value + w) * tables.inv + 0.5) | 0;
  if (level < 0) level = 0;
  else if (level > tables.maxLevel) level = tables.maxLevel;
  return tables.lut[level];
}

// Детерминированное зерно: хеш от координат и канала.
// Возвращает смещение в диапазоне примерно [-amount, amount].
export function grain(x, y, channel = 0, amount = 3) {
  let h = (x * 374761393 + y * 668265263 + channel * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  const t = (h & 0xffff) / 0xffff; // 0..1
  return (t * 2 - 1) * amount;
}

// Лёгкое зерно для финального прохода. Без него картинка «слишком чистая».
export function applyGrain(channel, x, y, index, amount = 2.5) {
  return clampChannel(channel + grain(x, y, index, amount));
}

export function clampChannel(value) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return value | 0;
}

// Виньетка: множитель яркости по расстоянию от центра, 0..1.
// centerX/centerY — нормированные координаты центра (0..1).
export function vignette(x, y, width, height, strength = 0.35) {
  const nx = (x / width - 0.5) * 2;
  const ny = (y / height - 0.5) * 2;
  const d = Math.sqrt(nx * nx + ny * ny) / Math.SQRT2;
  return 1 - Math.min(1, d * d) * strength;
}

// Ambien occlusion для стены: темнее у пола.
// t — доля высоты сверху (0) до низа (1).
export function wallOcclusion(t, strength = 0.35) {
  const clamped = Math.max(0, Math.min(1, t));
  // Вверху 1.0, внизу 1 - strength. Линейно.
  return 1 - clamped * strength;
}

// Подмес «мутного сумрака»: оливковый оттенок в тенях.
// tint — [r,g,b], amount 0..1.
export const MURK_TINT = [58, 61, 42];

export function murk(r, g, b, amount = 0.18) {
  const a = Math.max(0, Math.min(1, amount));
  return [
    r * (1 - a) + MURK_TINT[0] * a,
    g * (1 - a) + MURK_TINT[1] * a,
    b * (1 - a) + MURK_TINT[2] * a,
  ];
}

// То же, но без массива: вызывается на каждый пиксель пола.
// murk() оставлен для тестов и читаемости, murkInto — для горячего цикла.
export function murkInto(out, r, g, b, amount = 0.18) {
  const a = Math.max(0, Math.min(1, amount));
  out[0] = r * (1 - a) + MURK_TINT[0] * a;
  out[1] = g * (1 - a) + MURK_TINT[1] * a;
  out[2] = b * (1 - a) + MURK_TINT[2] * a;
  return out;
}
