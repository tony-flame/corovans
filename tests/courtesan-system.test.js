import test from "node:test";
import assert from "node:assert/strict";

import {
  findCourtesan,
  courtesanInfo,
  courtesanRefusalInfo,
  visitCourtesan,
  payCourtesan,
  askCourtesan,
  leaveCourtesan,
  AFFINITY_FREE_VISITS,
} from "../src/systems/courtesan.js";
import { createState } from "../src/core/state.js";
import { createRun } from "../src/run.js";
import { createRng } from "../src/rng.js";
import { createProfile } from "../src/profile.js";
import { createCourtesan, createAffinity } from "../src/npc.js";

function fakeUi() {
  const messages = [];
  return {
    messages,
    courtesanOpen: false,
    panel: null,
    line: "",
    rumors: [],
    message(t) {
      messages.push(t);
    },
    openCourtesan(view) {
      this.panel = view;
      this.courtesanOpen = true;
    },
    closeCourtesan() {
      this.courtesanOpen = false;
    },
    setCourtesanLine(text) {
      this.line = text;
    },
    showCourtesanRumor(text) {
      this.rumors.push(text);
    },
    setPrompt() {},
    setProgress() {},
    $() {
      return { textContent: this.line };
    },
  };
}

function fakeAudio() {
  const calls = [];
  const rec = (n) => () => calls.push(n);
  return { calls, ui: rec("ui"), coin: rec("coin") };
}

function makeCtx() {
  const state = createState();
  state.run = createRun(777, createProfile(), { bonuses: null });
  state.run.gold = 200;
  state.run.courtesanAffinity = createAffinity();
  state.rng = createRng(1);
  state.profile = createProfile();
  state.ui = fakeUi();

  const variant = createCourtesan(777, 1, 0, "square");
  const courtesan = { id: 1, spot: "square", variant };

  const ctx = {
    state,
    game: { activeCourtesan: null, courtesanRumorUsed: false, uiOpen: false },
    world: {
      courtesan,
      courtesans: [courtesan],
    },
    player: {
      health: 40,
      maxHealth: 100,
      overheal: 0,
    },
    input: {
      cleared: 0,
      locked: 0,
      clear() { this.cleared += 1; },
      exitLock() {},
      requestLock() { this.locked += 1; },
    },
    audio: fakeAudio(),
    dialogContext: () => ({ seed: 1 }),
    showDialog() {},
    buildCourtesanTree: () => ({ root: { text: "", options: [] }, nodeId: "root", history: [] }),
    saveCheckpoint() {},
  };

  return ctx;
}

// ── Поиск ───────────────────────────────────────────────────────────

test("куртизанка: находится по месту", () => {
  const ctx = makeCtx();
  assert.equal(findCourtesan(ctx, "square"), ctx.world.courtesan);
});

test("куртизанка: неизвестное место даёт первую попавшуюся", () => {
  const ctx = makeCtx();
  const found = findCourtesan(ctx, "no_such_spot");
  assert.ok(found, "ничего не вернулось");
});

// ── Панель ──────────────────────────────────────────────────────────

test("куртизанка: визит открывает панель и блокирует управление", () => {
  const ctx = makeCtx();
  assert.equal(visitCourtesan(ctx, "square"), true);

  assert.equal(ctx.state.ui.courtesanOpen, true);
  assert.equal(ctx.game.uiOpen, true);
  assert.equal(ctx.game.activeCourtesan, "square");
  assert.equal(ctx.input.cleared, 1, "ввод не сброшен");
});

test("куртизанка: без денег панель всё равно открывается", () => {
  const ctx = makeCtx();
  ctx.state.run.gold = 0;

  visitCourtesan(ctx, "square");
  assert.equal(ctx.state.ui.courtesanOpen, true, "панель не открылась — игрок не увидит причину");
  assert.equal(ctx.state.ui.panel.canPay, false);
});

test("куртизанка: при полном здоровье отказ, но панель видна", () => {
  const ctx = makeCtx();
  ctx.player.health = 100;
  ctx.player.overheal = 25;

  visitCourtesan(ctx, "square");
  assert.equal(ctx.state.ui.panel.canPay, false);
});

test("куртизанка: неизвестная не открывает панель", () => {
  const ctx = makeCtx();
  ctx.world.courtesans = [];
  ctx.world.courtesan = null;

  assert.equal(visitCourtesan(ctx, "square"), false);
});

// ── Оплата ──────────────────────────────────────────────────────────

