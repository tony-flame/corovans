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
};

// Доли вероятностей. Дождь должен быть заметным событием, а не фоном.
const ODDS = [
  { value: WEATHER.CLEAR, weight: 0.38 },
  { value: WEATHER.DRIZZLE, weight: 0.27 },
  { value: WEATHER.RAIN, weight: 0.25 },
  { value: WEATHER.STORM, weight: 0.1 },
];

const INTENSITY = {
  clear: 0,
  drizzle: 0.35,
  rain: 0.7,
  storm: 1,
};

const LABELS = {
  clear: "ясно",
  drizzle: "моросит",
  rain: "дождь",
  storm: "гроза",
};

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
  const speed = 0.55;
  if (Math.abs(weather.intensity - target) <= speed * dt) {
    weather.intensity = target;
  } else {
    weather.intensity += Math.sign(target - weather.intensity) * speed * dt;
  }
  weather.raining = weather.intensity > 0.01;
  weather.kind = kindFromIntensity(weather.intensity);
  return weather;
}

export function kindFromIntensity(intensity) {
  if (intensity <= 0.01) return WEATHER.CLEAR;
  if (intensity < 0.45) return WEATHER.DRIZZLE;
  if (intensity < 0.85) return WEATHER.RAIN;
  return WEATHER.STORM;
}

// Смена погоды по ходу забега (если понадобится).
export function setWeather(weather, kind) {
  if (!weather) return weather;
  weather.target = INTENSITY[kind] !== undefined ? INTENSITY[kind] : 0;
  return weather;
}

// Насколько темнее небо и плотнее туман.
export function skyTint(weather) {
  const i = weather ? Math.max(0, Math.min(1, weather.intensity)) : 0;
  return {
    dim: 1 - i * 0.22,
    fogBoost: 1 + i * 0.9,
    grey: i * 0.35,
  };
}

// Сколько капель рисовать на кадр.
export function dropCount(weather, screenWidth = 640) {
  const i = weather ? Math.max(0, Math.min(1, weather.intensity)) : 0;
  return Math.round(screenWidth * 0.28 * i);
}

// Положение капли: детерминированно от индекса и времени.
export function dropPosition(index, time, wind, screenWidth = 640, screenHeight = 360) {
  const seed = (index * 2654435761) >>> 0;
  const x0 = seed % screenWidth;
  const speedY = 420 + ((seed >>> 8) % 260);
  const speedX = wind * 190;

  const y = (time * speedY + (seed >>> 16) % screenHeight) % (screenHeight + 90) - 90;
  const x =
    (x0 + time * speedX + (((seed >>> 5) % 40) - 20)) % screenWidth;

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
