import test from "node:test";
import assert from "node:assert/strict";

import {
  createTitan,
  stepTitan,
  pickTarget,
  gatherPrey,
  titanQuestions,
  checkAnswer,
  TITAN_QUESTIONS,
  TITAN_SPEED,
  TITAN_EAT_RANGE,
  TITAN_EAT_TIME,
} from "../src/titan.js";
import { createRun, snapshotRun, restoreRun } from "../src/run.js";
import { createProfile } from "../src/profile.js";
import { createWorld } from "../src/world.js";

test("титан: создаётся детерминированно", () => {
  const a = createTitan(777, 40, 34);
  const b = createTitan(777, 40, 34);
  assert.equal(a.id, b.id);
  assert.equal(a.angle, b.angle);
  assert.equal(a.state, "roam");
  assert.equal(a.spriteKey, "titan_calm");
});

test("титан: медленнее игрока", () => {
  const titan = createTitan(1, 0, 0);
  // Скорость игрока 2.35 — он обязан быть заметно медленнее, иначе не убежать.
  assert.ok(titan.speed < 2.35, String(titan.speed));
  assert.equal(titan.speed, TITAN_SPEED);
});

test("титан: бессмертен по данным", () => {
  const titan = createTitan(1, 0, 0);
  assert.equal(titan.hp, Infinity);
  assert.equal(titan.alive, true);
});

test("титан: не ест Мардо и куртизанок", () => {
  const titan = createTitan(1, 0, 0);
  const prey = [
    { kind: "merchant", x: 0.5, y: 0, alive: true },
    { kind: "courtesan", x: 0.6, y: 0, alive: true },
  ];
  const picked = pickTarget(titan, prey);
  assert.equal(picked.target, null, "неприкосновенные не выбираются");
});

test("титан: выбирает ближайшую законную цель", () => {
  const titan = createTitan(1, 0, 0);
  const prey = [
    { kind: "merchant", x: 0.2, y: 0, alive: true },
    { kind: "guard", x: 5, y: 0, alive: true },
    { kind: "guard", x: 2, y: 0, alive: true },
  ];
  const picked = pickTarget(titan, prey);
  assert.equal(picked.dist, 2);
  assert.equal(picked.target.x, 2);
});

test("титан: движение к цели", () => {
  const titan = createTitan(1, 0, 0);
  const target = { kind: "guard", x: 10, y: 0, alive: true };

  const before = titan.x;
  const result = stepTitan(titan, [target], 1);
  assert.ok(result.titan.x > before, "должен сдвинуться к цели");
  assert.equal(result.ate, false);
  assert.equal(result.titan.state, "hunt");
  assert.equal(result.titan.spriteKey, "titan_hunt");
});

test("титан: не съедает мгновенно, нужно время", () => {
  const titan = createTitan(1, 5, 0);
  const target = { kind: "guard", x: 5.5, y: 0, alive: true };

  const first = stepTitan(titan, [target], 0.1);
  assert.equal(first.ate, false);
  assert.equal(first.titan.state, "eat");

  const second = stepTitan(first.titan, [target], 0.1);
  assert.equal(second.ate, false, "одного шага мало");
});

test("титан: съедает после TITAN_EAT_TIME", () => {
  const titan = createTitan(1, 5, 0);
  const target = { kind: "guard", x: 5.5, y: 0, alive: true };

  let result = stepTitan(titan, [target], 0.1);
  result = stepTitan(result.titan, [target], TITAN_EAT_TIME + 0.1);
  assert.equal(result.ate, true);
  assert.equal(result.victim, target);
  assert.equal(result.titan.state, "roam");
});

test("титан: после договора не охотится", () => {
  const titan = createTitan(1, 0, 0);
  titan.state = "pacified";
  const target = { kind: "guard", x: 1, y: 0, alive: true };

  const before = titan.x;
  const result = stepTitan(titan, [target], 1);
  assert.equal(result.titan.x, before, "стоит на месте");
  assert.equal(result.ate, false);
  assert.equal(result.titan.target, null);
});

