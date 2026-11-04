// Куртизанки: визит, оплата, слух и уход.
//
// Внешность и характер детерминированы в npc.js и в сейв не попадают.
// Здесь только взаимодействие с игроком.
//
// ctx:
//   state, game, world, player, input, audio
//   dialogContext, showDialog, saveCheckpoint

import {
  courtesanCanServe,
  applyHeal,
  describeCourtesan,
  greetCourtesan,
  afterCourtesanLine,
  refusalLine,
  courtesanRumor,
  affinityOf,
  isFreeVisit,
  bumpAffinity,
} from "../npc.js";
import { CHECKPOINT_REASONS } from "../run.js";

// Сколько платных визитов до «с тебя больше не беру».
const AFFINITY_FREE_VISITS = 2;

export function findCourtesan(ctx, spot) {
  const { world } = ctx;
  if (spot) {
    const found = (world.courtesans || []).find((c) => (c.spot || "square") === spot);
    if (found) return found;
  }
  return world.courtesan;
}

export function courtesanInfo(ctx, variant, spot, free) {
  const { state, player } = ctx;
  const health = `Здоровье ${Math.ceil(player.health)}/${player.maxHealth}` +
    (player.overheal > 0.05 ? ` · запас +${Math.ceil(player.overheal)}` : "");

  if (free) return `Бесплатно: она вас помнит. ${health}`;

  const visits = affinityOf(state.run.courtesanAffinity, spot);
  const left = Math.max(0, AFFINITY_FREE_VISITS - visits);
  return `Цена: ${variant.price} зм. ${health}` +
    (left > 0 && left < AFFINITY_FREE_VISITS
      ? ` · ещё ${left} платных визит(а) до «с тебя не беру»`
      : "");
}

export function courtesanRefusalInfo(ctx, variant, reason) {
  const { state } = ctx;
  if (reason === "full_health") return "Она смотрит с сомнением: лечить нечего.";
  return `Не хватает ${Math.max(0, variant.price - state.run.gold)} зм.`;
}

export function visitCourtesan(ctx, spot) {
  const { state, game, player, input, audio } = ctx;
  const courtesan = findCourtesan(ctx, spot);
  if (!courtesan || !courtesan.variant) return false;

  const key = courtesan.spot || "square";
  const variant = courtesan.variant;
  const free = isFreeVisit(state.run.courtesanAffinity, key);
  const can = courtesanCanServe(
    variant, state.run.gold, player.health, player.maxHealth, player.overheal, free
  );

  game.activeCourtesan = key;
  // При отказе всё равно показываем панель: так игрок видит, почему нельзя.
  game.courtesanRumorUsed = false;

  game.uiOpen = true;
  input.clear();
  input.exitLock();
  state.ui.setPrompt(null);
  state.ui.setProgress(null);
  state.ui.openCourtesan({
    displayName: variant.displayName,
    temperLabel: variant.temperLabel,
    description: describeCourtesan(variant).replace(
      `${variant.displayName} (${variant.temperLabel}): `, ""
    ),
    line: can.ok
      ? greetCourtesan(variant, state.rng, {
          wanted: state.run.wanted,
          bled: state.run.bleed?.remaining || 0,
          free,
        })
      : refusalLine(variant, can.reason, state.rng),
    info: can.ok
      ? courtesanInfo(ctx, variant, key, free)
      : courtesanRefusalInfo(ctx, variant, can.reason),
    price: variant.price,
    canPay: can.ok,
    free,
    affinity: affinityOf(state.run.courtesanAffinity, key),
    rumorUsed: false,
  });
  audio.ui();
  return true;
}

