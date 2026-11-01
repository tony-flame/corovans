// Погода: дождь выводится из сида рана и остаётся стабильным.
// Чистый модуль: детерминированно, без Math.random и DOM.
//
// Правило: перезагрузка с чекпоинта не должна давать «сделать сухо»,
// поэтому погода зависит только от runSeed, а не от текущего времени.

import { createRng, hashSeed } from "./rng.js";

export const WEATHER = {
  CLEAR: "clear",
  DRIZZLE: "drizzle",
  RAIN: "rain",
  STORM: "storm",
  SNOW: "snow",
};

// Доли вероятностей. Дождь должен быть заметным событием, а не фоном.
const ODDS = [
  { value: WEATHER.CLEAR, weight: 0.34 },
  { value: WEATHER.DRIZZLE, weight: 0.24 },
  { value: WEATHER.RAIN, weight: 0.22 },
  { value: WEATHER.STORM, weight: 0.09 },
  { value: WEATHER.SNOW, weight: 0.11 },
];

const INTENSITY = {
  clear: 0,
  drizzle: 0.35,
  rain: 0.7,
  storm: 1,
  snow: 0.65,
};

const LABELS = {
  clear: "ясно",
  drizzle: "моросит",
  rain: "дождь",
  storm: "гроза",
  snow: "снег",
};

export function isSnow(weather) {
  return Boolean(weather && weather.kind === WEATHER.SNOW);
}

export function isWet(weather) {
  return Boolean(weather && weather.intensity > 0.01);
}

export function weatherLabel(weather) {
  if (!weather) return LABELS.clear;
  return LABELS[weather.kind] || LABELS.clear;
}

// Погода забега. Один и тот же сид всегда даёт один и тот же дождь.
export function createWeather(runSeed) {
  const rng = createRng(hashSeed(`${runSeed}:weather`));
  const roll = rng();

  let acc = 0;
  let kind = WEATHER.CLEAR;
  for (const entry of ODDS) {
    acc += entry.weight;
    if (roll <= acc) {
      kind = entry.value;
      break;
    }
  }

  const wind = (rng() * 2 - 1) * 0.6;
  const base = INTENSITY[kind];

  return {
    kind,
    targetKind: kind,
    intensity: base,
    target: base,
    wind,
    // Фаза для анимации капель: детерминированная, но разная у забегов.
    phase: rng() * 1000,
    seed: hashSeed(`${runSeed}:weather`),
    raining: base > 0.01,
  };
}

// Плавный вход/выход: погода не должна щёлкать.
export function stepWeather(weather, dt) {
  if (!weather) return weather;

  const target = weather.target !== undefined ? weather.target : weather.intensity;
  // Переход заметно быстрее прежнего: за 1.5 секунды погода успевает смениться.
  const speed = 1.4;
  if (Math.abs(weather.intensity - target) <= speed * dt) {
    weather.intensity = target;
  } else {
    weather.intensity += Math.sign(target - weather.intensity) * speed * dt;
  }
  weather.raining = weather.intensity > 0.01;

  // Снег сохраняется, пока цель — снег: иначе он превратится в «дождь»
  // при первом же пересчёте по интенсивности. Проверка по targetKind,
  // а не по intensity: снег может начаться с нуля и только набирать силу.
  if (weather.targetKind === WEATHER.SNOW && weather.intensity > 0.001) {
    weather.kind = WEATHER.SNOW;
  } else {
    weather.kind = kindFromIntensity(weather.intensity);
  }
  return weather;
}

export function kindFromIntensity(intensity) {
  if (intensity <= 0.01) return WEATHER.CLEAR;
  if (intensity < 0.45) return WEATHER.DRIZZLE;
  if (intensity < 0.85) return WEATHER.RAIN;
  return WEATHER.STORM;
}

// Смена погоды: цель и вид задаются сразу, чтобы UI не показывал
// старую погоду, пока идёт плавный переход. Если игра на паузе
// (например, открыта консоль), переход не тикает — поэтому ставим
// и текущую интенсивность, иначе снег не появится до снятия паузы.
export function setWeather(weather, kind) {
  if (!weather) return weather;
  const target = INTENSITY[kind] !== undefined ? INTENSITY[kind] : 0;
  weather.target = target;
  weather.targetKind = kind;
  if (target > 0) {
    weather.kind = kind;
    weather.intensity = target;
    weather.raining = true;
  }
  return weather;
}

// Насколько темнее небо и плотнее туман.
export function skyTint(weather) {
  const i = weather ? Math.max(0, Math.min(1, weather.intensity)) : 0;
  const snow = isSnow(weather);
  return {
    dim: 1 - i * (snow ? 0.14 : 0.22),
    fogBoost: 1 + i * (snow ? 1.3 : 0.9),
    grey: i * (snow ? 0.45 : 0.35),
    cold: snow ? i : 0,
  };
}

// Сколько капель рисовать на кадр.
export function dropCount(weather, screenWidth = 640) {
  const i = weather ? Math.max(0, Math.min(1, weather.intensity)) : 0;
  return Math.round(screenWidth * 0.28 * i);
}

// Положение капли: детерминированно от индекса и времени.
// scale — множитель размера буфера: скорость падения в пикселях должна
// расти вместе с разрешением, иначе на 720p дождь ползёт, а не льётся.
export function dropPosition(index, time, wind, screenWidth = 640, screenHeight = 360, scale = 1) {
  const seed = (index * 2654435761) >>> 0;
  const x0 = seed % screenWidth;
  const speedY = (420 + ((seed >>> 8) % 260)) * scale;
  const speedX = wind * 190 * scale;

  const y = (time * speedY + (seed >>> 16) % screenHeight) % (screenHeight + 90 * scale) - 90 * scale;
  const x =
    (x0 + time * speedX + (((seed >>> 5) % 40) - 20) * scale) % screenWidth;

  return {
    x: x < 0 ? x + screenWidth : x,
    y,
    speedY,
    speedX,
  };
}

// Длина штриха: сильнее дождь — длиннее и быстрее капли.
export function dropLength(weather, speedY) {
  const i = weather ? Math.max(0, Math.min(1, weather.intensity)) : 0;
  return 4 + i * 10 + speedY * 0.012;
}

// Снежинка: падает медленно и качается из стороны в сторону.
// Отдельная функция, потому что физика совсем другая: не штрих, а точка.
export function snowflakePosition(index, time, wind, screenWidth = 640, screenHeight = 360) {
  const seed = (index * 2246822519) >>> 0;
  const x0 = seed % screenWidth;
  const speedY = 42 + ((seed >>> 8) % 46);
  const speedX = wind * 46;
  // Качание: у каждой снежинки своя фаза и амплитуда.
  const swayPhase = ((seed >>> 12) % 628) / 100;
  const swayAmp = 6 + ((seed >>> 20) % 14);

  const y = (time * speedY + (seed >>> 16) % screenHeight) % (screenHeight + 40) - 40;
  const sway = Math.sin(time * 1.6 + swayPhase) * swayAmp;
  let x = (x0 + time * speedX + sway) % screenWidth;
  if (x < 0) x += screenWidth;

  return { x, y, speedY, sway };
}

// Сколько снежинок рисовать.
export function snowflakeCount(weather, screenWidth = 640) {
  const i = weather ? Math.max(0, Math.min(1, weather.intensity)) : 0;
  return Math.round(screenWidth * 0.22 * i);
}
