import test from "node:test";
import assert from "node:assert/strict";

import {
  buyerPrice,
  sellValue,
  sellLoot,
  haggleSell,
  buyUpgrade,
  buyUnlock,
  payFine,
  startLoot,
  takeLoot,
  finishLoot,
} from "../src/systems/trade.js";
import { createState } from "../src/core/state.js";
import { createRun } from "../src/run.js";
import { createRng } from "../src/rng.js";
import { createInventory } from "../src/inventory.js";
import { createUpgrades } from "../src/economy.js";
import { createProfile, UNLOCK_ORDER } from "../src/profile.js";

// ── Заглушки вместо DOM и мира ──────────────────────────────────────
// Модуль не должен требовать ни canvas, ни window: если он потянет
// main.js, этот тест упадёт на импорте.

function fakeUi() {
  const messages = [];
  return {
    messages,
    tradeOpen: true,
    lootOpen: true,
    message(text) {
      messages.push(text);
    },
    renderTrade() {},
    renderLoot() {},
    openLoot() {},
    closeLoot() {},
    setPrompt() {},
    setProgress() {},
  };
}

function fakeAudio() {
  return {
    coins: 0,
    coin() {
      this.coins += 1;
    },
  };
}

function makeCtx(overrides = {}) {
  const state = createState();
  state.run = createRun(1234, createProfile(), { bonuses: null });
  state.run.inventory = createInventory(99);
  state.run.upgrades = createUpgrades();
  state.run.gold = 100;
  state.rng = createRng(1);
  state.ui = fakeUi();

  const ctx = {
    state,
    game: {
      haggleRolled: 0,
      lootBuffer: null,
      lootSecondWagon: false,
      lootWitnessed: false,
      uiOpen: false,
      stealing: false,
      stealProgress: 0,
    },
    world: {
      wagonLooted: false,
      secondWagon: null,
      campGuards: [],
      villageGuard: { state: "idle", suspicion: 0, alerted: false },
    },
    player: { x: 0, y: 0 },
    input: {
      cleared: 0,
      locked: 0,
      clear() {
        this.cleared += 1;
      },
      exitLock() {},
      requestLock() {
        this.locked += 1;
      },
    },
    audio: fakeAudio(),
    priceModifier: () => 1,
    tradeState: () => ({ gold: state.run.gold }),
    noteStyle() {},
    saveCheckpoint() {},
    checkActProgress() {},
    evaluateContract() {},
    writeSave() {},
    ...overrides,
  };

  return ctx;
}

function withItems(ctx, items) {
  ctx.state.run.inventory.items = items.map((i) => ({ ...i }));
}

// ── Цена ────────────────────────────────────────────────────────────

test("торговля: цена считается от стоимости добычи", () => {
  const ctx = makeCtx();
  withItems(ctx, [{ id: "a", name: "Тюк", value: 50, weight: 1, kind: "goods" }]);
  assert.equal(sellValue(ctx), buyerPrice(ctx, 50));
  assert.ok(sellValue(ctx) > 0);
});

test("торговля: пустая добыча не даёт денег", () => {
  const ctx = makeCtx();
  withItems(ctx, []);
  assert.equal(sellValue(ctx), 0);
});

// ── Продажа ─────────────────────────────────────────────────────────

test("продажа: золото растёт, инвентарь пустеет", () => {
  const ctx = makeCtx();
  withItems(ctx, [{ id: "a", name: "Тюк", value: 50, weight: 1, kind: "goods" }]);
  const before = ctx.state.run.gold;

  assert.equal(sellLoot(ctx), true);
  assert.ok(ctx.state.run.gold > before, "золото не выросло");
  assert.equal(ctx.state.run.inventory.items.length, 0);
  assert.ok(ctx.state.run.totalSold > 0, "оборот не учтён");
});

test("продажа: без открытой панели ничего не происходит", () => {
  const ctx = makeCtx();
  ctx.state.ui.tradeOpen = false;
  withItems(ctx, [{ id: "a", name: "Тюк", value: 50, weight: 1, kind: "goods" }]);
  const before = ctx.state.run.gold;

  assert.equal(sellLoot(ctx), false);
  assert.equal(ctx.state.run.gold, before, "золото изменилось при закрытой панели");
  assert.equal(ctx.state.run.inventory.items.length, 1, "добыча пропала");
});

test("продажа: пустой инвентарь — не ошибка, но и не продажа", () => {
  const ctx = makeCtx();
  withItems(ctx, []);
  const before = ctx.state.run.gold;
  assert.equal(sellLoot(ctx), false);
  assert.equal(ctx.state.run.gold, before);
});

