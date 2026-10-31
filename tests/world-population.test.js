import test from "node:test";
import assert from "node:assert/strict";

import {
  COURTESAN_SPOTS,
  createCourtesan,
  createAffinity,
  affinityOf,
  isFreeVisit,
  bumpAffinity,
  applyHeal,
  courtesanCanServe,
  greetCourtesan,
  AFFINITY_FREE,
  OVERHEAL_CAP,
} from "../src/npc.js";
import {
  CIVILIAN_ORDER,
  CIVILIAN_SPOTS,
  CIVILIAN_DEFS,
  createCivilian,
  createCivilians,
  stepCivilian,
  civilianLine,
  bumpVisits,
  isTrader,
  isBeggar,
  isRumormonger,
} from "../src/civilian.js";
import {
  createWorld,
  canStand,
  hasPath,
  SPAWN,
  MERCHANT_POS,
  COURTESAN_SPOTS_POS,
  WAGON_BASE,
  nearestInteraction,
} from "../src/world.js";
import { createRun, snapshotRun, restoreRun } from "../src/run.js";
import { createProfile } from "../src/profile.js";

test("куртизанка: каждое место даёт свой вариант", () => {
  const seen = new Set();
  for (const spot of COURTESAN_SPOTS) {
    const c = createCourtesan(1000, 1, 0, spot);
    assert.equal(c.spot, spot);
    assert.ok(c.spotLabel.length > 0);
    seen.add(c.id);
  }
  assert.equal(seen.size, COURTESAN_SPOTS.length, "все места должны давать разные варианты");
});

test("куртизанка: одно место — один вариант при одинаковом сиде", () => {
  const a = createCourtesan(500, 2, 1, "inn");
  const b = createCourtesan(500, 2, 1, "inn");
  assert.equal(a.id, b.id);
  assert.equal(a.name, b.name);

  const other = createCourtesan(500, 2, 1, "forest");
  assert.notEqual(a.id, other.id);
});

test("привязанность: создаётся нулевой для всех мест", () => {
  const aff = createAffinity();
  for (const spot of COURTESAN_SPOTS) assert.equal(affinityOf(aff, spot), 0);
  assert.equal(affinityOf(null, "square"), 0);
  assert.equal(affinityOf(aff, "unknown"), 0);
});

test("привязанность: бесплатно только после нужного числа платных визитов", () => {
  let aff = createAffinity();
  assert.equal(isFreeVisit(aff, "square"), false);

  aff = bumpAffinity(aff, "square");
  assert.equal(affinityOf(aff, "square"), 1);
  assert.equal(isFreeVisit(aff, "square"), false, "одного визита мало");

  aff = bumpAffinity(aff, "square");
  assert.equal(affinityOf(aff, "square"), AFFINITY_FREE);
  assert.equal(isFreeVisit(aff, "square"), true);

  // Другое место не затронуто.
  assert.equal(isFreeVisit(aff, "inn"), false);
});

test("привязанность: не растёт бесконечно", () => {
  let aff = createAffinity();
  for (let i = 0; i < 20; i++) aff = bumpAffinity(aff, "camp");
  assert.ok(affinityOf(aff, "camp") <= AFFINITY_FREE + 1);
});

test("привязанность: переживает снапшот и восстановление", () => {
  const profile = createProfile();
  const run = createRun(4242, profile, {});
  run.courtesanAffinity = bumpAffinity(run.courtesanAffinity, "inn");
  run.courtesanAffinity = bumpAffinity(run.courtesanAffinity, "inn");

  const snapshot = snapshotRun(run, { x: 12.5, y: 92.5, angle: 0 });
  const restored = restoreRun(JSON.parse(JSON.stringify(snapshot)), profile, {});

  assert.ok(restored);
  assert.equal(affinityOf(restored.run.courtesanAffinity, "inn"), 2);
  assert.equal(isFreeVisit(restored.run.courtesanAffinity, "inn"), true);
  assert.equal(affinityOf(restored.run.courtesanAffinity, "square"), 0);
});

test("бесплатный визит: лечит здоровье, но не даёт запас", () => {
  const c = { price: 30 };
  const free = applyHeal(c, 100, 40, 100, 0, true);
  assert.equal(free.health, 100);
  assert.equal(free.overheal, 0, "бесплатно запас не даётся");
  assert.equal(free.gold, 100, "деньги не списаны");
  assert.equal(free.free, true);

  const paid = applyHeal(c, 100, 40, 100, 0, false);
  assert.equal(paid.health, 100);
  assert.equal(paid.overheal, OVERHEAL_CAP, "платно даёт запас");
  assert.equal(paid.gold, 70);
});

test("бесплатный визит: работает без золота", () => {
  const c = { price: 30 };
  const can = courtesanCanServe(c, 0, 50, 100, 0, true);
  assert.equal(can.ok, true, "бесплатно пускает и без денег");

  const paid = courtesanCanServe(c, 0, 50, 100, 0, false);
  assert.equal(paid.reason, "no_gold");
});

