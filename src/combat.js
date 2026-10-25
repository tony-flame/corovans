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