test("продажа: обобранный фургон запускает новый караван", () => {
  const ctx = makeCtx();
  ctx.world.wagonLooted = true;
  ctx.state.run.lootSoldForTier = false;
  withItems(ctx, [{ id: "a", name: "Тюк", value: 50, weight: 1, kind: "goods" }]);

  sellLoot(ctx);
  assert.equal(ctx.state.run.pendingCaravan, true);
  assert.ok(ctx.state.run.caravanTimer > 0);
});

// ── Торг ────────────────────────────────────────────────────────────

test("торг: тратит попытку и продаёт добычу", () => {
  const ctx = makeCtx();
  withItems(ctx, [{ id: "a", name: "Тюк", value: 200, weight: 1, kind: "goods" }]);
  const before = ctx.state.run.gold;

  assert.equal(haggleSell(ctx), true);
  assert.equal(ctx.game.haggleRolled, 1, "попытка не засчитана");
  assert.ok(ctx.state.run.gold > before);
  assert.equal(ctx.state.run.inventory.items.length, 0);
});

test("торг: попытки кончаются", () => {
  const ctx = makeCtx();
  ctx.game.haggleRolled = 3; // MAX_ROLLS
  withItems(ctx, [{ id: "a", name: "Тюк", value: 100, weight: 1, kind: "goods" }]);

  assert.equal(haggleSell(ctx), false);
  assert.equal(ctx.state.run.inventory.items.length, 1, "добыча продалась без попыток");
});

test("торг: нечего продавать — отказ без траты попытки", () => {
  const ctx = makeCtx();
  withItems(ctx, []);
  assert.equal(haggleSell(ctx), false);
  assert.equal(ctx.game.haggleRolled, 0, "попытка сгорела впустую");
});

// ── Покупки ─────────────────────────────────────────────────────────

test("улучшение: покупается и списывает ровно цену", () => {
  const ctx = makeCtx();
  ctx.state.run.gold = 500;
  const price = ctx.state.run.upgrades.sword;

  assert.equal(buyUpgrade(ctx, "sword"), true);
  assert.equal(ctx.state.run.upgrades.sword, 1);
  assert.ok(ctx.state.run.gold < 500);
  assert.equal(price, 0, "начальный уровень должен быть нулевым");
});

test("улучшение: без денег не покупается", () => {
  const ctx = makeCtx();
  ctx.state.run.gold = 0;
  assert.equal(buyUpgrade(ctx, "sword"), false);
  assert.equal(ctx.state.run.upgrades.sword, 0);
});

test("улучшение: неизвестное имя игнорируется", () => {
  const ctx = makeCtx();
  ctx.state.run.gold = 1000;
  assert.equal(buyUpgrade(ctx, "no_such_upgrade"), false);
});

test("разблокировка: списывает репутацию и не повторяется", () => {
  const ctx = makeCtx();
  ctx.state.profile = createProfile();

  // Берём первую доступную разблокировку из профиля.
  const id = UNLOCK_ORDER[0];
  ctx.state.profile.reputation = 999;

  const first = buyUnlock(ctx, id);
  assert.equal(first, true, `не удалось купить ${id}`);
  const repAfter = ctx.state.profile.reputation;

  const second = buyUnlock(ctx, id);
  assert.equal(second, false, "одну разблокировку купили дважды");
  assert.equal(ctx.state.profile.reputation, repAfter, "репутация списалась повторно");
});

// ── Штраф ───────────────────────────────────────────────────────────

test("штраф: снимает розыск и успокаивает стражу", () => {
  const ctx = makeCtx();
  ctx.state.run.gold = 1000;
  ctx.state.run.wanted = 3;
  ctx.world.villageGuard = { state: "chase", suspicion: 1, alerted: true };

  assert.equal(payFine(ctx), true);
  assert.equal(ctx.state.run.wanted, 0);
  assert.equal(ctx.world.villageGuard.state, "idle");
  assert.equal(ctx.world.villageGuard.alerted, false);
});

test("штраф: без розыска не берёт денег", () => {
  const ctx = makeCtx();
  ctx.state.run.wanted = 0;
  const before = ctx.state.run.gold;
  assert.equal(payFine(ctx), false);
  assert.equal(ctx.state.run.gold, before);
});

test("штраф: без денег отказывает и не снимает розыск", () => {
  const ctx = makeCtx();
  ctx.state.run.gold = 0;
  ctx.state.run.wanted = 2;

  assert.equal(payFine(ctx), false);
  assert.equal(ctx.state.run.wanted, 2, "розыск сняли бесплатно");
});

// ── Обыск ───────────────────────────────────────────────────────────

