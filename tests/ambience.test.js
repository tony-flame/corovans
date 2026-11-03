import test from "node:test";
import assert from "node:assert/strict";

import {
  smokeParticle,
  flockAt,
  birdAt,
  windStrength,
  grassLean,
  shouldDropTrack,
  stepTracks,
  trackAlpha,
  SMOKE_COUNT,
  BIRD_COUNT,
  TRACK_LIFE,
  TRACK_LIMIT,
} from "../src/ambience.js";
import { createWorld } from "../src/world.js";

test("дым: частица живёт весь цикл и гаснет на концах", () => {
  for (let i = 0; i < SMOKE_COUNT; i++) {
    const p = smokeParticle(i, SMOKE_COUNT, 2, 42);
    assert.ok(p.alive, `частица ${i} мертва в середине цикла`);
    assert.ok(p.alpha >= 0 && p.alpha <= 1, `альфа вне диапазона: ${p.alpha}`);
    assert.ok(p.rise >= 0 && p.rise <= 2, `подъём вне диапазона: ${p.rise}`);
    assert.ok(p.scale > 0, `нулевой масштаб у частицы ${i}`);
  }
});

test("дым: частицы разнесены по фазе, а не идут залпом", () => {
  const ages = [];
  for (let i = 0; i < SMOKE_COUNT; i++) {
    ages.push(smokeParticle(i, SMOKE_COUNT, 2, 7).age);
  }
  const unique = new Set(ages.map((a) => a.toFixed(2)));
  assert.equal(unique.size, SMOKE_COUNT, "частицы дыма на одной фазе — будет комок, а не струя");
});

test("дым: детерминирован по времени", () => {
  const a = smokeParticle(2, SMOKE_COUNT, 3.5, 11);
  const b = smokeParticle(2, SMOKE_COUNT, 3.5, 11);
  assert.deepEqual(a, b);
});

test("дым: поднимается выше со временем", () => {
  // Прослеживаем одну частицу через полный цикл.
  let prev = -1;
  let rises = 0;
  for (let t = 0; t < TRACK_LIFE; t += 0.1) {
    const p = smokeParticle(0, SMOKE_COUNT, t, 3);
    if (p.alive && p.rise > prev) rises++;
    prev = p.rise;
  }
  assert.ok(rises > 20, "дым не поднимается");
});

test("птицы: клин из нужного числа и все в кадре", () => {
  for (const time of [0, 5, 12.5, 40]) {
    const flock = flockAt(time, 99);
    assert.equal(flock.length, BIRD_COUNT);
    for (const bird of flock) {
      assert.ok(bird.x >= 0 && bird.x <= 1.2, `птица за краем по x: ${bird.x}`);
      assert.ok(bird.y > 0 && bird.y < 1, `птица за краем по y: ${bird.y}`);
      assert.ok(bird.flap >= -1.001 && bird.flap <= 1.001, "взмах вне диапазона");
    }
  }
});

test("птицы: детерминированы и не стоят на месте", () => {
  const a = flockAt(10, 5);
  const b = flockAt(10, 5);
  assert.deepEqual(a, b);

  const later = flockAt(20, 5);
  assert.notDeepEqual(a, later, "стая не двигается со временем");
});

test("ветер: сила в разумных пределах и не ноль", () => {
  for (let t = 0; t < 60; t += 0.5) {
    const strength = windStrength(t);
    assert.ok(strength >= 0 && strength <= 1.4, `ветер вне диапазона: ${strength}`);
  }
  assert.ok(windStrength(10) > 0, "ветра нет вообще");
});

test("ветер: в непогоду сильнее", () => {
  const calm = windStrength(10, { intensity: 0 });
  const storm = windStrength(10, { intensity: 1 });
  assert.ok(storm > calm, "дождь не усиливает ветер");
});

test("ветер: соседние точки качаются не синхронно", () => {
  const a = grassLean(10, 10, 5, 1);
  const b = grassLean(11, 10, 5, 1);
  assert.notEqual(a, b, "вся трава качается как одна");
  assert.ok(Math.abs(a) < 0.2, "слишком сильный наклон");
});

test("следы: шаг меньше порога не оставляет следа", () => {
  assert.equal(shouldDropTrack(null, null, 1, 1), true, "первый след должен появиться");
  assert.equal(shouldDropTrack(1, 1, 1.1, 1), false, "микрошаг не оставляет след");
  assert.equal(shouldDropTrack(1, 1, 5, 1), true);
});

test("следы: тают и не копятся без предела", () => {
  const tracks = [{ x: 0, y: 0, age: 0 }, { x: 1, y: 1, age: TRACK_LIFE - 0.5 }];
  const stepped = stepTracks(tracks, 1);
  assert.equal(stepped.length, 1, "просроченный след должен исчезнуть");
  assert.equal(stepped[0].x, 0);

  // Пустой список не падает.
  assert.deepEqual(stepTracks([], 1), []);
  assert.deepEqual(stepTracks(null, 1), []);
});

test("следы: список ограничен сверху", () => {
  const many = [];
  for (let i = 0; i < TRACK_LIMIT + 30; i++) many.push({ x: i, y: 0, age: 0 });
  const stepped = stepTracks(many, 0.01);
  assert.ok(stepped.length <= TRACK_LIMIT, `следов ${stepped.length}, лимит ${TRACK_LIMIT}`);
  // Обрезаются старые: последний след на месте.
  assert.equal(stepped[stepped.length - 1].x, TRACK_LIMIT + 29);
});

test("следы: яркость падает со временем и не уходит в минус", () => {
  assert.ok(trackAlpha({ age: 0 }) > trackAlpha({ age: 5 }));
  assert.equal(trackAlpha({ age: TRACK_LIFE + 10 }), 0);
  assert.equal(trackAlpha(null), 0);
});

test("мир: трубы есть у жилых домов и в границах карты", () => {
  const world = createWorld();
  assert.ok(world.chimneys.length > 0, "ни одной трубы — дыма не будет");

  for (const chimney of world.chimneys) {
    assert.ok(Number.isFinite(chimney.x) && Number.isFinite(chimney.y), "координаты трубы не числа");
    assert.ok(chimney.x > 0 && chimney.x < 200, `труба за картой по x: ${chimney.x}`);
    assert.ok(chimney.y > 0 && chimney.y < 200, `труба за картой по y: ${chimney.y}`);
    assert.ok(chimney.height > 0.4 && chimney.height < 1.5, `высота трубы нелепа: ${chimney.height}`);
  }
});

test("мир: у собора и ратуши труб нет", () => {
  const world = createWorld();
  // Собор 152..182 x 96..140, ратуша 152..176 x 56..84.
  for (const chimney of world.chimneys) {
    const inCathedral = chimney.x >= 152 && chimney.x <= 182 && chimney.y >= 96 && chimney.y <= 140;
    const inRathouse = chimney.x >= 152 && chimney.x <= 176 && chimney.y >= 56 && chimney.y <= 84;
    assert.equal(inCathedral, false, `труба в соборе: ${chimney.x},${chimney.y}`);
    assert.equal(inRathouse, false, `труба в ратуше: ${chimney.x},${chimney.y}`);
  }
});

test("мир: трубы детерминированы между построениями", () => {
  const a = createWorld().chimneys;
  const b = createWorld().chimneys;
  assert.deepEqual(a, b, "трубы переезжают при перезапуске мира");
});
