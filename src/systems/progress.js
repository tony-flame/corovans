// Контракты Мардо и сторонние задания: выдача, проверка, награда.
//
// Оба потока живут вместе, потому что делят одно: чекпоинты, стиль
// и HUD. Разносить их по двум модулям значило бы дублировать ctx.
//
// ctx:
//   state, game, world, player, audio, ui (через state.ui)
//   styleKey, checkActProgress, noteStyle, saveCheckpoint, tradeState

import {
  generateContracts,
  checkContract,
  rewardOf,
  contractName,
} from "../contracts.js";
import {
  checkQuest,
  questProgressText,
  QUEST_TYPES,
} from "../quests.js";
import { CHECKPOINT_REASONS } from "../run.js";
import { ZONES } from "../world.js";

// Какие места считаются «посещёнными» для задания. Зоны берём из мира:
// дублировать координаты — значит разъехаться при следующей перестройке.
export const VISIT_PLACES = {
  cathedral: "CATHEDRAL",
  rathouse: "RATHOUSE",
  market: "MARKET",
};

// ── Контракты ───────────────────────────────────────────────────────

export function refreshContracts(ctx) {
  const { state } = ctx;
  if (!state.run) return;
  if (state.run.activeContract) return;

  state.run.contractOffer = generateContracts(
    state.run.seed,
    state.run.act,
    state.run.offerIndex,
    state.run.tier,
    ctx.styleKey()
  );
  state.run.offerSeed = state.run.contractOffer.length ? state.run.contractOffer[0].id : 0;
  state.run.offerAct = state.run.act;
}

export function acceptContract(ctx, index) {
  const { state, game, audio } = ctx;
  if (!state.ui.tradeOpen || !state.run) return false;

  const offer = state.run.contractOffer[index];
  if (!offer || state.run.activeContract) return false;

  state.run.activeContract = {
    ...offer,
    state: "active",
    acceptedAt: state.run.dayTime,
    acceptedClock: game.clockTotal,
  };
  state.run.contractOffer = [];
  state.run.counters.killsSinceAccept = 0;
  state.run.counters.lootsSinceAccept = 0;
  state.run.counters.chaseSinceAccept = false;
  state.run.counters.driverKilledSinceAccept = false;
  state.run.counters.acceptedAt = state.run.dayTime;
  // Монотонный отпечаток времени: dayTime замыкается, clockTotal нет.
  state.run.counters.acceptedClock = game.clockTotal;

  audio.ui();
  state.ui.message(`Взят заказ: ${contractName(offer.type)}. ${offer.description}`);
  state.ui.renderTrade(ctx.tradeState());
  ctx.saveCheckpoint(CHECKPOINT_REASONS.CONTRACT_ACCEPTED);
  return true;
}

export function contractSnapshot(ctx) {
  const { state, game } = ctx;
  return {
    kills: state.run.counters.kills,
    killsSinceAccept: state.run.counters.killsSinceAccept,
    lootsSinceAccept: state.run.counters.lootsSinceAccept,
    chaseSinceAccept: state.run.counters.chaseSinceAccept,
    driverKilledSinceAccept: state.run.counters.driverKilledSinceAccept,
    items: state.run.inventory.items,
    dayTime: state.run.dayTime,
    acceptedAt: state.run.counters.acceptedAt,
    // Монотонное время: не замыкается через 240 с, поэтому дедлайн
    // нельзя обойти сменой суток.
    clockTotal: game.clockTotal,
    acceptedClock: state.run.counters.acceptedClock,
  };
}

export function evaluateContract(ctx) {
  const { state, game } = ctx;
  if (!state.run || !state.run.activeContract) return;

  const contract = state.run.activeContract;
  const result = checkContract(contract, contractSnapshot(ctx));

  if (contract.deadline && result.status === "active") {
    // Остаток считается по тому же монотонному счётчику, иначе HUD врал.
    const elapsed = Number.isFinite(state.run.counters.acceptedClock)
      ? Math.max(0, game.clockTotal - state.run.counters.acceptedClock)
      : Math.max(0, state.run.dayTime - contract.acceptedAt);
    game.contractTimeLeft = Math.max(0, contract.deadline - elapsed);
  } else {
    game.contractTimeLeft = null;
  }

  if (result.status === "complete") {
    finishContract(ctx, true);
  } else if (result.status === "failed") {
    finishContract(ctx, false, result.reason);
  }
}

