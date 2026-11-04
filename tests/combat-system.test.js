import test from "node:test";
import assert from "node:assert/strict";

import {
  performAttack,
  pickTarget,
  killActor,
  killAnimal,
  alertNoise,
  damagePlayer,
  IMMUNE_KINDS,
  MELEE_RANGE,
} from "../src/systems/combat.js";
import { createState } from "../src/core/state.js";
import { createRun } from "../src/run.js";
import { createRng } from "../src/rng.js";
import { createInventory } from "../src/inventory.js";
import { createUpgrades } from "../src/economy.js";
import { createProfile } from "../src/profile.js";

// ── Заглушки ────────────────────────────────────────────────────────

function fakeUi() {
  const messages = [];
  let flashes = 0;
  return {
    messages,
    get flashes() {
      return flashes;
    },
    message(t) {
      messages.push(t);
    },
    flashHit() {
      flashes += 1;
    },
  };
}

function fakeAudio() {
  const calls = [];
  const record = (name) => () => calls.push(name);
  return {
    calls,
    swing: record("swing"),
    hit: record("hit"),
    guardHit: record("guardHit"),
    guardDeath: record("guardDeath"),
    coin: record("coin"),
    hurt: record("hurt"),
    block: record("block"),
    beast: record("beast"),
  };
}

function makePlayer(overrides = {}) {
  return {
    x: 10,
    y: 10,
    dirX: 1,
    dirY: 0,
    attackCd: 0,
    swingT: 0,
    dead: false,
    blocking: false,
    stamina: 100,
    health: 100,
    maxHealth: 100,
    overheal: 0,
    hurtFlash: 0,
    blockBroke: 0,
    ...overrides,
  };
}

function makeGuard(x = 11, y = 10, overrides = {}) {
  return {
    kind: "guard",
    x,
    y,
    hp: 30,
    alive: true,
    state: "idle",
    suspicion: 0,
    alerted: false,
    asleep: false,
    ...overrides,
  };
}

function makeCtx(overrides = {}) {
  const state = createState();
  state.run = createRun(1234, createProfile(), { bonuses: null });
  state.run.inventory = createInventory(99);
  state.run.upgrades = createUpgrades();
  state.run.gold = 0;
  state.rng = createRng(1);
  state.ui = fakeUi();

  const ctx = {
    state,
    game: { mounted: null, godMode: false, gameOver: false, noiseTimer: 0 },
    world: { actors: [], animals: [], titan: null },
    player: makePlayer(),
    audio: fakeAudio(),
    noteStyle() {},
    saveCheckpoint() {},
    evaluateContract() {},
    checkActProgress() {},
    die() {
      this.died = true;
    },
    refreshQuestState() {},
    died: false,
    ...overrides,
  };

  return ctx;
}

// ── Выбор цели ──────────────────────────────────────────────────────

test("бой: цель ищется в конусе удара", () => {
  const ctx = makeCtx();
  const guard = makeGuard(11, 10);
  ctx.world.actors = [guard];

  const target = pickTarget(ctx.world, ctx.player);
  assert.ok(target, "цель не найдена");
  assert.equal(target.actor, guard);
  assert.equal(target.isAnimal, false);
});

test("бой: за спиной цели нет", () => {
  const ctx = makeCtx();
  ctx.world.actors = [makeGuard(9, 10)]; // сзади
  assert.equal(pickTarget(ctx.world, ctx.player), null);
});

test("бой: слишком далеко — не достать", () => {
  const ctx = makeCtx();
  ctx.world.actors = [makeGuard(10 + MELEE_RANGE + 1, 10)];
  assert.equal(pickTarget(ctx.world, ctx.player), null);
});

test("бой: Мардо и куртизанка — не цели", () => {
  const ctx = makeCtx();
  ctx.world.actors = [
    makeGuard(11, 10, { kind: "merchant" }),
    makeGuard(11.2, 10, { kind: "courtesan" }),
  ];
  assert.equal(pickTarget(ctx.world, ctx.player), null, "неприкосновенный попал в цели");
  assert.ok(IMMUNE_KINDS.has("merchant"));
  assert.ok(IMMUNE_KINDS.has("courtesan"));
});

test("бой: мёртвый не выбирается", () => {
  const ctx = makeCtx();
  ctx.world.actors = [makeGuard(11, 10, { alive: false })];
  assert.equal(pickTarget(ctx.world, ctx.player), null);
});

test("бой: выбирается ближайшая из двух", () => {
  const ctx = makeCtx();
  const far = makeGuard(11.5, 10);
  const near = makeGuard(10.6, 10);
  ctx.world.actors = [far, near];

  const target = pickTarget(ctx.world, ctx.player);
  assert.equal(target.actor, near, "выбрана не ближайшая цель");
});

