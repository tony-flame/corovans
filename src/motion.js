// Физика камеры и прыжка. Чистый модуль: без DOM, покрыт node:test.
// Все величины — в пикселях экранного буфера (640×360), не в игровых единицах карты.

export const GRAVITY = 900;
export const JUMP_VELOCITY = 300;
export const JUMP_STAMINA = 8;

// Наклон камеры (shear горизонта). Клампим, иначе горизонт уезжает за экран
// и разметка пола/потолка ломается.
export const PITCH_LIMIT = 160;
export const PITCH_SENSITIVITY = 1.1;

export function clampPitch(pitch) {
  if (!Number.isFinite(pitch)) return 0;
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
}

export function addPitch(pitch, deltaY) {
  return clampPitch(pitch + deltaY * PITCH_SENSITIVITY);
}

export function createJumpState() {
  return { z: 0, vz: 0, grounded: true };
}

export function canJump(state, player, staminaCost = JUMP_STAMINA) {
  if (!state || !player) return false;
  if (!state.grounded || state.z !== 0) return false;
  if (player.dead) return false;
  if (player.crouching) return false;
  if ((player.stamina || 0) < staminaCost) return false;
  return true;
}

// Один шаг интегрирования. Возвращает новое состояние и флаг приземления.
export function stepJump(state, dt, gravity = GRAVITY) {
  const next = {
    z: state.z,
    vz: state.vz,
    grounded: state.grounded,
  };
  let landed = false;

  if (!state.grounded || state.vz !== 0) {
    next.vz -= gravity * dt;
    next.z += next.vz * dt;
    next.grounded = false;

    if (next.z <= 0) {
      next.z = 0;
      next.vz = 0;
      next.grounded = true;
      landed = true;
    }
  }

  return { state: next, landed };
}

export function startJump(state, velocity = JUMP_VELOCITY) {
  if (!state.grounded) return state;
  return { z: state.z, vz: velocity, grounded: false };
}

// Высота камеры: приседание опускает, прыжок поднимает.
export function viewOffset(jumpState, crouching) {
  const crouchOffset = crouching ? 8 : 0;
  return (jumpState ? jumpState.z : 0) - crouchOffset;
}
