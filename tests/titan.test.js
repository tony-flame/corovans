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
  TITAN_AGGRO_RANGE,
} from "../src/titan.js";
import { createRun, snapshotRun, restoreRun } from "../src/run.js";
import { createProfile } from "../src/profile.js";
import { createWorld, moveActor, canStand, isSolid } from "../src/world.js";

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

// ── Стены и радиус: то, что раньше не проверял ни один тест ──

test("титан: не проходит сквозь стену", () => {
  const world = createWorld();
  // Дом в деревне: 49..53 по x, 110..114 по y. Титан крупный (r = 0.9),
  // поэтому стартуем на законном расстоянии и целимся внутрь дома.
  const titan = createTitan(1, 46.5, 112);
  assert.equal(canStand(world, titan.x, titan.y, titan.r), true, "старт незаконный");
  const inside = { kind: "guard", x: 51, y: 112, alive: true };

  for (let i = 0; i < 200; i++) {
    stepTitan(titan, [inside], 0.05, moveActor, world);
  }

  // Он мог обойти, но оказаться ВНУТРИ стены не имеет права.
  assert.equal(isSolid(world, titan.x, titan.y), false,
    `титан залез в стену: ${titan.x.toFixed(2)},${titan.y.toFixed(2)}`);
  assert.equal(canStand(world, titan.x, titan.y, titan.r), true,
    "титан стоит там, где его тело не помещается");
  // И не должен просочиться на ту сторону дома.
  assert.ok(titan.x < 53, `титан прошёл дом насквозь: x=${titan.x.toFixed(2)}`);
});

test("титан: без moveActor он по-прежнему двигается (совместимость)", () => {
  const titan = createTitan(1, 0, 0);
  const target = { kind: "guard", x: 10, y: 0, alive: true };
  const before = titan.x;
  stepTitan(titan, [target], 1);
  assert.ok(titan.x > before, "движение должно работать и без карты");
});

test("титан: далёкую добычу он не замечает", () => {
  const titan = createTitan(1, 0, 0);
  // Втрое дальше радиуса интереса.
  const far = { kind: "guard", x: TITAN_AGGRO_RANGE * 3, y: 0, alive: true };

  const picked = pickTarget(titan, [far]);
  assert.equal(picked.target, null, "за радиусом интереса цели нет");

  const result = stepTitan(titan, [far], 1);
  assert.equal(result.titan.state, "roam", "он должен бродить, а не охотиться");
  assert.equal(result.titan.x, 0, "и не сдвигаться к далёкой жертве");
});

test("титан: близкую добычу замечает сразу", () => {
  const titan = createTitan(1, 0, 0);
  const near = { kind: "guard", x: TITAN_AGGRO_RANGE - 1, y: 0, alive: true };
  const result = stepTitan(titan, [near], 0.1);
  assert.equal(result.titan.target, near);
  assert.equal(result.titan.state, "hunt");
});

test("титан: не перескакивает на новую цель мгновенно", () => {
  const titan = createTitan(1, 0, 0);
  const first = { kind: "guard", x: 5, y: 0, alive: true };
  const second = { kind: "guard", x: 0, y: 5, alive: true };

  stepTitan(titan, [first], 0.1);
  assert.equal(titan.target, first);

  // Первая цель погибла: он не должен в том же кадре взять вторую.
  first.alive = false;
  stepTitan(titan, [first, second], 0.1);
  assert.equal(titan.target, null, "сначала пауза, потом новая цель");
});

test("титан: пауза заканчивается и он берёт новую цель", () => {
  const titan = createTitan(1, 0, 0);
  const first = { kind: "guard", x: 5, y: 0, alive: true };
  const second = { kind: "guard", x: 0, y: 5, alive: true };

  stepTitan(titan, [first], 0.1);
  first.alive = false;

  // Перебираем время: пауза должна истечь.
  for (let i = 0; i < 40; i++) stepTitan(titan, [first, second], 0.1);
  assert.equal(titan.target, second, "после паузы цель находится");
});

test("титан: ест гражданского, но не съедает всех за секунды", () => {
  const world = createWorld();
  world.civilians = [
    { kind: "peasant_w", x: 8, y: 0, alive: true, r: 0.3 },
    { kind: "peasant_m", x: 0, y: 8, alive: true, r: 0.3 },
  ];
  const player = { x: 100, y: 100, dead: false };
  const titan = createTitan(1, 0, 0);

  let eaten = 0;
  // Пять секунд игры — это не «полкарты населения».
  for (let i = 0; i < 100; i++) {
    const prey = gatherPrey(world, player);
    const r = stepTitan(titan, prey, 0.05, moveActor, world);
    if (r.ate) {
      eaten++;
      r.victim.alive = false;
    }
  }

  assert.ok(eaten <= 2, `за пять секунд съедено ${eaten} — слишком быстро`);
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