export function finishContract(ctx, success, reason = "") {
  const { state, game, audio } = ctx;
  const contract = state.run.activeContract;
  if (!contract) return;

  if (success) {
    const reward = rewardOf(contract, state.run.contractStreak);
    state.run.gold += reward.gold;
    state.run.contractStreak += 1;
    state.run.counters.contractsDone += 1;
    state.profile = {
      ...state.profile,
      reputation: (state.profile.reputation || 0) + reward.rep,
      completedContracts: state.profile.completedContracts.includes(contract.id)
        ? state.profile.completedContracts
        : [...state.profile.completedContracts, contract.id],
      stats: {
        ...state.profile.stats,
        contractsDone: (state.profile.stats.contractsDone || 0) + 1,
      },
    };
    ctx.noteStyle("contract_done");
    if (contract.type === "clean" || contract.type === "unseen") {
      ctx.noteStyle("clean_contract");
    }
    state.ui.message(`Заказ выполнен: +${reward.gold} зм., +${reward.rep} репутации.`);
    audio.coin();
  } else {
    state.run.contractStreak = 0;
    state.run.counters.contractsFailed += 1;
    state.profile = {
      ...state.profile,
      stats: {
        ...state.profile.stats,
        contractsFailed: (state.profile.stats.contractsFailed || 0) + 1,
      },
    };
    ctx.noteStyle("contract_failed");
    state.ui.message(`Заказ провален${reason ? `: ${reason}` : ""}.`);
  }

  state.run.activeContract = null;
  game.contractTimeLeft = null;
  state.run.offerIndex += 1;
  refreshContracts(ctx);
  ctx.checkActProgress();
  ctx.saveCheckpoint(success ? CHECKPOINT_REASONS.CONTRACT_DONE : CHECKPOINT_REASONS.SOLD);
  if (state.ui.tradeOpen) state.ui.renderTrade(ctx.tradeState());
}

// ── Сторонние задания ───────────────────────────────────────────────

export function questSnapshot(ctx) {
  const { state } = ctx;
  return {
    beastsSince: (state.run.quest && state.run.quest.beasts) || {},
    items: state.run.inventory.items,
    visited: (state.run.quest && state.run.quest.visited) || {},
    askedPeople: (state.run.quest && state.run.quest.askedPeople) || [],
  };
}

// Проверяет активное задание и, если оно выполнилось, помечает.
// Награду не выдаёт: за ней надо вернуться к жителю, иначе задание
// закрывалось бы само где-нибудь в лесу без всякого разговора.
export function refreshQuestState(ctx) {
  const { state } = ctx;
  const quest = state.run.quest && state.run.quest.active;
  if (!quest || quest.state === "complete") return false;

  const result = checkQuest(quest, questSnapshot(ctx));
  if (result.status !== "complete") return false;

  quest.state = "complete";
  state.ui.message(
    `${quest.giverLabel}: «${questProgressText(quest, questSnapshot(ctx))}.» Вернитесь и расскажите.`
  );
  ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  return true;
}

export function noteVisitedPlaces(ctx) {
  const { state, player } = ctx;
  const quest = state.run.quest && state.run.quest.active;
  if (!quest || quest.type !== QUEST_TYPES.REACH) return false;

  const zoneName = VISIT_PLACES[quest.targetId];
  const zone = zoneName ? ZONES[zoneName] : null;
  if (!zone) return false;
  if (state.run.quest.visited[quest.targetId]) return false;

  if (
    player.x >= zone.x0 && player.x <= zone.x1 &&
    player.y >= zone.y0 && player.y <= zone.y1
  ) {
    state.run.quest.visited[quest.targetId] = true;
    state.ui.message(`${quest.giverLabel}: вы дошли до места.`);
    refreshQuestState(ctx);
    return true;
  }
  return false;
}
