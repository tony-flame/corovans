// Диалоги: открытие, показ, выбор варианта, эффекты реплик.
//
// Модуль не держит состояния: дерево диалога лежит в game.dialog,
// контейнер состояния приходит в ctx.
//
// ctx:
//   state, game, world, player, input, audio
//   refreshQuestState, saveCheckpoint

import { addItem } from "../inventory.js";
import { dialogueView, chooseOption, currentNode } from "../dialog.js";
import { makeQuest, questReward } from "../quests.js";
import { CHECKPOINT_REASONS } from "../run.js";

// Кто получает какой эффект при покупке факта — для сообщения игроку.
export const INTEL_SUMMARY = {
  guards: "смена часовых короткая — охраны много.",
  sleeper: "один из охраны спит по-настоящему.",
  titan: "титан не подходит к фургону и ждёт.",
  mardo: "Мардо не взвешивает товар, а оценивает покупателя.",
};

// Показать текущий узел дерева в панели.
export function showDialog(ctx) {
  const { state, game } = ctx;
  const d = game.dialog;
  if (!d) return;

  const view = dialogueView(d.state, state.run.gold);
  const text = d.state.history.length === 0 && d.greetLine
    ? `${d.greetLine}\n\n${view.text}`
    : view.text;

  state.ui.openDialog({ title: d.label, text, options: view.options });
}

export function chooseDialogOption(ctx, optionId) {
  const { state, game } = ctx;
  const d = game.dialog;
  if (!d) return false;

  const node = currentNode(d.state);
  const option = node ? (node.options || []).find((o) => o.id === optionId) : null;
  if (!option) return false;

  const result = chooseOption(d.state, optionId, state.run.gold);
  if (result.error) return false;

  // Сначала списываем деньги: эффект применяется уже к оплаченному.
  const cost = option.cost || 0;
  if (cost > 0) {
    if (state.run.gold < cost) return false;
    state.run.gold -= cost;
    ctx.audio.coin();
  }

  d.state = result.state;
  applyDialogEffect(ctx, result.effect);

  if (result.done) {
    closeDialogPanel(ctx);
    if (d.kind === "civilian") {
      state.ui.message(`${d.label}: разговор окончен.`);
    }
    return true;
  }

  showDialog(ctx);
  return true;
}

export function applyDialogEffect(ctx, effect) {
  const { state, game, player, audio } = ctx;
  if (!effect) return;

  // Взяли задание у жителя.
  if (effect.takeQuest) {
    const giver = game.dialog && game.dialog.giver;
    if (!giver) return;

    const quest = makeQuest(state.run.seed, giver, 0);
    if (!quest) return;

    state.run.quest.active = { ...quest, state: "active" };
    state.run.quest.beasts = {};
    state.run.quest.visited = {};
    state.run.quest.askedPeople = [];
    state.ui.message(`${giver.label}: задание взято — ${quest.description.toLowerCase()}.`);
    ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
    return;
  }

  // Сдали задание.
  if (effect.claimQuest) {
    const quest = state.run.quest && state.run.quest.active;
    if (!quest) return;

    const reward = questReward(quest);
    state.run.gold += reward.gold;
    state.profile = {
      ...state.profile,
      reputation: (state.profile.reputation || 0) + reward.rep,
      stats: { ...state.profile.stats },
    };
    state.run.quest.active = null;
    state.ui.message(`Задание выполнено: +${reward.gold} зм., +${reward.rep} репутации.`);
    audio.coin();
    ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
    return;
  }

  // Хлеб у торговки: еда в инвентарь, без наценки.
  if (effect.food) {
    const item = {
      id: `bread-${state.run.visitIndex || 0}`,
      name: "Хлеб",
      value: 4,
      weight: 0.6,
      kind: "food",
      heal: 12,
    };
    if (!addItem(state.run.inventory, item)) {
      state.ui.message("Руки заняты. Хлеб остался у неё.");
      state.run.gold += 3;
    } else {
      state.ui.message("Вы купили хлеб.");
      ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
    }
    return;
  }

  // Милостыня: репутация растёт, деньги уже списаны.
  if (effect.rep) {
    state.profile = {
      ...state.profile,
      reputation: (state.profile.reputation || 0) + effect.rep,
      stats: { ...state.profile.stats },
    };
    state.ui.message(`Вы подали монету. +${effect.rep} репутации.`);
    ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
    return;
  }

  // Благословение: разовое лечение.
  if (effect.bless) {
    const heal = Math.min(20, player.maxHealth - player.health);
    player.health = Math.min(player.maxHealth, player.health + 20);
    state.ui.message(heal > 0 ? `Благословение: +${heal} здоровья.` : "Благословение принято.");
    ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
    return;
  }

  // Купленный факт у куртизанки: запоминаем в ране.
  if (effect.intel) {
    state.run.intel = { ...(state.run.intel || {}), [effect.intel]: true };
    state.ui.message(`Запомнили: ${INTEL_SUMMARY[effect.intel] || "сведения записаны."}`);
    ctx.saveCheckpoint(CHECKPOINT_REASONS.SOLD);
  }
}

export function closeDialogPanel(ctx) {
  const { state, game, input } = ctx;

  state.ui.closeDialog();
  if (game.dialog && game.dialog.kind === "courtesan") {
    // Диалог куртизанки закрыт — возвращаться в её панель через E нельзя,
    // иначе activeCourtesan останется висеть и следующий E откроет
    // чужой разговор.
    game.activeCourtesan = null;
    game.courtesanRumorUsed = false;
  }
  game.dialog = null;
  game.uiOpen = false;
  input.requestLock();
}