test("бой: зверь ближе стражника — бьём зверя", () => {
  const ctx = makeCtx();
  const guard = makeGuard(11.6, 10);
  const animal = { kind: "fox", x: 10.5, y: 10, hp: 10, alive: true };
  ctx.world.actors = [guard];
  ctx.world.animals = [animal];

  const target = pickTarget(ctx.world, ctx.player);
  assert.equal(target.actor, animal);
  assert.equal(target.isAnimal, true);
});

// ── Удар ────────────────────────────────────────────────────────────

test("бой: удар тратит кулдаун и замах", () => {
  const ctx = makeCtx();
  ctx.world.actors = [makeGuard(11, 10)];
  ctx.player.attackCd = 0;

  performAttack(ctx);
  assert.ok(ctx.player.attackCd > 0, "кулдаун не выставлен");
  assert.ok(ctx.player.swingT > 0, "замах не начат");
});

test("бой: во время кулдауна удар не проходит", () => {
  const ctx = makeCtx();
  ctx.world.actors = [makeGuard(11, 10)];
  ctx.player.attackCd = 5;

  performAttack(ctx);
  assert.equal(ctx.world.actors[0].hp, 30, "удар прошёл во время кулдауна");
});

test("бой: блокирующий не бьёт", () => {
  const ctx = makeCtx();
  ctx.world.actors = [makeGuard(11, 10)];
  ctx.player.blocking = true;

  performAttack(ctx);
  assert.equal(ctx.world.actors[0].hp, 30);
});

test("бой: удар поднимает тревогу у стражника", () => {
  const ctx = makeCtx();
  const guard = makeGuard(11, 10);
  ctx.world.actors = [guard];

  performAttack(ctx);
  assert.ok(guard.hp < 30, "урон не прошёл");
  assert.equal(guard.state, "chase");
  assert.equal(guard.alerted, true);
});

test("бой: удар будит спящего", () => {
  const ctx = makeCtx();
  const guard = makeGuard(11, 10, { asleep: true });
  ctx.world.actors = [guard];

  performAttack(ctx);
  assert.equal(guard.asleep, false);
});

test("бой: титан неуязвим, но кулдаун тратится", () => {
  const ctx = makeCtx();
  ctx.world.titan = { x: 10.5, y: 10, alive: true };
  ctx.player.attackCd = 0;

  performAttack(ctx);
  assert.ok(ctx.player.attackCd > 0, "кулдаун не потрачен");
  assert.ok(ctx.state.ui.messages.some((m) => /нельзя убить/.test(m)));
});

// ── Убийство ────────────────────────────────────────────────────────

test("убийство: розыск растёт, счётчик тикает", () => {
  const ctx = makeCtx();
  const guard = makeGuard(11, 10, { hp: 1 });
  ctx.world.actors = [guard];

  performAttack(ctx);
  assert.equal(guard.alive, false);
  assert.equal(ctx.state.run.wanted, 1);
  assert.equal(ctx.state.run.counters.kills, 1);
  assert.equal(ctx.state.run.counters.killsSinceAccept, 1);
});

test("убийство: возница отмечается отдельно", () => {
  const ctx = makeCtx();
  killActor(ctx, makeGuard(11, 10, { kind: "driver" }));
  assert.equal(ctx.state.run.counters.driverKilledSinceAccept, true);
});

test("убийство: золото падает с трупа", () => {
  const ctx = makeCtx();
  const before = ctx.state.run.gold;
  killActor(ctx, makeGuard(11, 10));
  assert.ok(ctx.state.run.gold > before, "добыча не начислена");
});

test("убийство: розыск не превышает 5", () => {
  const ctx = makeCtx();
  ctx.state.run.wanted = 5;
  killActor(ctx, makeGuard(11, 10));
  assert.equal(ctx.state.run.wanted, 5, "розыск вышел за предел");
});

// ── Живность ────────────────────────────────────────────────────────

test("живность: убийство не даёт розыска и стиля «убийца»", () => {
  const ctx = makeCtx();
  let killStyle = 0;
  ctx.noteStyle = (e) => {
    if (e === "kill") killStyle += 1;
  };

  killAnimal(ctx, { kind: "fox" }, [
    { id: "pelt", name: "Мех", value: 12, weight: 1, kind: "goods" },
  ]);

  assert.equal(ctx.state.run.wanted, 0, "животное подняло розыск");
  assert.equal(ctx.state.run.counters.kills, 0, "животное засчитано как убийство человека");
  assert.equal(killStyle, 0, "стиль «убийца» за животное");
});

test("живность: добыча попадает в инвентарь", () => {
  const ctx = makeCtx();
  killAnimal(ctx, { kind: "cow" }, [
    { id: "beef", name: "Говядина", value: 20, weight: 2, kind: "food", heal: 30 },
  ]);
  assert.equal(ctx.state.run.inventory.items.length, 1);
});

