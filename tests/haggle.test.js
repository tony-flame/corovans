import test from "node:test";
import assert from "node:assert/strict";

import {
  rollHaggle,
  haggledPrice,
  rollText,
  canHaggle,
  rollsLeft,
  makeHaggleRng,
  MAX_ROLLS,
  WIN_BONUS,
  LOSS_PENALTY,
} from "../src/haggle.js";
import { createRng } from "../src/rng.js";

test("торг: выигрыш даёт наценку, проигрыш — скидку", () => {
  const win = { player: 6, merchant: 2, won: true, multiplier: 1 + WIN_BONUS };
  const loss = { player: 1, merchant: 5, won: false, multiplier: 1 - LOSS_PENALTY };

  assert.equal(haggledPrice(100, win), 120);
  assert.equal(haggledPrice(100, loss), 85);
});

test("торг: ничья в пользу Мардо", () => {
  // Перебираем сид, пока не найдём бросок с равными кубиками.
  let found = null;
  for (let seed = 0; seed < 400 && !found; seed++) {
    const r = rollHaggle(createRng(seed));
    if (r.player === r.merchant) found = r;
  }
  assert.ok(found, "не нашлось ни одного равного броска");
  assert.equal(found.won, false, "при равенстве должен побеждать Мардо");
  assert.equal(found.multiplier, 1 - LOSS_PENALTY);
});

test("торг: кубики в диапазоне d6", () => {
  for (let seed = 0; seed < 200; seed++) {
    const r = rollHaggle(createRng(seed));
    assert.ok(r.player >= 1 && r.player <= 6, `кубик игрока вне d6: ${r.player}`);
    assert.ok(r.merchant >= 1 && r.merchant <= 6, `кубик Мардо вне d6: ${r.merchant}`);
    assert.equal(r.won, r.player > r.merchant);
  }
});

test("торг: результат воспроизводим по сиду", () => {
  const a = rollHaggle(makeHaggleRng(42, 0, 3));
  const b = rollHaggle(makeHaggleRng(42, 0, 3));
  assert.deepEqual(a, b);

  // Другой номер попытки — другой бросок (в общем случае).
  const rolls = new Set();
  for (let i = 0; i < 10; i++) {
    const r = rollHaggle(makeHaggleRng(42, i, 0));
    rolls.add(`${r.player}-${r.merchant}`);
  }
  assert.ok(rolls.size > 1, "все попытки дают один и тот же бросок");
});

test("торг: попытки кончаются", () => {
  assert.equal(rollsLeft(0), MAX_ROLLS);
  assert.equal(rollsLeft(MAX_ROLLS), 0);
  assert.equal(rollsLeft(99), 0, "больше нуля попыток быть не может");

  assert.equal(canHaggle(100, 0), true);
  assert.equal(canHaggle(100, MAX_ROLLS), false);
  assert.equal(canHaggle(0, 0), false, "нечего продавать — нечего торговать");
});

test("торг: цена не уходит в минус и не даёт лишних монет", () => {
  const loss = { player: 1, merchant: 6, won: false, multiplier: 1 - LOSS_PENALTY };
  assert.equal(haggledPrice(1, loss), 0, "округление вниз, не вверх");

  const win = { player: 6, merchant: 1, won: true, multiplier: 1 + WIN_BONUS };
  // 33 * 1.2 = 39.6 → 39, а не 40.
  assert.equal(haggledPrice(33, win), 39);
});

test("торг: текст броска различает исход", () => {
  const win = rollText({ player: 6, merchant: 1, won: true });
  const loss = rollText({ player: 1, merchant: 6, won: false });
  assert.match(win, /Вы 6 — Мардо 1/);
  assert.match(loss, /Вы 1 — Мардо 6/);
  assert.notEqual(win, loss);
});

test("торг: выигрыш в среднем чуть хуже честной продажи", () => {
  // Мардо не должен быть источником денег: матожидание 1.25/0.85
  // при 21 из 36 проигрышей даёт меньше единицы. Если формулу
  // «улучшат», не пересчитав баланс, этот тест это поймает.
  let sum = 0;
  const N = 2000;
  for (let seed = 0; seed < N; seed++) {
    sum += rollHaggle(createRng(seed)).multiplier;
  }
  const mean = sum / N;
  assert.ok(mean < 1, `средний множитель ${mean.toFixed(3)} — торг выгоднее честной цены`);
  assert.ok(mean > 0.85, `средний множитель ${mean.toFixed(3)} — Мардо грабит`);
});
