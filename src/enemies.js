import { lineOfSight, moveActor, wakeSleepers } from "./world.js";
import { phaseOf, phaseInfo } from "./daynight.js";

function moveToward(world, actor, tx, ty, speed, dt) {
  const dx = tx - actor.x;
  const dy = ty - actor.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return dist;
  const nx = dx / dist;
  const ny = dy / dist;
  actor.angle = Math.atan2(ny, nx);
  const ox = actor.x;
  const oy = actor.y;
  moveActor(world, actor, nx * speed * dt, ny * speed * dt);
  const moved = Math.hypot(actor.x - ox, actor.y - oy);
  if (moved < speed * dt * 0.35) {
    // обход препятствия
    moveActor(world, actor, -ny * speed * dt * 0.8, nx * speed * dt * 0.8);
  }

  // Шаги стража: звук был написан, но не вызывался ниоткуда.
  // Интервал считается по пройденному пути, а не по таймеру, иначе
  // на медленном шаге шаги строчились бы, а на быстром пропадали.
  actor.stepDistance = (actor.stepDistance || 0) + moved;
  if (moved > 0.001 && actor.stepDistance > 1.6) {
    actor.stepDistance = 0;
    actor.onStep?.();
  }
  return dist;
}

// Множитель обзора от фазы суток. Ночью стража видит хуже.
function daylightFactor(game) {
  const info = phaseInfo(phaseOf(game.dayTime || 0));
  return info.guardSeeing;
}

function perceive(actor, player, world, wanted, game) {
  const dx = player.x - actor.x;
  const dy = player.y - actor.y;
  const dist = Math.hypot(dx, dy);
  let range = actor.viewRange * daylightFactor(game);
  if (player.crouching) range *= 0.55;
  if (player.sprinting) range *= 1.3;
  if (actor.kind === "village_guard" && wanted > 0) range = Math.max(range, 14);
  if (dist > range) return 0;
  if (!lineOfSight(world, actor.x, actor.y, player.x, player.y)) return 0;
  if (dist > 2.2) {
    const fx = Math.cos(actor.angle);
    const fy = Math.sin(actor.angle);
    const dot = (dx / dist) * fx + (dy / dist) * fy;
    if (dot < 0.12) return 0;
  }
  return 1;
}

function alertNearby(game, source) {
  for (const other of game.world.actors) {
    if (other === source || !other.alive) continue;
    if (other.kind !== "guard" && other.kind !== "driver") continue;
    const dist = Math.hypot(other.x - source.x, other.y - source.y);
    if (dist < 9 && other.state !== "chase") {
      other.state = "chase";
      other.suspicion = 1.2;
      other.alerted = true;
      other.lostTimer = 0;
      if (other.asleep) other.asleep = false;
    }
  }
}

function startChase(game, actor) {
  if (actor.state !== "chase") {
    actor.state = "chase";
    actor.alerted = true;
    actor.lostTimer = 0;
    actor.lastSeenX = game.player.x;
    actor.lastSeenY = game.player.y;
    game.onGuardAlert(actor);
    alertNearby(game, actor);
  }
}

function updateGuard(game, actor, dt) {
  const { world, player } = game;
  const dx = player.x - actor.x;
  const dy = player.y - actor.y;
  const dist = Math.hypot(dx, dy);

  if (player.dead) {
    actor.state = "idle";
    actor.suspicion = 0;
    actor.asleep = false;
    return;
  }

  // Спящий страж просыпается от шума рядом или от тревоги соседей.
  if (actor.asleep) {
    const noiseWake = (game.noiseLevel || 0) > 0.5 && dist < 5;
    if (noiseWake) {
      actor.asleep = false;
      actor.suspicion = 1;
      actor.state = "return";
      actor.lostTimer = 0;
    } else {
      actor.suspicion = Math.max(0, actor.suspicion - dt * 0.3);
      return;
    }
  }

  if (actor.kind === "village_guard" && game.wanted > 0 && dist < 22) {
    const visible = lineOfSight(world, actor.x, actor.y, player.x, player.y);
    if (visible) startChase(game, actor);
  }

  const seen = perceive(actor, player, world, game.wanted, game);
  if (seen) {
    const range = Math.max(1, actor.viewRange);
    const gain = 0.75 + Math.max(0, 1 - dist / range) * 1.6;
    actor.suspicion = Math.min(
      2,
      actor.suspicion + dt * gain * (player.crouching ? 0.55 : 1) * (1 + (game.noiseLevel || 0) * 0.5)
    );
    actor.lastSeenX = player.x;
    actor.lastSeenY = player.y;
    if (actor.suspicion >= 1) startChase(game, actor);
  } else if (actor.state !== "chase") {
    actor.suspicion = Math.max(0, actor.suspicion - dt * 0.4);
  }

  if (actor.state === "chase") {
    if (seen) actor.lostTimer = 0;
    else actor.lostTimer += dt;

    // Потеряв игрока, страж идёт к точке последнего контакта, а не телепортируется.
    if (actor.lostTimer > 4.5) {
      actor.state = "search";
      actor.suspicion = 0.6;
      actor.searchTimer = 0;
      return;
    }

    if (dist > 1.45) {
      moveToward(world, actor, player.x, player.y, actor.speed * 1.12, dt);
    } else if (actor.attackCd <= 0 && seen) {
      // Пауза между ударами: 1.15 с давала слишком высокий DPS на первом тире.
      actor.attackCd = 1.35;
      game.damagePlayer(actor.damage, actor);
    }
    return;
  }

  // Память: поиск в последней известной точке, потом возврат на пост.
  if (actor.state === "search") {
    actor.searchTimer = (actor.searchTimer || 0) + dt;
    const tx = actor.lastSeenX !== null ? actor.lastSeenX : actor.homeX;
    const ty = actor.lastSeenY !== null ? actor.lastSeenY : actor.homeY;
    const reached = moveToward(world, actor, tx, ty, actor.speed * 0.9, dt);
    if (reached < 0.6) actor.searchTimer += dt * 1.5;
    if (actor.searchTimer > 6) {
      actor.state = "return";
      actor.suspicion = 0.3;
      actor.lastSeenX = null;
      actor.lastSeenY = null;
    }
    return;
  }

  if (actor.state === "return") {
    const homeDist = moveToward(world, actor, actor.homeX, actor.homeY, actor.speed * 0.8, dt);
    if (homeDist < 0.5) {
      actor.state = "idle";
      actor.suspicion = 0;
    }
    return;
  }

  // патруль
  const point = actor.patrol[actor.patrolIndex % Math.max(1, actor.patrol.length)];
  if (point) {
    const d = moveToward(world, actor, point.x, point.y, 0.55, dt);
    if (d < 0.35) actor.patrolIndex = (actor.patrolIndex + 1) % actor.patrol.length;
  }
}

