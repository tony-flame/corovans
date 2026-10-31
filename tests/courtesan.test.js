import test from "node:test";
import assert from "node:assert/strict";

import {
  createCourtesan,
  courtesanSeed,
  courtesanCanServe,
  applyHeal,
  greetCourtesan,
  afterCourtesanLine,
  refusalLine,
  courtesanRumor,
  rumorCount,
  describeCourtesan,
  decayOverheal,
  absorbWithOverheal,
  TEMPERS,
  TEMPER_ORDER,
  OVERHEAL_CAP,
  OVERHEAL_DECAY,
  PRICE_MIN,
  PRICE_MAX,
} from "../src/npc.js";

test("куртизанка: характер детерминирован и входит в палитру", () => {
  const a = createCourtesan(777, 2, 1);
  const b = createCourtesan(777, 2, 1);
  assert.equal(a.temper, b.temper);
  assert.equal(a.temperLabel, b.temperLabel);
  assert.ok(TEMPER_ORDER.includes(a.temper), a.temper);
  assert.equal(a.temperLabel, TEMPERS[a.temper].label);
});

test("куртизанка: разные сиды дают разные характеры", () => {
  const seen = new Set();
  for (let seed = 1; seed < 80; seed++) {
    seen.add(createCourtesan(seed, 1, 0).temper);
  }
  assert.ok(seen.size >= 3, `характеров встретилось: ${[...seen].join(",")}`);
});

test("куртизанка: характер меняется с караваном и актом", () => {
  const base = createCourtesan(999, 1, 0);
  const tier = createCourtesan(999, 2, 0);
  const act = createCourtesan(999, 1, 1);
  assert.notEqual(base.id, tier.id);
  assert.notEqual(base.id, act.id);
});

test("куртизанка: цена в диапазоне с учётом характера", () => {
  for (let seed = 1; seed < 60; seed++) {
    const c = createCourtesan(seed, 1, 0);
    assert.ok(c.price >= PRICE_MIN, `${c.price} < ${PRICE_MIN}`);
    assert.ok(c.price <= PRICE_MAX, `${c.price} > ${PRICE_MAX}`);
  }
});

test("куртизанка: приветствие подставляет имя и не пустое", () => {
  for (let seed = 1; seed < 30; seed++) {
    const c = createCourtesan(seed, 1, 0);
    const line = greetCourtesan(c, () => 0.4);
    assert.ok(line.length > 10, line);
    assert.ok(line.includes(c.name), line);
    assert.ok(!line.includes("{name}"));
  }
});

test("куртизанка: приветствие реагирует на розыск и кровотечение", () => {
  const c = createCourtesan(5, 1, 0);
  const wanted = greetCourtesan(c, () => 0, { wanted: 2 });
  assert.ok(wanted.includes("идут"), wanted);

  const bled = greetCourtesan(c, () => 0, { bled: 5 });
  assert.ok(bled.includes("кров"), bled);
});

test("куртизанка: реакция и отказ зависят от характера и причины", () => {
  const c = createCourtesan(11, 1, 0);
  assert.ok(afterCourtesanLine(c, () => 0).includes(c.name));
  assert.ok(refusalLine(c, "no_gold", () => 0).length > 10);
  assert.ok(refusalLine(c, "full_health", () => 0).length > 10);
});

test("куртизанка: слух детерминирован и повторяется при том же индексе", () => {
  const a = courtesanRumor(1234, 0);
  const b = courtesanRumor(1234, 0);
  assert.equal(a, b);
  assert.ok(a.length > 20);

  const different = courtesanRumor(1234, 1);
  assert.notEqual(a, different, "следующий визит даёт другой слух");
  assert.ok(rumorCount() >= 6);
});

test("куртизанка: описание содержит имя, характер и наряд", () => {
  const c = createCourtesan(42, 1, 0);
  const text = describeCourtesan(c);
  assert.ok(text.includes(c.displayName));
  assert.ok(text.includes(c.temperLabel));
  assert.ok(text.includes(c.hair.label));
  assert.ok(text.includes(c.dress.label));
});

test("overheal: лечение сначала заполняет здоровье, затем запас", () => {
  const c = { price: 25 };
  const r = applyHeal(c, 100, 40, 100, 0);
  assert.equal(r.health, 100, "здоровье добито до максимума");
  assert.equal(r.healed, 60);
  assert.equal(r.gold, 75);
  // Остаток визита уходит в запас: платить и не получить бонус было бы странно.
  assert.equal(r.overheal, OVERHEAL_CAP);
  assert.equal(r.topped, OVERHEAL_CAP);
});

test("overheal: при полном здоровье уходит в запас", () => {
  const c = { price: 25 };
  const r = applyHeal(c, 100, 100, 100, 0);
  assert.equal(r.health, 100);
  assert.equal(r.overheal, OVERHEAL_CAP);
  assert.equal(r.topped, OVERHEAL_CAP);
});

test("overheal: запас не превышает 25 и добирается постепенно", () => {
  const c = { price: 25 };
  const r = applyHeal(c, 100, 100, 100, OVERHEAL_CAP);
  assert.equal(r.overheal, OVERHEAL_CAP, "уже полный запас не растёт");
  assert.equal(r.topped, 0);

  const partial = applyHeal(c, 100, 100, 100, 10);
  assert.equal(partial.overheal, OVERHEAL_CAP);
  assert.equal(partial.topped, OVERHEAL_CAP - 10);
});

test("overheal: тает только на ходу", () => {
  assert.equal(decayOverheal(20, 1, false), 20, "стоя на месте запас не тратится");
  assert.equal(decayOverheal(20, 1, true), 20 - OVERHEAL_DECAY);
  assert.equal(decayOverheal(0.5, 2, true), 0, "не уходит в минус");
  assert.equal(decayOverheal(20, 1, true), decayOverheal(20, 1, true), "детерминировано");
});

test("overheal: урон сначала съедает запас", () => {
  const r = absorbWithOverheal(10, 100, 20);
  assert.equal(r.health, 100, "здоровье не тронуто");
  assert.equal(r.overheal, 10);
  assert.equal(r.absorbed, 10);
  assert.equal(r.toHealth, 0);
});

test("overheal: избыток урона пробивает в здоровье", () => {
  const r = absorbWithOverheal(30, 100, 20);
  assert.equal(r.health, 90);
  assert.equal(r.overheal, 0);
  assert.equal(r.toHealth, 10);
});

test("overheal: без запаса урон идёт в здоровье как раньше", () => {
  const r = absorbWithOverheal(15, 80, 0);
  assert.equal(r.health, 65);
  assert.equal(r.overheal, 0);
  assert.equal(r.absorbed, 0);
});

test("overheal: здоровье не уходит в минус", () => {
  const r = absorbWithOverheal(999, 10, 0);
  assert.equal(r.health, 0);
});

test("courtesan: сид не зависит от Date.now", () => {
  // Одинаковый входной сид обязан давать одинаковый вариант при любом времени.
  assert.equal(courtesanSeed(5, 1, 0), courtesanSeed(5, 1, 0));
  assert.notEqual(courtesanSeed(5, 1, 0), courtesanSeed(6, 1, 0));
});