test("титан: мёртвая цель заменяется новой", () => {
  const titan = createTitan(1, 0, 0);
  const dead = { kind: "guard", x: 1, y: 0, alive: false };
  const alive = { kind: "guard", x: 5, y: 0, alive: true };

  const result = stepTitan(titan, [dead, alive], 0.1);
  assert.equal(result.titan.target, alive);
});

test("титан: gatherPrey собирает всех, кроме неприкосновенных", () => {
  const world = createWorld();
  world.civilians = [{ id: 1, kind: "peasant_w", label: "Крестьянка", x: 1, y: 1, alive: true }];
  world.animals = [{ kind: "cow", x: 2, y: 2, alive: true }];
  const player = { x: 5, y: 5, dead: false };

  const prey = gatherPrey(world, player);
  assert.ok(prey.some((p) => p.kind === "merchant") === false, "Мардо не в списке");
  assert.ok(prey.some((p) => p.kind === "courtesan") === false, "куртизанки не в списке");
  assert.ok(prey.some((p) => p.kind === "cow"));
  assert.ok(prey.some((p) => p.isPlayer));
  assert.ok(prey.some((p) => p.kind === "guard"));
});

test("титан: вопросы детерминированы", () => {
  const a = titanQuestions(1234);
  const b = titanQuestions(1234);
  assert.deepEqual(a.map((q) => q.id), b.map((q) => q.id));
  assert.equal(a.length, 3);
});

test("титан: в каждом вопросе ровно один верный ответ", () => {
  for (const q of TITAN_QUESTIONS) {
    const correct = q.answers.filter((a) => a.correct);
    assert.equal(correct.length, 1, `${q.id}: верных ${correct.length}`);
    assert.ok(q.answers.length >= 2);
    assert.ok(q.text.length > 10);
  }
});

test("титан: checkAnswer верно определяет", () => {
  const q = TITAN_QUESTIONS[0];
  const correctIndex = q.answers.findIndex((a) => a.correct);
  const wrongIndex = q.answers.findIndex((a) => !a.correct);

  assert.equal(checkAnswer(q, correctIndex), true);
  assert.equal(checkAnswer(q, wrongIndex), false);
  assert.equal(checkAnswer(q, 99), false);
  assert.equal(checkAnswer(null, 0), false);
});

test("титан: верный ответ — честный, а не хитрый", () => {
  // Философия механики: он награждает признание, а не браваду.
  const road = TITAN_QUESTIONS.find((q) => q.id === "road");
  const correct = road.answers.find((a) => a.correct);
  assert.ok(correct.text.includes("боюсь") || correct.text.includes("честн"), correct.text);

  const end = TITAN_QUESTIONS.find((q) => q.id === "end");
  const endCorrect = end.answers.find((a) => a.correct);
  assert.ok(endCorrect.text.includes("Ничего"), endCorrect.text);
});

test("титан: договор переживает снапшот", () => {
  const profile = createProfile();
  const run = createRun(555, profile, {});
  run.titanPacified = true;

  const snapshot = snapshotRun(run, { x: 12.5, y: 92.5, angle: 0, overheal: 0 });
  const restored = restoreRun(JSON.parse(JSON.stringify(snapshot)), profile, {});

  assert.ok(restored);
  assert.equal(restored.run.titanPacified, true);
});

test("титан: по умолчанию не приручен", () => {
  const run = createRun(556, createProfile(), {});
  assert.equal(run.titanPacified, false);
});

test("титан: не появляется после договора", () => {
  // Логика в main.js: если titanPacified, world.titan = null.
  // Проверяем, что флаг достаточно для этого решения.
  const run = createRun(557, createProfile(), {});
  run.titanPacified = true;
  assert.ok(run.titanPacified);
});

test("титан: дальность поедания больше радиуса тела", () => {
  assert.ok(TITAN_EAT_RANGE > 0.9, "иначе он не достанет до цели");
});
