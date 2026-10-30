import test from "node:test";
import assert from "node:assert/strict";

import {
  BAYER4,
  bayerOffset,
  quantize,
  grain,
  applyGrain,
  clampChannel,
  vignette,
  wallOcclusion,
  murk,
  MURK_TINT,
} from "../src/dither.js";
import {
  createLightmap,
  addLight,
  sampleLight,
  flicker,
  AMBIENT,
  buildLightmap,
  worldLights,
  tintByLight,
} from "../src/lighting.js";
import { createWorld } from "../src/world.js";
import { MAP_W } from "../src/world.js";

test("dither: матрица Байера 4×4 и значения 0..15", () => {
  assert.equal(BAYER4.length, 4);
  for (const row of BAYER4) {
    assert.equal(row.length, 4);
    for (const v of row) assert.ok(v >= 0 && v <= 15, String(v));
  }
});

test("dither: quantize не выходит за канал", () => {
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      for (const value of [-50, 0, 1, 127, 254, 255, 300, NaN]) {
        const out = quantize(value, 7, x, y, 1);
        assert.ok(Number.isFinite(out), `${value}`);
        assert.ok(out >= 0 && out <= 255, `${value} -> ${out}`);
      }
    }
  }
});

test("dither: quantize детерминирован", () => {
  assert.equal(quantize(123, 6, 5, 9), quantize(123, 6, 5, 9));
  assert.notEqual(quantize(123, 6, 5, 9), quantize(123, 6, 6, 9));
});

test("dither: зерно детерминировано и ограничено", () => {
  assert.equal(grain(10, 20, 0), grain(10, 20, 0));
  assert.notEqual(grain(10, 20, 0), grain(10, 20, 1));

  for (let i = 0; i < 200; i++) {
    const g = grain(i, i * 3, 2, 4);
    assert.ok(Math.abs(g) <= 4.0001, String(g));
  }
});

test("dither: applyGrain не пробивает границы канала", () => {
  for (let i = 0; i < 100; i++) {
    const v = applyGrain(i < 50 ? 0 : 255, i, i, 0, 6);
    assert.ok(v >= 0 && v <= 255, String(v));
  }
  assert.equal(clampChannel(-10), 0);
  assert.equal(clampChannel(999), 255);
});

test("dither: виньетка темнее по краям и равна единице в центре", () => {
  const center = vignette(320, 180, 640, 360, 0.34);
  const corner = vignette(0, 0, 640, 360, 0.34);
  assert.ok(center > 0.99, String(center));
  assert.ok(corner < 0.75, String(corner));
  assert.ok(corner > 0, "виньетка не должна давать отрицательных значений");
});

test("dither: AO у пола темнее, чем у потолка", () => {
  assert.ok(wallOcclusion(1, 0.4) < wallOcclusion(0, 0.4));
  assert.equal(wallOcclusion(0, 0.4), 1);
});

test("dither: подмес сумрака сдвигает цвет к оливковому", () => {
  const [r, g, b] = murk(200, 200, 200, 0.5);
  assert.ok(b < r, "синий должен уйти вниз");
  assert.ok(g > b, "зелёный выше синего");
  assert.equal(murk(10, 10, 10, 0).join(","), "10,10,10");

  const full = murk(0, 0, 0, 1);
  assert.deepEqual(full, MURK_TINT);
});

test("lighting: базовый лайтмап заполнен ambient", () => {
  const map = createLightmap(0.6);
  assert.equal(map.length, MAP_W * MAP_W);
  assert.ok(Math.abs(map[0] - 0.6) < 1e-6);
  assert.ok(Math.abs(map[map.length - 1] - 0.6) < 1e-6);
});

test("lighting: источник добавляет свет в центре и не трогает далёкие тайлы", () => {
  const map = createLightmap(0.2);
  addLight(map, 10.5, 10.5, 3, 0.8);

  // В центре источника ambient + интенсивность, но не больше суммы.
  const center = sampleLight(map, 10.5, 10.5);
  const far = sampleLight(map, 60.5, 60.5);

  assert.ok(center > 0.8, `центр ${center}`);
  assert.ok(center <= 0.2 + 0.8 + 1e-6, `центр не должен превышать сумму: ${center}`);
  assert.ok(Math.abs(far - 0.2) < 1e-6, String(far));
});

test("lighting: свет затухает к краю радиуса", () => {
  const map = createLightmap(0);
  addLight(map, 50.5, 50.5, 4, 1);
  const near = sampleLight(map, 50.5, 50.5);
  const edge = sampleLight(map, 54, 50.5);
  assert.ok(near > edge, `${near} vs ${edge}`);
  assert.ok(edge >= 0);
});

test("lighting: интерполяция не даёт ступенек", () => {
  const map = createLightmap(0);
  addLight(map, 50.5, 50.5, 4, 1);
  // Между тайлами значение должно быть между соседними.
  const a = sampleLight(map, 50.5, 50.5);
  const b = sampleLight(map, 51.5, 50.5);
  const mid = sampleLight(map, 51.0, 50.5);
  assert.ok(mid <= Math.max(a, b) + 1e-6);
  assert.ok(mid >= Math.min(a, b) - 1e-6);
});

test("lighting: мерцание в разумных пределах и не гаснет полностью", () => {
  for (let t = 0; t < 20; t += 0.37) {
    const v = flicker(1, t, 3);
    assert.ok(v > 0.4 && v <= 1.05, String(v));
  }
  // Разные соли дают разный ритм.
  assert.notEqual(flicker(1, 1.3, 1), flicker(1, 1.3, 2));
});

test("lighting: ночью базовый свет ниже дневного", () => {
  assert.ok(AMBIENT.night < AMBIENT.day);
  assert.ok(AMBIENT.dusk < AMBIENT.day);
});

test("lighting: мир даёт источники, костёр мерцает", () => {
  const world = createWorld();
  const lights = worldLights(world);
  assert.ok(lights.length >= 3, String(lights.length));
  assert.ok(lights.some((l) => l.flicker), "должен быть мерцающий источник");

  const map = buildLightmap(world, AMBIENT.night, 1.5);
  const atFire = sampleLight(map, world.wagon.x - 3.1, world.wagon.y - 1.3);
  const dark = sampleLight(map, 20, 20);
  assert.ok(atFire > dark, `у костра ${atFire}, в глуши ${dark}`);
});

test("lighting: тёплый оттенок уходит в оранжевый", () => {
  const [r, g, b] = tintByLight(100, 100, 100, 1);
  assert.ok(r > g && g > b);
  assert.deepEqual(tintByLight(5, 6, 7, 0), [5, 6, 7]);
});
