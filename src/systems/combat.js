// Бой: удары игрока, урон по игроку, убийство людей и зверей.
//
// Не импортирует main.js и не держит состояния — всё приходит в ctx.
// Единственная зависимость наружу наружу по поведению: `die()`.
// Она вызывается через ctx, потому что смерть — это не бой, а смена
// состояния забега (откат на чекпоинт), и живёт она в main.js.
//
// ctx:
//   state, game, world, player, audio, ui (через state.ui)
//   noteStyle, saveCheckpoint, evaluateContract, checkActProgress
//   onGuardAlert       — колбэк из enemies.js
//   die                — мягкая смерть
//   refreshQuestState  — пересчёт задания на охоту

import {
  damageRoll,
  inMeleeCone,
  attackCooldown,
  applyArmor,
  blockAbsorb,
  blockFacingDot,
} from "../combat.js";
import { mountedDamage } from "../horse.js";
import { addItem } from "../inventory.js";
import { tuningFor } from "../style.js";
import { SPECIES_DEFS, animalOnHit } from "../wildlife.js";
import { absorbWithOverheal } from "../npc.js";
import { QUEST_TYPES } from "../quests.js";

// Кого нельзя бить: торговец и куртизанка — не цели.
const IMMUNE_KINDS = new Set(["merchant", "courtesan"]);

// Радиус и конус удара. Меч короткий: 1.95 юнита, конус ~66°.
const MELEE_RANGE = 1.95;
const MELEE_CONE = 0.4;

// Титан неуязвим и чувствуется на этом расстоянии.
const TITAN_TOUCH_RANGE = 2.6;

export function performAttack(ctx) {
  const { state, game, world, player, audio } = ctx;
  if (player.attackCd > 0 || player.dead || player.blocking) return false;

  // Титан неуязвим: удар просто отскакивает, но кулдаун тратится.
  const titan = world.titan;
  if (
    titan &&
    titan.alive &&
    Math.hypot(titan.x - player.x, titan.y - player.y) < TITAN_TOUCH_RANGE
  ) {
    player.attackCd = attackCooldown(state.run.upgrades.sword);
    player.swingT = 0.34;
    audio.swing();
    audio.hit();
    state.ui.message("Клинок отскакивает, будто от скалы. Его нельзя убить.");
    return false;
  }

  player.attackCd = attackCooldown(state.run.upgrades.sword);
  player.swingT = 0.34;
  audio.swing();
  game.noiseTimer = 0.5;

  const target = pickTarget(world, player);

  if (!target) {
    alertNoise(ctx, player.x, player.y, 7);
    return false;
  }

  // С седла бьёшь хуже: замах короче, опора хуже.
  const baseDmg = damageRoll(12 + state.run.upgrades.sword * 5, state.rng);
  const dmg = game.mounted ? mountedDamage(baseDmg) : baseDmg;

  if (target.isAnimal) {
    return hitAnimal(ctx, target.actor, dmg);
  }

  return hitActor(ctx, target.actor, dmg);
}

// Ближайшая цель в конусе удара. Живность ищется вторым проходом:
// у неё свой код урона, но выбирать надо по той же дистанции,
// иначе меч «прыгает» на зверя сквозь стражника.
export function pickTarget(world, player) {
  let best = null;
  let bestDist = Infinity;

  for (const actor of world.actors) {
    if (!actor.alive) continue;
    if (IMMUNE_KINDS.has(actor.kind)) continue;
    if (!inMeleeCone(
      player.x, player.y, player.dirX, player.dirY,
      actor.x, actor.y, MELEE_RANGE, MELEE_CONE
    )) continue;

    const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { actor, isAnimal: false };
    }
  }

  for (const animal of world.animals || []) {
    if (!animal.alive) continue;
    if (!inMeleeCone(
      player.x, player.y, player.dirX, player.dirY,
      animal.x, animal.y, MELEE_RANGE, MELEE_CONE
    )) continue;

    const dist = Math.hypot(animal.x - player.x, animal.y - player.y);
    if (dist < bestDist) {
      bestDist = dist;
      best = { actor: animal, isAnimal: true };
    }
  }

  return best;
}

function hitAnimal(ctx, animal, dmg) {
  const { state, audio } = ctx;
  state.ui.flashHit();
  audio.hit();

  const result = animalOnHit(animal, dmg);
  if (result.killed) {
    killAnimal(ctx, result.animal, result.drops);
  } else {
    const label = SPECIES_DEFS[animal.kind].label.toLowerCase();
    state.ui.message(`Вы ранили ${label} (-${dmg}).`);
    audio.beast?.(animal.kind);
  }
  return true;
}

function hitActor(ctx, target, dmg) {
  const { state, game, player, audio } = ctx;

  target.hp -= dmg;
  if (target.asleep) target.asleep = false;
  state.ui.flashHit();

  // Стражник хрипит от попадания, обычные цели — просто удар.
  if (target.kind === "guard" || target.kind === "village_guard" || target.kind === "driver") {
    audio.guardHit();
  } else {
    audio.hit();
  }

  alertNoise(ctx, player.x, player.y, 9);

  if (target.hp <= 0) {
    killActor(ctx, target);
    return true;
  }

  if (target.kind === "guard") {
    target.state = "chase";
    target.suspicion = 1.2;
    target.alerted = true;
    target.lostTimer = 0;
    game.onGuardAlert?.(target);
  } else if (target.kind === "driver") {
    target.state = "flee";
    target.suspicion = 1;
  } else if (target.kind === "village_guard") {
    target.state = "chase";
    target.suspicion = 1.2;
    target.lostTimer = 0;
    state.run.wanted = Math.min(5, state.run.wanted + 1);
  }

  const label = target.kind === "driver" ? "возницу" : "стражника";
  state.ui.message(`Вы ранили ${label} (-${dmg}).`);
  return true;
}

