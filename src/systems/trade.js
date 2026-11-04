// Торговля с Мардо и обыск фургона.
//
// Модуль не импортирует main.js и не держит состояния: всё, что ему нужно,
// приходит в объекте ctx. Так его можно проверить тестом без DOM,
// а main.js остаётся только проводкой.
//
// ctx (собирается в main.js):
//   state    — контейнер состояния (run, profile, ui, rng)
//   game     — рантайм-флаги
//   world    — мир
//   player   — игрок
//   input    — ввод
//   audio    — звук
//   totalValue, addItem, rollLoot            — из inventory.js
//   tuningFor, sellMultiplier, fineFor, purchase, unlock
//   rollsLeft, rollHaggle, canHaggle, haggledPrice, rollText, makeHaggleRng
//   priceModifier(), tradeState(), noteStyle(), saveCheckpoint(),
//   checkActProgress(), evaluateContract(), snapshotRun(), writeSave()

import { totalValue, addItem, rollLoot } from "../inventory.js";
import { fineFor, purchase, sellMultiplier } from "../economy.js";
import { unlock } from "../profile.js";
import {
  rollsLeft,
  rollHaggle,
  canHaggle,
  haggledPrice,
  rollText,
  makeHaggleRng,
} from "../haggle.js";
import { tuningFor } from "../style.js";
import { CHECKPOINT_REASONS, snapshotRun } from "../run.js";

// Базовая цена продажи: та же, что показана на кнопке.
export function buyerPrice(ctx, value) {
  return Math.round(value * sellMultiplier(ctx.state.run.upgrades, ctx.priceModifier()));
}

// Сколько даст продажа всей добычи за наличные, без торга.
export function sellValue(ctx) {
  return Math.round(totalValue(ctx.state.run.inventory) * sellMultiplier(ctx.state.run.upgrades, ctx.priceModifier()));
}

export function sellLoot(ctx) {
  const { state, world, audio } = ctx;
  if (!state.ui.tradeOpen || !state.run) return false;

  const value = totalValue(state.run.inventory);
  if (value <= 0) return false;

  const earned = Math.round(value * sellMultiplier(state.run.upgrades, ctx.priceModifier()));
  state.run.gold += earned;
  state.run.totalSold += earned;
  state.run.counters.totalGoldEarned += earned;
  state.run.inventory.items = [];
  audio.coin();
  state.ui.message(`Мардо отсчитал ${earned} зм.`);
  if (earned >= 120) ctx.noteStyle("sell_high");

  if (world.wagonLooted && !state.run.lootSoldForTier) {
    state.run.lootSoldForTier = true;
    state.run.pendingCaravan = true;
    state.run.caravanTimer = 12;
    state.ui.message("Слух: на северной дороге скоро появится новый караван.");
  }

  state.ui.renderTrade(ctx.tradeState());
  ctx.checkActProgress();
  ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  return true;
}

// Торг: бросок кубика против Мардо. Выиграл — наценка, проиграл —
// скидка. Продажа совершается сразу: иначе игрок мог бы бросить,
// увидеть проигрыш и закрыть панель без последствий.
export function haggleSell(ctx) {
  const { state, game, world, audio } = ctx;
  if (!state.ui.tradeOpen || !state.run) return false;

  const value = totalValue(state.run.inventory);
  if (!canHaggle(value, game.haggleRolled || 0)) {
    if (value <= 0) state.ui.message("Продавать нечего.");
    else state.ui.message("Мардо отворачивается: «Хватит. Цена окончательная.»");
    return false;
  }

  const result = rollHaggle(
    makeHaggleRng(state.run.seed, game.haggleRolled || 0, state.run.visitIndex || 0)
  );
  game.haggleRolled = (game.haggleRolled || 0) + 1;

  const earned = haggledPrice(buyerPrice(ctx, value), result);
  state.run.gold += earned;
  state.run.totalSold += earned;
  state.run.counters.totalGoldEarned += earned;
  state.run.inventory.items = [];

  audio.coin();
  state.ui.message(`Мардо: ${rollText(result)}`);
  state.ui.message(`Отсчитал ${earned} зм.`);
  if (result.won) ctx.noteStyle("sell_high");

  if (world.wagonLooted && !state.run.lootSoldForTier) {
    state.run.lootSoldForTier = true;
    state.run.pendingCaravan = true;
    state.run.caravanTimer = 12;
    state.ui.message("Слух: на северной дороге скоро появится новый караван.");
  }

  state.ui.renderTrade(ctx.tradeState());
  ctx.checkActProgress();
  ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  return true;
}

