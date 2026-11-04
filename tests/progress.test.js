import test from "node:test";
import assert from "node:assert/strict";

import {
  refreshContracts,
  acceptContract,
  contractSnapshot,
  evaluateContract,
  finishContract,
  questSnapshot,
  refreshQuestState,
  noteVisitedPlaces,
  VISIT_PLACES,
} from "../src/systems/progress.js";
import { createState } from "../src/core/state.js";
import { createRun } from "../src/run.js";
import { createRng } from "../src/rng.js";
import { createInventory } from "../src/inventory.js";
import { createUpgrades } from "../src/economy.js";
import { createProfile } from "../src/profile.js";
import { CONTRACT_TYPES } from "../src/contracts.js";

function fakeUi(tradeOpen = true) {
  const messages = [];
  return {
    messages,
    tradeOpen,
    message(t) {
      messages.push(t);
    },
    renderTrade() {},
  };
}

function fakeAudio() {
  const calls = [];
  const rec = (n) => () => calls.push(n);
  return { calls, ui: rec("ui"), coin: rec("coin") };
}

function makeCtx(overrides = {}) {
  const state = createState();
  state.run = createRun(4321, createProfile(), { bonuses: null });
  state.run.inventory = createInventory(99);
  state.run.upgrades = createUpgrades();
  state.run.gold = 100;
  state.rng = createRng(1);
  state.profile = createProfile();
  state.ui = fakeUi();

  const ctx = {
    state,
    game: { clockTotal: 100, contractTimeLeft: null },
    world: {},
    player: { x: 0, y: 0 },
    audio: fakeAudio(),
    styleKey: () => "neutral",
    checkActProgress() {},
    noteStyle() {},
    saveCheckpoint() {},
    tradeState: () => ({}),
    ...overrides,
  };
  return ctx;
}

// ── Контракты ───────────────────────────────────────────────────────

test("контракты: предложения генерируются по сиду", () => {
  const ctx = makeCtx();
  refreshContracts(ctx);
  assert.equal(ctx.state.run.contractOffer.length, 3);
  assert.ok(ctx.state.run.offerSeed, "сид предложения не сохранён");
});

test("контракты: детерминированы для одного рана", () => {
  const a = makeCtx();
  refreshContracts(a);
  const b = makeCtx();
  refreshContracts(b);
  assert.deepEqual(
    a.state.run.contractOffer.map((c) => c.type),
    b.state.run.contractOffer.map((c) => c.type)
  );
});

test("контракты: активный контракт блокирует новую выдачу", () => {
  const ctx = makeCtx();
  refreshContracts(ctx);
  const before = ctx.state.run.contractOffer.length;

  ctx.state.run.activeContract = { id: "x", type: CONTRACT_TYPES.CLEAN };
  ctx.state.run.contractOffer = [];

  refreshContracts(ctx);
  assert.equal(ctx.state.run.contractOffer.length, 0, "выдали офферы при активном контракте");
  assert.equal(before, 3);
});

test("контракты: взять можно только при открытой панели", () => {
  const ctx = makeCtx();
  refreshContracts(ctx);
  ctx.state.ui.tradeOpen = false;

  assert.equal(acceptContract(ctx, 0), false);
  assert.equal(ctx.state.run.activeContract, null);
});

test("контракты: взятие сбрасывает счётчики попытки", () => {
  const ctx = makeCtx();
  refreshContracts(ctx);
  ctx.state.run.counters.killsSinceAccept = 9;
  ctx.state.run.counters.lootsSinceAccept = 5;
  ctx.state.run.counters.chaseSinceAccept = true;

  acceptContract(ctx, 0);
  assert.equal(ctx.state.run.counters.killsSinceAccept, 0);
  assert.equal(ctx.state.run.counters.lootsSinceAccept, 0);
  assert.equal(ctx.state.run.counters.chaseSinceAccept, false);
});

test("контракты: предложения чистятся после взятия", () => {
  const ctx = makeCtx();
  refreshContracts(ctx);
  acceptContract(ctx, 0);
  assert.equal(ctx.state.run.contractOffer.length, 0);
});

