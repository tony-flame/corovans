import test from "node:test";
import assert from "node:assert/strict";

import {
  WEATHER,
  createWeather,
  stepWeather,
  setWeather,
  skyTint,
  dropCount,
  dropPosition,
  dropLength,
  weatherLabel,
  isWet,
  kindFromIntensity,
} from "../src/weather.js";

test("weather: погода детерминирована сидом рана", () => {
  const a = createWeather(12345);
  const b = createWeather(12345);
  assert.equal(a.kind, b.kind);
  assert.equal(a.intensity, b.intensity);
  assert.equal(a.wind, b.wind);
  assert.equal(a.phase, b.phase);
});

test("weather: разные сиды дают разную погоду", () => {
  const kinds = new Set();
  const intensities = new Set();
  for (let seed = 1; seed < 120; seed++) {
    const w = createWeather(seed);
    kinds.add(w.kind);
    intensities.add(w.intensity);
  }
  assert.ok(kinds.size >= 3, `всего видов: ${[...kinds].join(",")}`);
  assert.ok(intensities.size >= 3, "интенсивности должны отличаться");
});

test("weather: сид даёт один из известных видов", () => {
  const valid = Object.values(WEATHER);
  for (let seed = 1; seed < 50; seed++) {
    assert.ok(valid.includes(createWeather(seed).kind), String(seed));
  }
});

test("weather: isWet и метка согласованы", () => {
  const dry = { kind: WEATHER.CLEAR, intensity: 0 };
  assert.equal(isWet(dry), false);
  assert.equal(weatherLabel(dry), "ясно");

  const wet = { kind: WEATHER.RAIN, intensity: 0.7 };
  assert.equal(isWet(wet), true);
  assert.equal(weatherLabel(wet), "дождь");
});

test("weather: вход и выход плавные, без щелчка", () => {
  const w = { kind: WEATHER.CLEAR, intensity: 0, target: 1, wind: 0, raining: false };
  let prev = w.intensity;
  for (let i = 0; i < 10; i++) {
    stepWeather(w, 0.016);
    assert.ok(w.intensity >= prev, "интенсивность растёт монотонно");
    assert.ok(w.intensity - prev < 0.05, "без резкого скачка");
    prev = w.intensity;
  }
});

test("weather: затухание возвращает в ясно", () => {
  const w = { kind: WEATHER.STORM, intensity: 1, target: 0, wind: 0, raining: true };
  for (let i = 0; i < 400; i++) stepWeather(w, 0.016);
  assert.equal(w.intensity, 0);
  assert.equal(w.raining, false);
  assert.equal(w.kind, WEATHER.CLEAR);
});

test("weather: setWeather меняет цель", () => {
  const w = createWeather(7);
  setWeather(w, WEATHER.STORM);
  assert.equal(w.target, 1);
  setWeather(w, WEATHER.CLEAR);
  assert.equal(w.target, 0);
});

test("weather: небо темнее и туман плотнее в дождь", () => {
  const clear = skyTint({ intensity: 0 });
  const storm = skyTint({ intensity: 1 });
  assert.ok(storm.dim < clear.dim);
  assert.ok(storm.fogBoost > clear.fogBoost);
  assert.ok(storm.grey > clear.grey);
});

test("weather: капель больше при сильном дожде, ноль при ясно", () => {
  assert.equal(dropCount({ intensity: 0 }), 0);
  const light = dropCount({ intensity: 0.3 });
  const heavy = dropCount({ intensity: 1 });
  assert.ok(heavy > light);
  assert.ok(heavy < 640, "капель не должно быть больше пикселей строки");
});

test("weather: капли детерминированы и остаются в кадре", () => {
  for (let i = 0; i < 40; i++) {
    const a = dropPosition(i, 3.5, 0.4);
    const b = dropPosition(i, 3.5, 0.4);
    assert.equal(a.x, b.x);
    assert.equal(a.y, b.y);
    assert.ok(a.x >= 0 && a.x <= 640, `x=${a.x}`);
    assert.ok(a.y >= -100 && a.y <= 460, `y=${a.y}`);
  }
});

test("weather: ветер наклоняет капли", () => {
  const still = dropPosition(5, 2, 0);
  const windy = dropPosition(5, 2, 1);
  assert.notEqual(still.x, windy.x);
});

test("weather: длина штриха растёт с интенсивностью", () => {
  assert.ok(dropLength({ intensity: 1 }, 500) > dropLength({ intensity: 0.2 }, 500));
});

test("weather: kindFromIntensity покрывает весь диапазон", () => {
  assert.equal(kindFromIntensity(0), WEATHER.CLEAR);
  assert.equal(kindFromIntensity(0.2), WEATHER.DRIZZLE);
  assert.equal(kindFromIntensity(0.6), WEATHER.RAIN);
  assert.equal(kindFromIntensity(1), WEATHER.STORM);
});
