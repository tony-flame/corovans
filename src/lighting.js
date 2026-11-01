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
// Интерполяция света по четырём узлам. Горячий путь: вызывается на каждый
// пиксель пола, поэтому здесь нет замыканий и лишних аллокаций — раньше
// внутренняя функция создавалась миллион раз за кадр и съедала FPS.
export function sampleLight(map, x, y) {
  if (!map) return 1;
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const tx = x - fx;
  const ty = y - fy;

  const x1 = fx + 1;
  const y1 = fy + 1;

  // Выход за карту даёт 1 — там просто нет ламп.
  const a = fx < 0 || fy < 0 || fx >= MAP_W || fy >= MAP_H ? 1 : map[fy * MAP_W + fx];
  const b = x1 < 0 || fy < 0 || x1 >= MAP_W || fy >= MAP_H ? 1 : map[fy * MAP_W + x1];
  const c = fx < 0 || y1 < 0 || fx >= MAP_W || y1 >= MAP_H ? 1 : map[y1 * MAP_W + fx];
  const d = x1 < 0 || y1 < 0 || x1 >= MAP_W || y1 >= MAP_H ? 1 : map[y1 * MAP_W + x1];

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

  // Факелы у домов деревни. Координаты абсолютные: карта 200×200,
  // деревня сдвинута на +40. Старые числа светили в пустое поле.
  const torches = [
    [51, 115.5],
    [58, 115.5],
    [66, 115.5],
    [74, 115.5],
    [48.5, 130.5],
    [63.5, 136.5],
  ];
  for (let i = 0; i < torches.length; i++) {
    const [x, y] = torches[i];
    lights.push({ x, y, radius: 3.2, intensity: 0.55, flicker: true, salt: i + 2 });
  }

  // Окна корчмы: ровный, почти не мерцающий свет.
  lights.push({ x: 100, y: 116, radius: 3.6, intensity: 0.45, flicker: false, salt: 9 });

  // Фонари рынка и собора.
  lights.push({ x: 112.5, y: 130.5, radius: 3.4, intensity: 0.5, flicker: true, salt: 20 });
  lights.push({ x: 122.5, y: 146.5, radius: 3.4, intensity: 0.5, flicker: true, salt: 21 });
  lights.push({ x: 147.5, y: 114, radius: 4, intensity: 0.55, flicker: true, salt: 22 });

  return lights;
}

// Пересобрать лайтмап под текущее время суток.
// Дорого: заливка 40 000 тайлов плюс радиусы всех огней. В кадре это
// нельзя делать каждый раз — поэтому main.js обновляет его по таймеру
// и при смене фазы, а не каждый кадр.
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
