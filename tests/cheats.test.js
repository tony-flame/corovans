import test from "node:test";
import assert from "node:assert/strict";

import { parseCommand, runCommand, CHEAT_HELP, commandNames } from "../src/cheats.js";
import { objectiveOf, progressOf, adviceFor, buildAdvicePanel } from "../src/advice.js";
import { createRun } from "../src/run.js";
import { createProfile } from "../src/profile.js";
import { createWorld } from "../src/world.js";

function makeCtx() {
  const run = createRun(1234, createProfile(), {});
  const world = createWorld();
  const player = {
    x: 12.5,
    y: 92.5,
    health: 100,
    maxHealth: 100,
    overheal: 0,
    dead: false,
  };
  const game = { godMode: false, noclip: false, speedMultiplier: 1, weather: null };
  const calls = [];

  return {
    ctx: {
      game,
      run,
      player,
      world,
      profile: createProfile(),
      setTier(v) {
        calls.push(["tier", v]);
        run.tier = v;
      },
      setAct(v) {
        calls.push(["act", v]);
        run.act = v;
      },
      setWeather(kind) {
        calls.push(["weather", kind]);
      },
    },
    calls,
    run,
    player,
    game,
  };
}

test("читы: parseCommand разбирает имя и аргументы", () => {
  assert.equal(parseCommand(""), null);
  assert.equal(parseCommand("   "), null);

  const p = parseCommand("  GOLD 500  ");
  assert.equal(p.name, "gold");
  assert.deepEqual(p.args, ["500"]);
});

test("читы: help выдаёт список команд", () => {
  const { ctx } = makeCtx();
  const r = runCommand("help", ctx);
  assert.equal(r.ok, true);
  assert.ok(r.message.includes("tgm"));
  assert.ok(r.message.includes("weather"));
  assert.ok(CHEAT_HELP.length >= 10);
  assert.ok(commandNames().some((n) => n.startsWith("gold")));
});

test("читы: tgm переключает бессмертие", () => {
  const { ctx, game } = makeCtx();
  assert.equal(game.godMode, false);

  runCommand("tgm", ctx);
  assert.equal(game.godMode, true);

  runCommand("tgm", ctx);
  assert.equal(game.godMode, false);
});

test("читы: god on/off задаёт явно", () => {
  const { ctx, game } = makeCtx();
  runCommand("god on", ctx);
  assert.equal(game.godMode, true);
  runCommand("god off", ctx);
  assert.equal(game.godMode, false);
});

test("читы: gold и hp устанавливают значения с клампом", () => {
  const { ctx, run, player } = makeCtx();

  runCommand("gold 500", ctx);
  assert.equal(run.gold, 500);

  runCommand("gold -10", ctx);
  assert.equal(run.gold, 0, "отрицательное золото не проходит");

  runCommand("hp 50", ctx);
  assert.equal(player.health, 50);

  runCommand("hp 9999", ctx);
  assert.equal(player.health, 100, "здоровье не выше максимума");
});

test("читы: heal снимает кровотечение и запас", () => {
  const { ctx, player, run } = makeCtx();
  player.health = 20;
  player.overheal = 15;
  run.bleed = { remaining: 10, dps: 2 };

  runCommand("heal", ctx);
  assert.equal(player.health, 100);
  assert.equal(player.overheal, 0);
  assert.equal(run.bleed.remaining, 0);
});

test("читы: tp перемещает игрока", () => {
  const { ctx, player } = makeCtx();
  runCommand("tp 40 60", ctx);
  assert.equal(player.x, 40);
  assert.equal(player.y, 60);
});

test("читы: tp без координат не падает", () => {
  const { ctx } = makeCtx();
  const r = runCommand("tp 40", ctx);
  assert.equal(r.ok, false);
  assert.ok(r.message.includes("X Y"));
});

test("читы: tier и act вызывают колбэки", () => {
  const { ctx, calls, run } = makeCtx();
  runCommand("tier 3", ctx);
  assert.deepEqual(calls.find((c) => c[0] === "tier"), ["tier", 3]);
  assert.equal(run.tier, 3);

  runCommand("act 1", ctx);
  assert.deepEqual(calls.find((c) => c[0] === "act"), ["act", 1]);

  runCommand("act 99", ctx);
  assert.equal(run.act, 2, "акт клампится в 0..2");
});

test("читы: wanted клампится в 0..5", () => {
  const { ctx, run } = makeCtx();
  runCommand("wanted 3", ctx);
  assert.equal(run.wanted, 3);
  runCommand("wanted 99", ctx);
  assert.equal(run.wanted, 5);
});

test("читы: weather понимает английский и русский", () => {
  const { ctx, calls } = makeCtx();
  runCommand("weather snow", ctx);
  assert.deepEqual(calls.pop(), ["weather", "snow"]);

  runCommand("weather снег", ctx);
  assert.deepEqual(calls.pop(), ["weather", "snow"]);

  runCommand("weather дождь", ctx);
  assert.deepEqual(calls.pop(), ["weather", "rain"]);

  const bad = runCommand("weather лава", ctx);
  assert.equal(bad.ok, false);
});