test("приветствие: при бесплатном визите отказывается от монеты", () => {
  const c = createCourtesan(7, 1, 0, "square");
  const line = greetCourtesan(c, () => 0, { free: true });
  assert.ok(line.includes("больше не беру"), line);
});

test("гражданские: все шесть создаются", () => {
  const list = createCivilians(1);
  assert.equal(list.length, CIVILIAN_SPOTS.length);
  assert.ok(list.length >= 6, String(list.length));

  for (const person of list) {
    assert.ok(CIVILIAN_DEFS[person.kind], person.kind);
    assert.ok(person.label.length > 0);
    assert.ok(person.spriteKey.length > 0);
    assert.equal(person.alive, true);
  }
});

test("гражданские: каждый вид определён и имеет фразы", () => {
  for (const kind of CIVILIAN_ORDER) {
    const def = CIVILIAN_DEFS[kind];
    assert.ok(def, kind);
    assert.ok(def.lines.length >= 3, `${kind}: строк ${def.lines.length}`);
    assert.ok(def.sprite.length > 0);
  }
});

test("гражданские: детерминированное создание", () => {
  const a = createCivilian("peasant_w", 10, 10, [[10, 10], [12, 10]], 5);
  const b = createCivilian("peasant_w", 10, 10, [[10, 10], [12, 10]], 5);
  assert.equal(a.id, b.id);
  assert.deepEqual(a.path, b.path);
});

test("гражданские: ходят по маршруту и разворачиваются", () => {
  const c = createCivilian("traveler", 48.5, 86.9, [[48.5, 86.9], [52.5, 86.9]], 1);
  const startX = c.x;
  for (let i = 0; i < 200; i++) stepCivilian(c, 0.05);
  assert.notEqual(c.x, startX, "путник должен сдвинуться");

  // Не улетает за пределы маршрута.
  assert.ok(c.x >= 48.4 && c.x <= 52.6, `x=${c.x}`);
  assert.ok(Math.abs(c.y - 86.9) < 0.1, `y=${c.y}`);
});

test("гражданские: неподвижные не двигаются", () => {
  const c = createCivilian("greengrocer", 14.2, 97.6, null, 1);
  const x = c.x;
  const y = c.y;
  for (let i = 0; i < 50; i++) stepCivilian(c, 0.05);
  assert.equal(c.x, x);
  assert.equal(c.y, y);
});

test("гражданские: фраза стабильна до смены визита", () => {
  const c = createCivilian("drunk", 57.4, 79.6, null, 3);
  const first = civilianLine(c, 42);
  assert.equal(first, civilianLine(c, 42), "та же фраза при том же сиде");
  assert.ok(first.length > 10);

  bumpVisits(c);
  const second = civilianLine(c, 42);
  assert.notEqual(first, second, "новый визит — новая фраза");
});

test("гражданские: роли распознаются", () => {
  const trader = createCivilian("greengrocer", 1, 1, null, 1);
  const beggar = createCivilian("beggar", 1, 1, null, 1);
  const drunk = createCivilian("drunk", 1, 1, null, 1);
  assert.equal(isTrader(trader), true);
  assert.equal(isBeggar(beggar), true);
  assert.equal(isRumormonger(drunk), true);
});

test("мир: четыре куртизанки на карте", () => {
  const world = createWorld();
  assert.equal(world.courtesans.length, 4);

  const spots = world.courtesans.map((c) => c.spot);
  assert.deepEqual(new Set(spots), new Set(COURTESAN_SPOTS));
});

test("мир: гражданские блокируют не полностью и не запирают проход", () => {
  const world = createWorld();
  world.civilians = createCivilians(1);

  // Маршрут к Мардо и к фургону должен остаться.
  assert.equal(hasPath(world, SPAWN, MERCHANT_POS), true, "гражданские перекрыли путь к Мардо");
  assert.equal(hasPath(world, SPAWN, WAGON_BASE), true, "гражданские перекрыли путь к фургону");
});

test("мир: у каждого гражданского есть спрайт", () => {
  const world = createWorld();
  world.civilians = createCivilians(1);
  const keys = new Set(CIVILIAN_ORDER.map((k) => CIVILIAN_DEFS[k].sprite));
  for (const person of world.civilians) {
    assert.ok(keys.has(person.spriteKey), `нет спрайта для ${person.kind}`);
  }
});

test("мир: взаимодействие с гражданским определяется", () => {
  const world = createWorld();
  world.civilians = createCivilians(1);
  const person = world.civilians[0];

  const near = nearestInteraction(world, { x: person.x, y: person.y });
  assert.ok(near, "рядом должен быть интеракт");
  assert.equal(near.type, "civilian");
  assert.equal(near.civilianId, person.id);
});