function updateDriver(game, actor, dt) {
  const { world, player } = game;
  const dx = actor.x - player.x;
  const dy = actor.y - player.y;
  const dist = Math.hypot(dx, dy);

  if (actor.state === "chase") actor.state = "flee";
  if (actor.state === "flee") {
    if (dist > 15) {
      actor.state = "idle";
      return;
    }
    const nx = dx / Math.max(0.001, dist);
    const ny = dy / Math.max(0.001, dist);
    const beforeX = actor.x;
    const beforeY = actor.y;
    moveActor(world, actor, nx * actor.speed * dt, ny * actor.speed * dt);
    // Шаги и в погоне (см. комментарий в moveToward).
    const moved = Math.hypot(actor.x - beforeX, actor.y - beforeY);
    actor.stepDistance = (actor.stepDistance || 0) + moved;
    if (moved > 0.001 && actor.stepDistance > 1.6) {
      actor.stepDistance = 0;
      actor.onStep?.();
    }
    actor.angle = Math.atan2(ny, nx);
    return;
  }

  const seen = perceive(actor, player, world, game.wanted, game);
  if (seen) {
    actor.suspicion = Math.min(2, actor.suspicion + dt * 1.4);
    if (actor.suspicion > 0.55) {
      actor.state = "flee";
      actor.alerted = true;
      game.onGuardAlert(actor);
    }
  } else {
    actor.suspicion = Math.max(0, actor.suspicion - dt * 0.3);
  }

  const point = actor.patrol[0];
  if (point) moveToward(world, actor, point.x, point.y, 0.4, dt);
}

// Максимальное подозрение по лагерю — для индикатора «глаз» в HUD.
// Только люди: над коровой полоска подозрения выглядела бы как баг.
export function maxSuspicion(world) {
  let max = 0;
  let chasing = false;
  for (const actor of world.actors) {
    if (!actor.alive) continue;
    if (actor.kind !== "guard" && actor.kind !== "village_guard" && actor.kind !== "driver") continue;
    if (actor.state === "chase") chasing = true;
    if (actor.suspicion > max) max = actor.suspicion;
  }
  return { value: Math.min(1, max), chasing };
}

export function updateActors(game, dt) {
  // Шум поднимает спящих рядом с игроком: красться тихо — единственный способ не разбудить.
  if ((game.noiseLevel || 0) > 0.5) wakeSleepers(game.world, game.player.x, game.player.y, 7);

  for (const actor of game.world.actors) {
    if (!actor.alive) continue;

    // Явный диспетчер по видам. Без него любое новое существо попадает
    // в updateGuard и начинает патрулировать и бить игрока.
    if (actor.kind === "merchant" || actor.kind === "courtesan") continue;
    if (actor.kind === "driver") {
      actor.attackCd = Math.max(0, actor.attackCd - dt);
      updateDriver(game, actor, dt);
      continue;
    }
    if (actor.kind === "guard" || actor.kind === "village_guard") {
      actor.attackCd = Math.max(0, actor.attackCd - dt);
      updateGuard(game, actor, dt);
      continue;
    }
    // Неизвестный вид: не трогаем. Лучше неподвижный NPC, чем стражник-корова.
  }
}