test("читы: speed и noclip", () => {
  const { ctx, game } = makeCtx();
  runCommand("speed 3", ctx);
  assert.equal(game.speedMultiplier, 3);

  runCommand("speed 100", ctx);
  assert.equal(game.speedMultiplier, 10, "скорость клампится");

  assert.equal(game.noclip, false);
  runCommand("noclip", ctx);
  assert.equal(game.noclip, true);
  runCommand("noclip", ctx);
  assert.equal(game.noclip, false);
});

test("читы: kit выдаёт золото и лечит", () => {
  const { ctx, run, player } = makeCtx();
  player.health = 5;
  runCommand("kit", ctx);
  assert.ok(run.gold >= 1000);
  assert.equal(player.health, 100);
});

test("читы: неизвестная команда даёт понятную ошибку", () => {
  const { ctx } = makeCtx();
  const r = runCommand("blah", ctx);
  assert.equal(r.ok, false);
  assert.ok(r.message.includes("blah"));
  assert.ok(r.message.includes("help"));
});

test("советы: цель — ограбить, если караван цел", () => {
  const run = createRun(1, createProfile(), {});
  const world = createWorld();
  const player = { x: 12.5, y: 92.5, health: 100, maxHealth: 100 };

  const obj = objectiveOf({ run, world, player });
  assert.ok(obj.toLowerCase().includes("караван"), obj);
});

test("советы: цель — продать, если фургон обобран", () => {
  const run = createRun(1, createProfile(), {});
  run.wagonLooted = true;
  run.inventory.items.push({ id: "a", name: "A", value: 10, weight: 1 });
  const world = createWorld();
  world.wagonLooted = true;

  const obj = objectiveOf({ run, world, player: { x: 12.5, y: 92.5, health: 100, maxHealth: 100 } });
  assert.ok(obj.includes("Продайте"), obj);
});

test("советы: прогресс считается от золота", () => {
  const run = createRun(1, createProfile(), {});
  run.gold = 150;
  run.act = 0;

  const p = progressOf({ run });
  assert.equal(p.goal, 300);
  assert.equal(p.current, 150);
  assert.equal(p.percent, 50);
});

test("советы: прогресс не превышает 100%", () => {
  const run = createRun(1, createProfile(), {});
  run.gold = 9999;
  const p = progressOf({ run });
  assert.equal(p.percent, 100);
});

test("советы: мало здоровья — совет про еду или куртизанку", () => {
  const run = createRun(1, createProfile(), {});
  const tips = adviceFor({
    run,
    world: createWorld(),
    player: { x: 12.5, y: 92.5, health: 20, maxHealth: 100 },
    game: { weather: null },
  });
  assert.ok(tips.some((t) => t.includes("Здоровье") || t.includes("еду")), JSON.stringify(tips));
});

test("советы: розыск даёт совет про штраф", () => {
  const run = createRun(1, createProfile(), {});
  run.wanted = 2;
  const tips = adviceFor({
    run,
    world: createWorld(),
    player: { x: 12.5, y: 92.5, health: 100, maxHealth: 100 },
    game: { weather: null },
  });
  assert.ok(tips.some((t) => t.includes("Розыск")), JSON.stringify(tips));
});

test("советы: бесплатный визит упоминается", () => {
  const run = createRun(1, createProfile(), {});
  run.courtesanAffinity = { square: 2, inn: 0, forest: 0, camp: 0 };
  const tips = adviceFor({
    run,
    world: createWorld(),
    player: { x: 12.5, y: 92.5, health: 100, maxHealth: 100 },
    game: { weather: null },
  });
  assert.ok(tips.some((t) => t.includes("бесплатно")), JSON.stringify(tips));
});

test("советы: не больше трёх пунктов", () => {
  const run = createRun(1, createProfile(), {});
  run.wanted = 3;
  run.courtesanAffinity = { square: 2, inn: 2, forest: 2, camp: 2 };
  run.bleed = { remaining: 5, dps: 1 };
  const tips = adviceFor({
    run,
    world: createWorld(),
    player: { x: 12.5, y: 92.5, health: 15, maxHealth: 100 },
    game: { weather: { intensity: 0.9 } },
  });
  assert.ok(tips.length <= 3, `советов: ${tips.length}`);
});

test("советы: панель собирается целиком", () => {
  const run = createRun(1, createProfile(), {});
  const panel = buildAdvicePanel({
    run,
    world: createWorld(),
    player: { x: 12.5, y: 92.5, health: 100, maxHealth: 100 },
    game: { weather: null },
  });
  assert.ok(panel.objective.length > 5);
  assert.ok(panel.progress.goal > 0);
  assert.ok(Array.isArray(panel.tips));
  assert.ok(panel.act);
});
