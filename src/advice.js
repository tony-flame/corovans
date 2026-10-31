// Цели и советы игроку. Чистый модуль: принимает снимок состояния, отдаёт текст.
// Никакого DOM — панель просто печатает то, что вернулось.

import { goalOf, actOf } from "./run.js";
import { courtesanCanServe, isFreeVisit, COURTESAN_SPOTS } from "./npc.js";

// Что делать прямо сейчас — одна строка.
export function objectiveOf(state) {
  const { run, world, player } = state;
  if (!run) return "Начните новый забег";

  const act = actOf(run);

  if (world && world.wagonLooted) {
    if (run.inventory && run.inventory.items.length > 0) return "Продайте добычу Мардо в деревне";
    if (run.pendingCaravan) return `Новый караван через ${Math.max(1, Math.ceil(run.caravanTimer))} с`;
    return "Возьмите заказ у Мардо";
  }

  if (run.activeContract) return `Заказ: ${run.activeContract.description || "в работе"}`;

  if (player && player.health < player.maxHealth * 0.4) return "Найдите еду или куртизанку: здоровье на исходе";

  return `Ограбьте караван (${act.label})`;
}

// Прогресс к цели акта в процентах.
export function progressOf(state) {
  const { run } = state;
  if (!run) return { current: 0, goal: 300, percent: 0 };

  const goal = goalOf(run);
  const current = Math.min(run.gold, goal);
  return {
    current,
    goal,
    percent: goal > 0 ? Math.round((current / goal) * 100) : 0,
  };
}

// Советы по ситуации: 1-3 штуки, самое важное первым.
export function adviceFor(state) {
  const { run, world, player, game } = state;
  const tips = [];
  if (!run || !player) return tips;

  // Здоровье — приоритет.
  const healthRatio = player.health / player.maxHealth;
  if (healthRatio < 0.35) {
    if (run.bleed && run.bleed.remaining > 0) {
      tips.push("Вы кровоточите: рана сама не закроется, найдите куртизанку или дождитесь конца.");
    }
    tips.push("Здоровье на исходе. Удерживайте E у куртизанки или съешьте мясо (F).");
  }

  // Розыск.
  if (run.wanted > 0) {
    tips.push(`Розыск ${run.wanted}: стража враждебна. Штраф можно оплатить у Мардо.`);
  }

  // Бесплатный визит — приятная новость, о ней стоит напомнить.
  const freePlaces = COURTESAN_SPOTS.filter((spot) => isFreeVisit(run.courtesanAffinity, spot));
  if (freePlaces.length > 0) {
    const labels = {
      square: "на площади",
      inn: "у корчмы",
      forest: "в лесной сторожке",
      camp: "на стоянке",
    };
    tips.push(`Вас ждут бесплатно: ${freePlaces.map((s) => labels[s]).join(", ")}.`);
  }

  // Караван рядом и ещё не обобран — напоминание про стражу.
  if (world && !world.wagonLooted && player) {
    const dist = Math.hypot(player.x - world.wagon.x, player.y - world.wagon.y);
    if (dist < 14) {
      tips.push("Стража видит в конусе. Приседайте (C) и заходите с тыла.");
    }
  }

  // Погода.
  if (game && game.weather && game.weather.intensity > 0.5) {
    tips.push("Непогода: ночью видно хуже, но товар дороже.");
  }

  // Совсем новичку.
  if (run.counters && run.counters.kills === 0 && run.totalSold === 0) {
    tips.push("Совет: тихая кража не даёт розыска и приносит бонус за бесшумность.");
  }

  return tips.slice(0, 3);
}

// Полный снимок для панели.
export function buildAdvicePanel(state) {
  return {
    objective: objectiveOf(state),
    progress: progressOf(state),
    tips: adviceFor(state),
    act: state.run ? actOf(state.run) : null,
  };
}