test("контракты: второй контракт поверх первого не берётся", () => {
  const ctx = makeCtx();
  refreshContracts(ctx);
  acceptContract(ctx, 0);
  const first = ctx.state.run.activeContract;

  // Предложения опустели, но даже если подсунуть — не возьмётся.
  ctx.state.run.contractOffer = [{ id: "fake", type: CONTRACT_TYPES.CLEAN }];
  assert.equal(acceptContract(ctx, 0), false);
  assert.equal(ctx.state.run.activeContract, first);
});

// ── Проверка и награда ──────────────────────────────────────────────

test("контракты: снапшот содержит монотонное время", () => {
  const ctx = makeCtx();
  refreshContracts(ctx);
  acceptContract(ctx, 0);
  const snap = contractSnapshot(ctx);

  assert.equal(snap.clockTotal, 100);
  assert.equal(snap.acceptedClock, 100);
});

test("контракты: 'без крови' выполняется обыском без убийств", () => {
  const ctx = makeCtx();
  ctx.state.run.activeContract = {
    id: "c1", type: CONTRACT_TYPES.CLEAN, state: "active",
    reward: { gold: 90, rep: 2 }, deadline: null, acceptedAt: 0,
  };
  ctx.state.run.counters.lootsSinceAccept = 1;
  ctx.state.run.counters.killsSinceAccept = 0;

  const goldBefore = ctx.state.run.gold;
  evaluateContract(ctx);

  assert.equal(ctx.state.run.activeContract, null, "контракт не закрылся");
  assert.ok(ctx.state.run.gold > goldBefore, "награда не выдана");
  assert.equal(ctx.state.run.counters.contractsDone, 1);
});

test("контракты: 'без крови' проваливается от убийства", () => {
  const ctx = makeCtx();
  ctx.state.run.activeContract = {
    id: "c2", type: CONTRACT_TYPES.CLEAN, state: "active",
    reward: { gold: 90, rep: 2 }, deadline: null, acceptedAt: 0,
  };
  ctx.state.run.counters.lootsSinceAccept = 1;
  ctx.state.run.counters.killsSinceAccept = 1;

  const goldBefore = ctx.state.run.gold;
  evaluateContract(ctx);

  assert.equal(ctx.state.run.activeContract, null);
  assert.equal(ctx.state.run.gold, goldBefore, "за провал выдали награду");
  assert.equal(ctx.state.run.counters.contractsFailed, 1);
});

test("контракты: серия растёт при успехе и сбрасывается при провале", () => {
  const ctx = makeCtx();
  ctx.state.run.contractStreak = 2;
  ctx.state.run.activeContract = {
    id: "c3", type: CONTRACT_TYPES.CLEAN, state: "active",
    reward: { gold: 90, rep: 2 }, deadline: null, acceptedAt: 0,
  };
  ctx.state.run.counters.lootsSinceAccept = 1;

  evaluateContract(ctx);
  assert.equal(ctx.state.run.contractStreak, 3, "серия не выросла");

  ctx.state.run.activeContract = {
    id: "c4", type: CONTRACT_TYPES.UNSEEN, state: "active",
    reward: { gold: 140, rep: 4 }, deadline: null, acceptedAt: 0,
  };
  ctx.state.run.counters.lootsSinceAccept = 1;
  ctx.state.run.counters.chaseSinceAccept = true;

  evaluateContract(ctx);
  assert.equal(ctx.state.run.contractStreak, 0, "серия не сброшена");
});

test("контракты: дедлайн тикает в HUD по монотонному времени", () => {
  const ctx = makeCtx();
  ctx.state.run.activeContract = {
    id: "c5", type: CONTRACT_TYPES.BEFORE_DAWN, state: "active",
    reward: { gold: 120, rep: 3 }, deadline: 90, acceptedAt: 0,
  };
  ctx.state.run.counters.acceptedClock = 100;
  ctx.game.clockTotal = 130;

  evaluateContract(ctx);
  assert.equal(ctx.game.contractTimeLeft, 60, "остаток посчитан неверно");
});

test("контракты: успех выдаёт репутацию и чистит таймер", () => {
  const ctx = makeCtx();
  ctx.state.run.activeContract = {
    id: "c6", type: CONTRACT_TYPES.CLEAN, state: "active",
    reward: { gold: 90, rep: 5 }, deadline: null, acceptedAt: 0,
  };
  ctx.state.run.counters.lootsSinceAccept = 1;
  const repBefore = ctx.state.profile.reputation;

  finishContract(ctx, true);
  assert.equal(ctx.state.profile.reputation, repBefore + 5);
  assert.equal(ctx.game.contractTimeLeft, null);
  assert.ok(ctx.state.profile.completedContracts.includes("c6"));
});