export function payCourtesan(ctx) {
  const { state, game, player, audio } = ctx;
  const key = game.activeCourtesan || "square";
  const courtesan = findCourtesan(ctx, key);
  if (!courtesan || !courtesan.variant) return false;

  const variant = courtesan.variant;
  const free = isFreeVisit(state.run.courtesanAffinity, key);
  const can = courtesanCanServe(
    variant, state.run.gold, player.health, player.maxHealth, player.overheal, free
  );
  if (!can.ok) {
    state.ui.setCourtesanLine(refusalLine(variant, can.reason, state.rng));
    return false;
  }

  const result = applyHeal(
    variant, state.run.gold, player.health, player.maxHealth, player.overheal, free
  );
  state.run.gold = result.gold;
  player.health = result.health;
  player.overheal = result.overheal;

  // Платный визит повышает привязанность. Бесплатный — нет,
  // иначе первый же бесплатный визит сделал бы её вечной.
  if (!free) {
    state.run.courtesanAffinity = bumpAffinity(state.run.courtesanAffinity, key);
  }

  audio.coin();
  state.ui.setCourtesanLine(afterCourtesanLine(variant, state.rng));

  const parts = [];
  if (result.healed > 0) parts.push(`+${result.healed} здоровья`);
  if (result.topped > 0) parts.push(`+${Math.round(result.topped)} запаса`);
  const priceText = free ? "бесплатно" : `−${variant.price} зм.`;
  if (parts.length) state.ui.message(`Отдых: ${parts.join(", ")} (${priceText}).`);

  // Обновляем доступность: повторный визит может быть уже не нужен.
  const freeNow = isFreeVisit(state.run.courtesanAffinity, key);
  const again = courtesanCanServe(
    variant, state.run.gold, player.health, player.maxHealth, player.overheal, freeNow
  );
  state.ui.openCourtesan({
    displayName: variant.displayName,
    temperLabel: variant.temperLabel,
    description: describeCourtesan(variant).replace(
      `${variant.displayName} (${variant.temperLabel}): `, ""
    ),
    line: state.ui.$("courtesan-line").textContent,
    info: again.ok
      ? courtesanInfo(ctx, variant, key, freeNow)
      : "Больше она вам сегодня не поможет.",
    price: variant.price,
    canPay: again.ok,
    free: freeNow,
    affinity: affinityOf(state.run.courtesanAffinity, key),
    rumorUsed: game.courtesanRumorUsed,
  });

  ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  return true;
}

export function askCourtesan(ctx) {
  const { state, game, audio } = ctx;
  // Без открытой панели слух не спрашивают: иначе его можно подслушать
  // через отладку, закрыв панель, и счётчик визитов поедет.
  if (!state.ui.courtesanOpen) return false;

  const courtesan = findCourtesan(ctx, game.activeCourtesan);
  if (!courtesan || !courtesan.variant) return false;
  if (game.courtesanRumorUsed) return false;

  game.courtesanRumorUsed = true;
  const rumor = courtesanRumor(state.run.seed, state.run.visitIndex);
  state.run.visitIndex = (state.run.visitIndex || 0) + 1;

  state.ui.showCourtesanRumor(`«${rumor}»`);
  audio.ui();
  ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  return true;
}

export function leaveCourtesan(ctx) {
  const { state, game, input } = ctx;
  state.ui.closeCourtesan();
  game.uiOpen = false;
  game.courtesanRumorUsed = false;
  game.activeCourtesan = null;
  input.requestLock();
}

// Большой диалог куртизанки: болтовня бесплатна, факты — за деньги.
// Отдельная панель, потому что в панели визита кнопок уже четыре.
export function talkToCourtesan(ctx) {
  const { state, game, audio } = ctx;
  const courtesan = findCourtesan(ctx, game.activeCourtesan);
  if (!courtesan || !courtesan.variant) return false;

  const variant = courtesan.variant;
  const key = courtesan.spot || "square";
  const free = isFreeVisit(state.run.courtesanAffinity, key);

  // Имя НЕ `state`: оно затеняло бы контейнер состояния.
  const tree = ctx.buildCourtesanTree(variant, {
    ...ctx.dialogContext(),
    free,
    knownIntel: state.run.intel || {},
  });

  state.ui.closeCourtesan();
  game.dialog = {
    kind: "courtesan",
    personId: courtesan.id,
    label: variant.displayName,
    greetLine: "",
    state: tree,
    courtesanKey: key,
  };
  ctx.showDialog();
  audio.ui();
  return true;
}

export { AFFINITY_FREE_VISITS };
