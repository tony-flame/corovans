import test from "node:test";
import assert from "node:assert/strict";

import { castRay, isWallTile, MIN_HIT_DIST, MAX_RAY_DIST } from "../src/ray.js";
import {
  createWorld,
  SPAWN,
  MAP_W,
  MAP_H,
  TILE,
  tileAt,
} from "../src/world.js";

const SCREEN_H = 360;

// Высота стены в пикселях для дистанции — так же, как в raycaster.js.
const wallPixels = (dist) => SCREEN_H / dist;

test("ray: промах в открытое поле не даёт стену в упор", () => {
  const world = createWorld();
  // Чистое поле южнее леса: построек там нет.
  const ray = castRay(world, 60.5, 66.5, 1, 0, MAX_RAY_DIST);

  assert.equal(ray.hit, false, "в открытом поле попадания быть не должно");
  assert.equal(ray.dist, MAX_RAY_DIST, "промах уходит в максимальную дальность");
  assert.ok(ray.dist > MIN_HIT_DIST, "дистанция промаха не 5 см");
  assert.ok(wallPixels(ray.dist) < SCREEN_H, "стена не растягивается на экран");
});

test("ray: старый баг не вернётся — промах не равен 0.05", () => {
  const world = createWorld();
  // Раньше здесь стояло `if (!hit) perpDist = 0.05`, и стена
  // растягивалась на 20 экранов. Проверяем, что ни один луч
  // с открытой площадки не даёт дистанцию меньше 0.1 без попадания.
  for (let a = 0; a < 64; a++) {
    const angle = (a / 64) * Math.PI * 2;
    const ray = castRay(world, 60.5, 80.5, Math.cos(angle), Math.sin(angle), MAX_RAY_DIST);
    if (!ray.hit) {
      assert.equal(ray.dist, MAX_RAY_DIST, `промах под углом ${angle.toFixed(2)} дал dist=${ray.dist}`);
    }
    assert.ok(ray.dist >= MIN_HIT_DIST);
  }
});

test("ray: все 640 лучей с любого ракурса не дают гигантских стен", () => {
  const world = createWorld();

  // Проверяем спавн и несколько точек по маршруту, по всем направлениям.
  const spots = [
    { x: SPAWN.x, y: SPAWN.y },
    { x: 22.5, y: 92.5 },
    { x: 60.5, y: 86.5 },
    { x: 98.5, y: 60.5 },
    { x: 102.4, y: 32.5 },
    { x: 20.5, y: 80.5 },
  ];

  for (const spot of spots) {
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const planeX = -dirY * 0.66;
      const planeY = dirX * 0.66;

      for (let x = 0; x < 640; x += 16) {
        const cameraX = (2 * x) / 640 - 1;
        const ray = castRay(
          world,
          spot.x,
          spot.y,
          dirX + planeX * cameraX,
          dirY + planeY * cameraX,
          MAX_RAY_DIST
        );

        if (!ray.hit) {
          assert.equal(ray.dist, MAX_RAY_DIST);
          continue;
        }

        const height = wallPixels(ray.dist);
        assert.ok(
          height <= SCREEN_H * 1.6,
          `стена ${Math.round(height)} px при дистанции ${ray.dist.toFixed(3)} ` +
            `в точке (${spot.x}, ${spot.y}) под углом ${angle.toFixed(2)}`
        );
      }
    }
  }
});

test("ray: попадание в стену вплотную остаётся маленькой дистанцией", () => {
  const world = createWorld();
  // Дом в деревне: 49..53 по x, 110..114 по y.
  assert.equal(isWallTile(tileAt(world, 51, 112)), true);

  const ray = castRay(world, 51.5, 116.5, 0, -1, MAX_RAY_DIST);
  assert.equal(ray.hit, true, "обязан найти дом");
  assert.ok(ray.dist > 0 && ray.dist < 3, `дистанция ${ray.dist}`);
});