export function buyUpgrade(ctx, id) {
  const { state, audio } = ctx;
  if (!state.ui.tradeOpen || !state.run) return false;
  if (!(id in state.run.upgrades)) return false;

  const result = purchase(state.run.gold, state.run.upgrades, id);
  if (!result) return false;

  state.run.gold = result.gold;
  state.run.upgrades = result.upgrades;
  audio.coin();
  state.ui.message("Куплено улучшение.");
  state.ui.renderTrade(ctx.tradeState());
  return true;
}

export function buyUnlock(ctx, id) {
  const { state, audio } = ctx;
  if (!state.ui.tradeOpen) return false;

  const next = unlock(state.profile, id);
  if (!next) return false;

  state.profile = next;
  audio.coin();
  state.ui.message(`Открыто навсегда: ${id}.`);
  state.ui.renderTrade(ctx.tradeState());
  ctx.writeSave(state.profile, state.run ? snapshotRun(state.run, ctx.player) : null);
  return true;
}

export function payFine(ctx) {
  const { state, world, audio } = ctx;
  if (!state.ui.tradeOpen || !state.run) return false;

  const cost = fineFor(state.run.wanted);
  if (cost <= 0) return false;
  if (state.run.gold < cost) {
    state.ui.message("Не хватает золота на штраф.");
    return false;
  }

  state.run.gold -= cost;
  state.run.wanted = 0;
  const guard = world.villageGuard;
  guard.state = "idle";
  guard.suspicion = 0;
  guard.alerted = false;
  audio.coin();
  state.ui.message("Штраф уплачен. Стража больше не ищет вас.");
  state.ui.renderTrade(ctx.tradeState());
  ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  return true;
}

// ── Обыск фургона ───────────────────────────────────────────────────

export function startLoot(ctx, second = false) {
  const { state, game, world, input } = ctx;
  const tier = state.run.tier;

  // Раньше было `2 + tier`, и одновременно rollLoot умножал цену на
  // 1 + (tier-1)*0.25. Два множителя по тиру сразу: на tier 3 доход
  // удваивался скачком, и вся игра проходилась за пять караванов.
  // Теперь количество растёт в полтора раза медленнее.
  const count = 2 + Math.floor(tier / 2) + tuningFor(state.run.style).lootCount;
  game.lootBuffer = rollLoot(tier, state.rng, count);
  game.lootSecondWagon = second;

  const witnessed = world.campGuards.some(
    (a) => a.alive && (a.state === "chase" || a.suspicion > 0.4)
  );
  game.lootWitnessed = witnessed;
  game.stealing = false;
  game.stealProgress = 0;

  game.uiOpen = true;
  input.clear();
  input.exitLock();
  state.ui.openLoot(game.lootBuffer);
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  return true;
}

export function takeLoot(ctx, index) {
  const { state, game, audio } = ctx;
  if (!state.ui.lootOpen || !game.lootBuffer) return false;

  const item = game.lootBuffer[index];
  if (!item) return false;

  if (!addItem(state.run.inventory, item)) {
    state.ui.message("Не помещается — несите, что есть.");
    return false;
  }

  game.lootBuffer.splice(index, 1);
  state.ui.renderLoot(game.lootBuffer);
  if (game.lootBuffer.length === 0) finishLoot(ctx);
  return true;
}

export function finishLoot(ctx) {
  const { state, game, world, audio } = ctx;
  if (!state.run) return false;

  const taken = state.run.inventory.items.length;
  const wasSecond = game.lootSecondWagon;

  if (wasSecond) {
    if (world.secondWagon) world.secondWagon.looted = true;
    state.run.secondWagonLooted = true;
  } else {
    world.wagonLooted = true;
    state.run.wagonLooted = true;
  }

  const coin = 18 + state.run.tier * 8;
  state.run.gold += coin;

  if (game.lootWitnessed) {
    state.run.wanted = Math.min(5, Math.max(state.run.wanted, 1));
    ctx.noteStyle("witnessed");
    state.ui.message("Стража видела ограбление! Розыск +1.");
  } else {
    ctx.noteStyle("silent_loot");
    state.run.counters.silentLoots += 1;
    const bonus = Math.round(coin * (tuningFor(state.run.style).silentBonus - 1));
    if (bonus > 0) {
      state.run.gold += bonus;
      state.ui.message(`Тихо и чисто: +${bonus} зм. за бесшумность.`);
    }
  }

  state.run.counters.lootsSinceAccept += 1;
  game.lootBuffer = null;
  game.lootSecondWagon = false;
  game.lootWitnessed = false;
  game.uiOpen = false;
  state.ui.closeLoot();
  audio.coin();
  state.ui.message(`Из фургона вынесено ${taken} тюков и ${coin} зм.`);

  ctx.evaluateContract();
  ctx.checkActProgress();
  ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  ctx.input.requestLock();
  return true;
}

export { rollsLeft };