test("живность: полный инвентарь — предмет не теряется молча", () => {
  const ctx = makeCtx();
  ctx.state.run.inventory.capacity = 0;
  killAnimal(ctx, { kind: "cow" }, [
    { id: "beef", name: "Говядина", value: 20, weight: 2, kind: "food" },
  ]);
  assert.ok(ctx.state.ui.messages.some((m) => /не поместилась/.test(m)));
});

test("живность: охота двигает задание по своему виду", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.active = {
    type: "hunt", targetId: "fox", goal: 2, state: "active",
  };
  ctx.state.run.quest.beasts = {};

  killAnimal(ctx, { kind: "fox" }, []);
  assert.equal(ctx.state.run.quest.beasts.fox, 1);

  killAnimal(ctx, { kind: "cow" }, []);
  assert.equal(ctx.state.run.quest.beasts.fox, 1, "чужая добыча засчитана охоте на лис");
});

// ── Шум ─────────────────────────────────────────────────────────────

test("шум: стражник в радиусе бросается в погоню", () => {
  const ctx = makeCtx();
  const near = makeGuard(11, 10);
  ctx.world.actors = [near];

  alertNoise(ctx, 10, 10, 5);
  assert.equal(near.state, "chase");
  assert.equal(near.alerted, true);
});

test("шум: далёкий стражник не слышит", () => {
  const ctx = makeCtx();
  const far = makeGuard(30, 30);
  ctx.world.actors = [far];

  alertNoise(ctx, 10, 10, 5);
  assert.equal(far.state, "idle");
});

test("шум: возница убегает, а не нападает", () => {
  const ctx = makeCtx();
  const driver = makeGuard(11, 10, { kind: "driver" });
  ctx.world.actors = [driver];

  alertNoise(ctx, 10, 10, 5);
  assert.equal(driver.state, "flee");
});

test("шум: мёртвых не будим", () => {
  const ctx = makeCtx();
  const dead = makeGuard(11, 10, { alive: false });
  ctx.world.actors = [dead];

  alertNoise(ctx, 10, 10, 5);
  assert.equal(dead.state, "idle");
});

// ── Урон по игроку ──────────────────────────────────────────────────

test("урон: здоровье падает", () => {
  const ctx = makeCtx();
  ctx.player.health = 100;

  damagePlayer(ctx, 20, { x: 11, y: 10, kind: "guard" });
  assert.ok(ctx.player.health < 100, "урон не прошёл");
  assert.equal(ctx.player.hurtFlash, 1);
});

test("урон: бессмертие отсекает всё", () => {
  const ctx = makeCtx();
  ctx.game.godMode = true;
  ctx.player.health = 100;

  damagePlayer(ctx, 999, { x: 11, y: 10, kind: "guard" });
  assert.equal(ctx.player.health, 100, "урон прошёл в режиме бессмертия");
});

test("урон: мёртвого не бьют повторно", () => {
  const ctx = makeCtx();
  ctx.player.dead = true;
  ctx.player.health = 0;

  ctx.died = false;
  damagePlayer(ctx, 50, { x: 11, y: 10, kind: "guard" });
  assert.equal(ctx.died, false, "смерть сработала повторно");
});

test("урон: запас бодрости принимает удар первым", () => {
  const ctx = makeCtx();
  ctx.player.health = 100;
  ctx.player.overheal = 25;

  damagePlayer(ctx, 20, { x: 11, y: 10, kind: "guard" });
  assert.ok(ctx.player.overheal < 25, "запас не потрачен");
  assert.equal(ctx.player.health, 100, "здоровье пострадало при полном запасе");
});

test("урон: смерть вызывается при нуле здоровья", () => {
  const ctx = makeCtx();
  ctx.player.health = 5;
  ctx.player.overheal = 0;
  ctx.died = false;

  damagePlayer(ctx, 999, { x: 11, y: 10, kind: "guard" });
  assert.equal(ctx.player.health, 0);
  assert.equal(ctx.died, true, "die() не вызвана");
});

test("урон: броня снижает полученный урон", () => {
  const without = makeCtx();
  without.player.health = 100;
  damagePlayer(without, 30, { x: 11, y: 10, kind: "guard" });
  const takenWithout = 100 - without.player.health;

  const withArmor = makeCtx();
  withArmor.state.run.upgrades.armor = 3;
  withArmor.player.health = 100;
  damagePlayer(withArmor, 30, { x: 11, y: 10, kind: "guard" });
  const takenWith = 100 - withArmor.player.health;

  assert.ok(takenWith < takenWithout, `броня не помогла: ${takenWith} vs ${takenWithout}`);
});