test("оплата: лечит, списывает цену, повышает привязанность", () => {
  const ctx = makeCtx();
  const price = ctx.world.courtesan.variant.price;
  visitCourtesan(ctx, "square");

  const goldBefore = ctx.state.run.gold;
  assert.equal(payCourtesan(ctx), true);

  assert.equal(ctx.state.run.gold, goldBefore - price, "списано неверно");
  assert.equal(ctx.player.health, 100, "не вылечила");
  assert.equal(ctx.player.overheal, 25, "не дала запас");
  assert.equal(ctx.state.run.courtesanAffinity.square, 1, "привязанность не выросла");
});

test("оплата: без денег отказывает и не лечит", () => {
  const ctx = makeCtx();
  ctx.state.run.gold = 0;
  visitCourtesan(ctx, "square");

  assert.equal(payCourtesan(ctx), false);
  assert.equal(ctx.player.health, 40, "вылечила бесплатно");
  assert.equal(ctx.state.run.courtesanAffinity.square, 0);
});

test("оплата: при полном здоровье не берёт денег", () => {
  const ctx = makeCtx();
  ctx.player.health = 100;
  ctx.player.overheal = 25;
  visitCourtesan(ctx, "square");

  const goldBefore = ctx.state.run.gold;
  assert.equal(payCourtesan(ctx), false);
  assert.equal(ctx.state.run.gold, goldBefore);
});

test("оплата: бесплатный визит не повышает привязанность", () => {
  const ctx = makeCtx();
  ctx.state.run.courtesanAffinity.square = AFFINITY_FREE_VISITS;
  ctx.player.health = 40;

  visitCourtesan(ctx, "square");
  const goldBefore = ctx.state.run.gold;

  payCourtesan(ctx);
  assert.equal(ctx.state.run.gold, goldBefore, "взяла деньги за бесплатный визит");
  assert.equal(
    ctx.state.run.courtesanAffinity.square,
    AFFINITY_FREE_VISITS,
    "бесплатный визит поднял привязанность"
  );
});

test("оплата: бесплатный визит лечит, но не даёт запаса", () => {
  const ctx = makeCtx();
  ctx.state.run.courtesanAffinity.square = AFFINITY_FREE_VISITS;
  ctx.player.health = 40;
  ctx.player.overheal = 0;

  visitCourtesan(ctx, "square");
  payCourtesan(ctx);

  assert.equal(ctx.player.health, 100, "бесплатно не вылечила");
  assert.equal(ctx.player.overheal, 0, "бесплатный визит дал запас");
});

// ── Слух ────────────────────────────────────────────────────────────

test("слух: выдаётся один раз за визит", () => {
  const ctx = makeCtx();
  visitCourtesan(ctx, "square");

  assert.equal(askCourtesan(ctx), true);
  assert.equal(askCourtesan(ctx), false, "слух выдан дважды");
  assert.equal(ctx.state.ui.rumors.length, 1);
});

test("слух: двигает счётчик визитов", () => {
  const ctx = makeCtx();
  visitCourtesan(ctx, "square");
  const before = ctx.state.run.visitIndex;

  askCourtesan(ctx);
  assert.equal(ctx.state.run.visitIndex, before + 1);
});

test("слух: без открытой панели ничего не делает", () => {
  const ctx = makeCtx();
  assert.equal(askCourtesan(ctx), false);
});

// ── Уход ────────────────────────────────────────────────────────────

test("уход: закрывает панель и возвращает управление", () => {
  const ctx = makeCtx();
  visitCourtesan(ctx, "square");
  leaveCourtesan(ctx);

  assert.equal(ctx.state.ui.courtesanOpen, false);
  assert.equal(ctx.game.uiOpen, false);
  assert.equal(ctx.game.activeCourtesan, null);
  assert.equal(ctx.game.courtesanRumorUsed, false);
  assert.equal(ctx.input.locked, 1, "мышь не вернули");
});

// ── Информация ──────────────────────────────────────────────────────

test("инфо: показывает здоровье и цену", () => {
  const ctx = makeCtx();
  const variant = ctx.world.courtesan.variant;

  const text = courtesanInfo(ctx, variant, "square", false);
  assert.match(text, /Здоровье 40\/100/);
  assert.match(text, new RegExp(`Цена: ${variant.price}`));
});

test("инфо: бесплатно — не показывает цену", () => {
  const ctx = makeCtx();
  const variant = ctx.world.courtesan.variant;

  const text = courtesanInfo(ctx, variant, "square", true);
  assert.match(text, /Бесплатно/);
  assert.doesNotMatch(text, /Цена:/);
});

test("инфо: отказ при полном здоровье объясним", () => {
  const ctx = makeCtx();
  const text = courtesanRefusalInfo(ctx, {}, "full_health");
  assert.match(text, /лечить нечего/);
});

test("инфо: отказ по деньгам называет нехватку", () => {
  const ctx = makeCtx();
  ctx.state.run.gold = 5;
  const text = courtesanRefusalInfo(ctx, { price: 30 }, "no_gold");
  assert.match(text, /25/);
});