// Убийство животного: добыча в инвентарь, розыск НЕ начисляется.
// Только люди дают розыск и стиль «убийца» — это правило из AGENTS.md.
export function killAnimal(ctx, animal, drops) {
  const { state, audio } = ctx;
  const def = SPECIES_DEFS[animal.kind];
  let taken = 0;

  // Задание на охоту: считаем по видам, а не «всего зверей».
  const quest = state.run.quest && state.run.quest.active;
  if (quest && quest.type === QUEST_TYPES.HUNT) {
    state.run.quest.beasts[animal.kind] = (state.run.quest.beasts[animal.kind] || 0) + 1;
    ctx.refreshQuestState?.();
  }

  for (const drop of drops) {
    if (addItem(state.run.inventory, drop)) taken++;
  }

  const value = drops.reduce((sum, d) => sum + d.value, 0);
  state.ui.message(
    taken > 0
      ? `Вы убили ${def.label.toLowerCase()}. Добыча: ${drops.map((d) => d.name).join(", ")} (${value} зм.).`
      : `Вы убили ${def.label.toLowerCase()}, но добыча не поместилась.`
  );
  audio.coin();
  return taken;
}

export function killActor(ctx, actor) {
  const { state, audio } = ctx;

  actor.alive = false;
  actor.hp = 0;
  actor.state = "dead";

  const tuning = tuningFor(state.run.style);
  const drop = Math.round((6 + state.run.tier * 3 + Math.floor(state.rng() * 6)) * tuning.killDrop);
  state.run.gold += drop;
  state.run.wanted = Math.min(5, state.run.wanted + 1);
  state.run.counters.kills += 1;
  state.run.counters.killsSinceAccept += 1;
  if (actor.kind === "driver") state.run.counters.driverKilledSinceAccept = true;

  ctx.noteStyle("kill");
  audio.guardDeath();
  audio.coin();

  const label =
    actor.kind === "driver"
      ? "возницу"
      : actor.kind === "village_guard"
        ? "городского стражника"
        : "стражника";
  state.ui.message(`Вы убили ${label}. Добыча: ${drop} зм. Розыск +1.`);

  ctx.evaluateContract();
  ctx.checkActProgress();
  return drop;
}

// Шум будит и поднимает стражу в радиусе. Возница убегает, стражник
// переходит в погоню. Спящих будим: иначе обыск в двух шагах бесшумен.
export function alertNoise(ctx, x, y, radius) {
  const { world } = ctx;

  for (const actor of world.actors) {
    if (!actor.alive) continue;
    if (actor.kind !== "guard" && actor.kind !== "driver") continue;

    const dist = Math.hypot(actor.x - x, actor.y - y);
    if (dist > radius) continue;

    if (actor.kind === "driver") {
      actor.state = "flee";
      actor.suspicion = 1;
    } else if (actor.state !== "chase") {
      actor.state = "chase";
      actor.suspicion = 1.2;
      actor.alerted = true;
      actor.lostTimer = 0;
      actor.asleep = false;
    }
  }
}

export function damagePlayer(ctx, amount, source) {
  const { state, game, player, audio } = ctx;
  if (player.dead || game.gameOver) return 0;
  // Режим разработчика: урон не проходит.
  if (game.godMode) return 0;

  let raw = damageRoll(amount, state.rng);

  // Блок гасит урон только спереди и тратит выносливость.
  if (player.blocking && source && Number.isFinite(source.x)) {
    const dot = blockFacingDot(player.x, player.y, player.dirX, player.dirY, source.x, source.y);
    const result = blockAbsorb(raw, player.stamina, dot);
    if (result.blocked) {
      player.stamina = result.stamina;
      raw = result.damage;
      if (result.broke) {
        player.blockBroke = 0.5;
        state.ui.message("Блок пробит — выносливость на нуле!");
        audio.hit();
      } else {
        audio.block();
      }
    }
  }

  const dmg = applyArmor(raw, state.run.upgrades.armor);
  // Запас бодрости принимает удар первым, здоровье — остатком.
  const absorbed = absorbWithOverheal(dmg, player.health, player.overheal);
  player.health = absorbed.health;
  player.overheal = absorbed.overheal;
  player.hurtFlash = 1;
  if (!player.blocking) audio.hurt();
  ctx.noteStyle("damage_taken");

  const label =
    source?.kind === "village_guard"
      ? "Городской стражник"
      : source?.kind === "driver"
        ? "Возница"
        : "Стражник";
  state.ui.message(`${label} ранил вас (-${dmg}).`);

  if (player.health <= 0) ctx.die();
  return dmg;
}

export { IMMUNE_KINDS, MELEE_RANGE, MELEE_CONE };
