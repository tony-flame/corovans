// Лайтмап: яркость по тайлам, точечные источники и мерцание.
// Чистый модуль — без DOM, полностью тестируемый.

import { MAP_W, MAP_H } from "./world.js";

export const AMBIENT = {
  day: 1,
  dawn: 0.82,
  dusk: 0.72,
  night: 0.34,
};

export function createLightmap(ambient = 1) {
  const map = new Float32Array(MAP_W * MAP_H);
  map.fill(Math.max(0, Math.min(1, ambient)));
  return map;
}

// Радиальное падение: центр ярче, к краю плавно гаснет.
export function addLight(map, x, y, radius, intensity) {
  if (!map || radius <= 0) return map;
  const r = Math.ceil(radius);
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const r2 = radius * radius;

  for (let dy = -r; dy <= r; dy++) {
    const ty = cy + dy;
    if (ty < 0 || ty >= MAP_H) continue;
    for (let dx = -r; dx <= r; dx++) {
      const tx = cx + dx;
      if (tx < 0 || tx >= MAP_W) continue;

      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;

      // Плавное затухание без ступенек на краю.
      const falloff = 1 - d2 / r2;
      const value = falloff * falloff * intensity;
      const index = ty * MAP_W + tx;
      map[index] = Math.min(2.5, map[index] + value);
    }
  }
  return map;
}

// Интерполяция по четырём тайлам: без неё свет идёт ступеньками.
export function sampleLight(map, x, y) {
  if (!map) return 1;
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const tx = x - fx;
  const ty = y - fy;

  const at = (ax, ay) => {
    if (ax < 0 || ay < 0 || ax >= MAP_W || ay >= MAP_H) return 1;
    return map[ay * MAP_W + ax];
  };

  const a = at(fx, fy);
  const b = at(fx + 1, fy);
  const c = at(fx, fy + 1);
  const d = at(fx + 1, fy + 1);

  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

// Мерцание огня: не синус в чистом виде, а с рваным ритмом.
export function flicker(base, time, salt = 0) {
  const t = time * 7.3 + salt * 12.9898;
  const wobble =
    Math.sin(t) * 0.5 +
    Math.sin(t * 2.37 + 1.7) * 0.3 +
    Math.sin(t * 5.11 + 3.1) * 0.2;
  return Math.max(0.45, base * (0.86 + wobble * 0.14));
}

// Тёплый оттенок света: огонь делает тени коричневыми, а не серыми.
export const FIRE_TINT = [255, 154, 60];

export function tintByLight(r, g, b, amount = 0) {
  if (amount <= 0) return [r, g, b];
  const a = Math.max(0, Math.min(1, amount));
  return [
    r * (1 - a) + FIRE_TINT[0] * a,
    g * (1 - a) + FIRE_TINT[1] * a,
    b * (1 - a) + FIRE_TINT[2] * a,
  ];
}

// Источники света для мира: костёр в лагере и факелы в деревне.
export function worldLights(world) {
  const lights = [];

  // Костёр у стоянки мерцает сильнее всего.
  lights.push({
    x: world.wagon.x - 3.1,
    y: world.wagon.y - 1.3,
    radius: 5.5,
    intensity: 0.95,
    flicker: true,
    salt: 1,
  });

  // Факелы у домов деревни.
  const torches = [
    [11, 75.5],
    [18, 75.5],
    [26, 75.5],
    [34, 75.5],
    [8.5, 90.5],
    [23.5, 96.5],
  ];
  for (let i = 0; i < torches.length; i++) {
    const [x, y] = torches[i];
    lights.push({ x, y, radius: 3.2, intensity: 0.55, flicker: true, salt: i + 2 });
  }

  // Окна корчмы: ровный, почти не мерцающий свет.
  lights.push({ x: 60, y: 76, radius: 3.6, intensity: 0.45, flicker: false, salt: 9 });

  return lights;
}

// Пересобрать лайтмап под текущее время суток.
export function buildLightmap(world, ambient, time) {
  const map = createLightmap(ambient);
  for (const light of worldLights(world)) {
    const intensity = light.flicker
      ? flicker(light.intensity, time, light.salt)
      : light.intensity;
    addLight(map, light.x, light.y, light.radius, intensity);
  }
  return map;
}
