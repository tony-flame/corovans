// Боевые формулы. Чистые функции — покрыты node:test.
export function damageRoll(base, rng = Math.random) {
  return Math.max(1, Math.round(base * (0.85 + rng() * 0.3)));
}

export function applyArmor(damage, armorLevel) {
  return Math.max(1, damage - armorLevel * 2);
}

export function inMeleeCone(px, py, dirX, dirY, tx, ty, range, cosHalfAngle = 0.55) {
  const dx = tx - px;
  const dy = ty - py;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 1e-6) return true;
  const dot = (dx / dist) * dirX + (dy / dist) * dirY;
  return dot >= cosHalfAngle;
}

export function attackCooldown(swordLevel) {
  return Math.max(0.32, 0.62 - swordLevel * 0.06);
}

export function stealTime(lockpickLevel) {
  return Math.max(1.2, 2.8 - lockpickLevel * 0.5);
}

// Блок: работает только спереди и жрёт выносливость.
// Возвращает урон после блока (до брони), остаток стамины и флаг пробития.
export const BLOCK_ABSORB = 0.75;
export const BLOCK_BROKEN_ABSORB = 0.25;
export const BLOCK_STAMINA_PER_DAMAGE = 1.2;
export const BLOCK_FRONT_DOT = 0.25;

export function blockFacingDot(px, py, dirX, dirY, sx, sy) {
  const dx = sx - px;
  const dy = sy - py;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return 1;
  return (dx / dist) * dirX + (dy / dist) * dirY;
}

export function blockAbsorb(damage, stamina, facingDot) {
  const safeDamage = Math.max(0, damage);
  const safeStamina = Math.max(0, stamina);
  const front = Number.isFinite(facingDot) ? facingDot : 1;

  // Атака со спины блок не ловит.
  if (front < BLOCK_FRONT_DOT) {
    return { damage: safeDamage, stamina: safeStamina, broke: false, blocked: false };
  }

  const cost = safeDamage * BLOCK_STAMINA_PER_DAMAGE;
  if (safeStamina < cost) {
    return {
      damage: Math.max(1, Math.round(safeDamage * (1 - BLOCK_BROKEN_ABSORB))),
      stamina: 0,
      broke: true,
      blocked: true,
    };
  }

  return {
    damage: Math.max(1, Math.round(safeDamage * (1 - BLOCK_ABSORB))),
    stamina: safeStamina - cost,
    broke: false,
    blocked: true,
  };
}