test("контракты: один контракт не засчитывается дважды в статистике", () => {
  const ctx = makeCtx();
  ctx.state.run.activeContract = {
    id: "dup", type: CONTRACT_TYPES.CLEAN, state: "active",
    reward: { gold: 10, rep: 1 }, deadline: null, acceptedAt: 0,
  };
  ctx.state.run.counters.lootsSinceAccept = 1;
  finishContract(ctx, true);

  // Повторный вызов на уже закрытом контракте ничего не делает.
  finishContract(ctx, true);
  const count = ctx.state.profile.completedContracts.filter((x) => x === "dup").length;
  assert.equal(count, 1);
});

// ── Задания ─────────────────────────────────────────────────────────

test("задание: снапшот собирает счётчики из рана", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.beasts = { fox: 2 };
  ctx.state.run.quest.visited = { market: true };
  ctx.state.run.quest.askedPeople = [1, 2];

  const snap = questSnapshot(ctx);
  assert.deepEqual(snap.beastsSince, { fox: 2 });
  assert.deepEqual(snap.visited, { market: true });
  assert.deepEqual(snap.askedPeople, [1, 2]);
});

test("задание: охота закрывается при достижении цели", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.active = {
    type: "hunt", targetId: "fox", goal: 2, state: "active",
    giverLabel: "Крестьянин",
  };
  ctx.state.run.quest.beasts = { fox: 2 };

  assert.equal(refreshQuestState(ctx), true);
  assert.equal(ctx.state.run.quest.active.state, "complete");
});

test("задание: незакрытое остаётся активным", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.active = {
    type: "hunt", targetId: "fox", goal: 3, state: "active",
    giverLabel: "Крестьянин",
  };
  ctx.state.run.quest.beasts = { fox: 2 };

  assert.equal(refreshQuestState(ctx), false);
  assert.equal(ctx.state.run.quest.active.state, "active");
});

test("задание: закрытое не пересчитывается повторно", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.active = {
    type: "hunt", targetId: "fox", goal: 1, state: "complete",
    giverLabel: "Крестьянин",
  };
  assert.equal(refreshQuestState(ctx), false);
});

test("задание: посещение места засчитывается в своей зоне", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.active = {
    type: "reach", targetId: "cathedral", goal: 1, state: "active",
    giverLabel: "Крестьянин",
  };
  // Координаты внутри собора.
  ctx.player = { x: 165, y: 118 };

  assert.equal(noteVisitedPlaces(ctx), true);
  assert.equal(ctx.state.run.quest.visited.cathedral, true);
  assert.equal(ctx.state.run.quest.active.state, "complete");
});

test("задание: мимо нужной зоны не засчитывается", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.active = {
    type: "reach", targetId: "cathedral", goal: 1, state: "active",
    giverLabel: "Крестьянин",
  };
  ctx.player = { x: 52, y: 132 }; // деревня

  assert.equal(noteVisitedPlaces(ctx), false);
  assert.equal(ctx.state.run.quest.visited.cathedral, undefined);
});

test("задание: повторное посещение не дублирует сообщение", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.active = {
    type: "reach", targetId: "market", goal: 1, state: "active",
    giverLabel: "Крестьянин",
  };
  const zone = VISIT_PLACES.market;
  assert.equal(zone, "MARKET");

  ctx.player = { x: 116, y: 140 };
  noteVisitedPlaces(ctx);

  const messagesBefore = ctx.state.ui.messages.length;
  noteVisitedPlaces(ctx);
  assert.equal(ctx.state.ui.messages.length, messagesBefore, "сообщение продублировалось");
});

test("задание: не-«дойти» не реагирует на зоны", () => {
  const ctx = makeCtx();
  ctx.state.run.quest.active = {
    type: "hunt", targetId: "cathedral", goal: 1, state: "active",
    giverLabel: "Крестьянин",
  };
  ctx.player = { x: 165, y: 118 };

  assert.equal(noteVisitedPlaces(ctx), false, "охота закрылась от посещения");
});
