import test from "node:test";
import assert from "node:assert/strict";

import { createFrameLoop, createErrorReporter } from "../src/loop.js";

// Регрессия на настоящий баг: requestAnimationFrame стоял последней
// строкой кадра, поэтому любое исключение останавливало цикл навсегда.
// Игра замирала стоп-кадром, помогала только перезагрузка.

test("цикл: исключение в кадре не останавливает цикл", () => {
  const scheduled = [];
  const errors = [];
  let calls = 0;

  const frame = createFrameLoop(
    () => {
      calls += 1;
      if (calls === 2) throw new Error("кадр упал");
    },
    (fn) => scheduled.push(fn),
    (e) => errors.push(e.message)
  );

  // Запускаем вручную, как это делал бы requestAnimationFrame.
  frame(0);
  assert.equal(scheduled.length, 1, "первый кадр должен запланировать второй");

  const second = scheduled.pop();
  second(16);
  assert.equal(scheduled.length, 1, "упавший кадр ОБЯЗАН запланировать следующий");
  assert.deepEqual(errors, ["кадр упал"]);

  const third = scheduled.pop();
  third(32);
  assert.equal(scheduled.length, 1, "цикл продолжается после ошибки");
  assert.equal(frame.stats().failures, 1);
  assert.equal(frame.stats().frames, 3);
});

test("цикл: stop() прекращает планирование", () => {
  const scheduled = [];
  const frame = createFrameLoop(() => {}, (fn) => scheduled.push(fn));

  frame(0);
  assert.equal(scheduled.length, 1);

  frame.stop();
  scheduled.pop()(16);
  assert.equal(scheduled.length, 0, "после stop кадры планироваться не должны");
});

test("цикл: после stop тело не вызывается", () => {
  let calls = 0;
  const scheduled = [];
  const frame = createFrameLoop(() => { calls += 1; }, (fn) => scheduled.push(fn));

  frame(0);
  frame.stop();
  frame(16);
  assert.equal(calls, 1, "тело не должно вызываться после остановки");
});

test("ошибки: одинаковый текст печатается один раз", () => {
  const seen = [];
  const report = createErrorReporter((error, text) => seen.push(text));

  report(new Error("boom"));
  report(new Error("boom"));
  report(new Error("boom"));
  assert.equal(seen.length, 1, "консоль не должна получать 60 копий в секунду");

  report(new Error("другая беда"));
  assert.equal(seen.length, 2);
});

test("ошибки: сообщение без message не роняет отчёт", () => {
  const seen = [];
  const report = createErrorReporter((e, text) => seen.push(text));
  assert.equal(report("просто строка"), true);
  assert.equal(report(undefined), true);
  assert.equal(seen.length, 2);
});

test("цикл: тысяча падений подряд не ломает планировщик", () => {
  const scheduled = [];
  let frames = 0;
  const frame = createFrameLoop(
    () => { throw new Error("всегда падает"); },
    (fn) => scheduled.push(fn),
    () => {}
  );

  let next = frame;
  for (let i = 0; i < 1000; i++) {
    next(0);
    assert.equal(scheduled.length, 1, `кадр ${i}: цикл остановился`);
    next = scheduled.pop();
    frames++;
  }
  assert.equal(frames, 1000);
  assert.equal(frame.stats().failures, 1000);
});