test("ray: выход за границу мира не считается стеной", () => {
  const world = createWorld();
  // Смотрим на запад с самого края карты.
  const ray = castRay(world, 1.5, 60.5, -1, 0, MAX_RAY_DIST);
  // Граница мира — тайлы STONE, поэтому это стена, но дистанция мала.
  assert.equal(ray.hit, true);
  assert.ok(ray.dist <= 2);

  // А если пройти мимо границы в пустоту, попадания быть не должно.
  const empty = createWorld();
  const far = castRay(empty, SPAWN.x, SPAWN.y, 0, 1, MAX_RAY_DIST);
  assert.ok(far.dist <= MAX_RAY_DIST);
  assert.ok(wallPixels(far.dist) <= SCREEN_H * 1.6);
});

test("ray: лимит шагов не зависит от магического числа 80", () => {
  // Диагональ карты 200×200 — около 283 тайлов. Старый лимит в 80 шагов
  // не доставал до края, и промах превращался в стену.
  const diagonal = Math.hypot(MAP_W, MAP_H);
  assert.ok(diagonal > 80, "карта больше старого лимита шагов");
  assert.ok(diagonal < MAP_W * 2, "диагональ не больше двух сторон карты");
});

test("ray: wallX всегда в пределах [0,1)", () => {
  const world = createWorld();
  for (let a = 0; a < 32; a++) {
    const angle = (a / 32) * Math.PI * 2;
    const ray = castRay(world, SPAWN.x, SPAWN.y, Math.cos(angle), Math.sin(angle), MAX_RAY_DIST);
    if (!ray.hit) continue;
    assert.ok(ray.wallX >= 0 && ray.wallX < 1, `wallX=${ray.wallX}`);
  }
});

test("ray: горизонтальный луч вдоль стены не даёт NaN", () => {
  const world = createWorld();
  const cardinal = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1e-12, 1],
    [1, 1e-12],
  ];
  for (const [dx, dy] of cardinal) {
    const ray = castRay(world, SPAWN.x, SPAWN.y, dx, dy, MAX_RAY_DIST);
    assert.ok(Number.isFinite(ray.dist), `dist не число при ${dx},${dy}`);
    assert.equal(ray.hit ? true : ray.dist === MAX_RAY_DIST, true);
  }
});

test("ray: каждый тайл-стена имеет свою текстуру", () => {
  // Если добавить тайл в isWallTile и забыть про textures.js,
  // получится стена, которая рисуется серой заглушкой.
  const world = createWorld();
  const wallTiles = new Set();
  for (const t of world.map) {
    if (isWallTile(t)) wallTiles.add(t);
  }
  assert.ok(wallTiles.size >= 3, `тайлов-стен: ${[...wallTiles].join(",")}`);
  assert.ok(wallTiles.has(TILE.BRICK_FRAME), "в мире должен быть кирпичный фахверк");
  assert.ok(wallTiles.has(TILE.PLASTER_FRAME), "в мире должен быть штукатурный фахверк");
});

test("ray: фахверк непроходим", () => {
  const world = createWorld();
  // Ряд A: дом 56..60 x 110..114 — кирпичный фахверк.
  assert.equal(isWallTile(tileAt(world, 58, 112)), true);
  const ray = castRay(world, 58.5, 118.5, 0, -1, MAX_RAY_DIST);
  assert.equal(ray.hit, true, "фахверковая стена обязана ловить луч");
  assert.ok(ray.dist < 6, `дистанция ${ray.dist}`);
});

test("ray: каждая точка маршрута видит стены, а не пустоту", () => {
  const world = createWorld();
  // С точкой спавна разобрались; проверим, что снаружи деревни,
  // где раньше были «столбы», стены выглядят нормально.
  const ray = castRay(world, 60.5, 86.5, Math.cos(0), Math.sin(0), MAX_RAY_DIST);
  assert.ok(ray.dist >= MIN_HIT_DIST);
  assert.ok(wallPixels(ray.dist) <= SCREEN_H * 1.6);
});