test("обыск: открывает панель и готовит добычу", () => {
  const ctx = makeCtx();
  assert.equal(startLoot(ctx), true);
  assert.ok(Array.isArray(ctx.game.lootBuffer));
  assert.ok(ctx.game.lootBuffer.length > 0, "добыча не сгенерировалась");
  assert.equal(ctx.game.uiOpen, true);
  assert.equal(ctx.input.cleared, 1, "ввод не сброшен");
});

test("обыск: свидетели поднимают флаг", () => {
  const ctx = makeCtx();
  ctx.world.campGuards = [{ alive: true, state: "chase", suspicion: 1 }];
  startLoot(ctx);
  assert.equal(ctx.game.lootWitnessed, true);
});

test("обыск: всех спящих не считаем свидетелями", () => {
  const ctx = makeCtx();
  ctx.world.campGuards = [{ alive: true, state: "idle", suspicion: 0 }];
  startLoot(ctx);
  assert.equal(ctx.game.lootWitnessed, false);
});

test("обыск: предмет берётся и исчезает из буфера", () => {
  const ctx = makeCtx();
  ctx.state.run.inventory.capacity = 99;
  startLoot(ctx);
  const before = ctx.game.lootBuffer.length;

  assert.equal(takeLoot(ctx, 0), true);
  assert.equal(ctx.game.lootBuffer.length, before - 1);
  assert.equal(ctx.state.run.inventory.items.length, 1);
});

test("обыск: тяжёлый предмет не влезает и остаётся в буфере", () => {
  const ctx = makeCtx();
  ctx.state.run.inventory.capacity = 0;
  startLoot(ctx);
  const before = ctx.game.lootBuffer.length;

  assert.equal(takeLoot(ctx, 0), false);
  assert.equal(ctx.game.lootBuffer.length, before, "предмет пропал из фургона");
  assert.ok(ctx.state.ui.messages.some((m) => /Не помещается/.test(m)));
});

test("обыск: забрать всё закрывает панель и отмечает фургон", () => {
  const ctx = makeCtx();
  ctx.state.run.inventory.capacity = 999;

  // Заглушка UI запоминает, что панель закрывали.
  let closed = 0;
  ctx.state.ui.closeLoot = () => {
    closed += 1;
    ctx.state.ui.lootOpen = false;
  };

  startLoot(ctx);
  let guard = 0;
  while (ctx.game.lootBuffer && ctx.game.lootBuffer.length > 0 && guard < 50) {
    takeLoot(ctx, 0);
    guard++;
  }

  assert.equal(closed, 1, "панель не закрылась после последнего предмета");
  assert.equal(ctx.state.run.wagonLooted, true, "фургон не отмечен обобранным");
});

test("обыск: finishLoot отмечает фургон обобранным и даёт монету", () => {
  const ctx = makeCtx();
  ctx.state.run.tier = 2;
  startLoot(ctx);
  const goldBefore = ctx.state.run.gold;

  assert.equal(finishLoot(ctx), true);
  assert.equal(ctx.state.run.wagonLooted, true);
  assert.equal(ctx.world.wagonLooted, true);
  assert.ok(ctx.state.run.gold > goldBefore);
  assert.equal(ctx.input.locked, 1, "мышь не вернули");
});

test("обыск: тихий обыск даёт бонус и не поднимает розыск", () => {
  const ctx = makeCtx();
  ctx.world.campGuards = [];
  startLoot(ctx);
  assert.equal(ctx.game.lootWitnessed, false);

  const wantedBefore = ctx.state.run.wanted;
  finishLoot(ctx);
  assert.equal(ctx.state.run.wanted, wantedBefore, "розыск вырос без свидетелей");
  assert.ok(ctx.state.run.counters.silentLoots > 0);
});

test("обыск: замеченный обыск поднимает розыск", () => {
  const ctx = makeCtx();
  ctx.world.campGuards = [{ alive: true, state: "chase", suspicion: 1 }];
  startLoot(ctx);
  const wantedBefore = ctx.state.run.wanted;

  finishLoot(ctx);
  assert.ok(ctx.state.run.wanted > wantedBefore, "розыск не вырос при свидетелях");
});

test("обыск: второй фургон отмечается отдельно", () => {
  const ctx = makeCtx();
  ctx.world.secondWagon = { looted: false };
  ctx.state.run.secondWagonLooted = false;
  startLoot(ctx, true);
  finishLoot(ctx);

  assert.equal(ctx.world.secondWagon.looted, true);
  assert.equal(ctx.state.run.secondWagonLooted, true);
  assert.equal(ctx.state.run.wagonLooted, false, "основной фургон отметили по ошибке");
});
