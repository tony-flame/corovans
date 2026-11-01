import test from "node:test";
import assert from "node:assert/strict";

import { drawIntro, INTRO_KINDS, INTRO_W, INTRO_H } from "../src/intro.js";

// Заглушка 2D-контекста: записывает вызовы, ничего не рисуя.
// Заставки не должны зависеть от настоящего canvas, иначе их нельзя
// проверить без браузера — а именно так они и ломались молча.
function fakeCtx() {
  const calls = [];
  const record = (name) => (...args) => {
    calls.push({ name, args });
    return name === "createLinearGradient" || name === "createRadialGradient"
      ? { addColorStop: () => {} }
      : undefined;
  };
  return {
    calls,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: record("fillRect"),
    strokeRect: record("strokeRect"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arc: record("arc"),
    ellipse: record("ellipse"),
    fill: record("fill"),
    stroke: record("stroke"),
    save: record("save"),
    restore: record("restore"),
    translate: record("translate"),
    rotate: record("rotate"),
    createLinearGradient: record("createLinearGradient"),
    createRadialGradient: record("createRadialGradient"),
  };
}

test("заставки: три вида объявлены", () => {
  assert.deepEqual(new Set(INTRO_KINDS), new Set(["dusk", "death", "gold"]));
});

test("заставки: каждая рисует что-то и не падает", () => {
  for (const kind of INTRO_KINDS) {
    const ctx = fakeCtx();
    const size = drawIntro(ctx, kind);
    assert.equal(size.width, INTRO_W);
    assert.equal(size.height, INTRO_H);
    assert.ok(ctx.calls.length > 20, `${kind}: слишком мало вызовов рисования`);
    // Ни один цвет не должен быть пустым — иначе заставка серая.
    for (const call of ctx.calls) {
      if (call.name !== "fillRect" && call.name !== "arc") continue;
      for (const arg of call.args) {
        if (typeof arg === "string" && arg.trim() === "") {
          assert.fail(`${kind}: пустой цвет в ${call.name}`);
        }
      }
    }
  }
});

test("заставки: неизвестный вид не роняет игру", () => {
  const ctx = fakeCtx();
  const size = drawIntro(ctx, "нет-такого");
  assert.equal(size.width, INTRO_W);
  assert.ok(ctx.calls.length > 20, "должна нарисоваться заставка по умолчанию");
});

test("заставки: детерминированы — одна и та же картинка", () => {
  for (const kind of INTRO_KINDS) {
    const a = fakeCtx();
    const b = fakeCtx();
    drawIntro(a, kind);
    drawIntro(b, kind);
    assert.equal(a.calls.length, b.calls.length, `${kind}: разное число вызовов`);
    for (let i = 0; i < a.calls.length; i++) {
      assert.deepEqual(a.calls[i], b.calls[i], `${kind}: вызов ${i} отличается`);
    }
  }
});

test("заставки: не зависят от Math.random", () => {
  // Подмена Math.random не должна ничего менять: всё идёт через сид.
  const original = Math.random;
  Math.random = () => 0.99;
  try {
    for (const kind of INTRO_KINDS) {
      const a = fakeCtx();
      const b = fakeCtx();
      drawIntro(a, kind);
      Math.random = () => 0.01;
      drawIntro(b, kind);
      Math.random = () => 0.99;
      assert.equal(a.calls.length, b.calls.length, `${kind}: Math.random влияет на картинку`);
    }
  } finally {
    Math.random = original;
  }
});
