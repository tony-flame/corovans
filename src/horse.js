// Лошадь: посадка, скорость по типу поверхности, запреты верхом.
// Чистый модуль — без DOM. Правила проверяются тестами.

import { TILE } from "./world.js";

export const HORSE_SPEED_ROAD = 2.4;
export const HORSE_SPEED_OFFROAD = 1.5;
export const HORSE_MOUNT_RANGE = 2.0;
export const HORSE_CAMERA_LIFT = 20;
export const MOUNTED_DAMAGE_MULT = 0.8;

// Поверхности, по которым лошадь идёт быстро.
const FAST_TILES = new Set([TILE.ROAD]);
// Поверхности, где ехать нельзя вообще.
const BLOCKED_TILES = new Set([TILE.WATER]);

export function createHorse(id, x, y, options = {}) {
  return {
    id,
    kind: "horse",
    x,
    y,
    homeX: x,
    homeY: y,
    r: 0.55,
    alive: true,
    personal: Boolean(options.personal),
    saddled: true,
    spriteKey: "horseSaddled",
    label: options.personal ? "Ваша лошадь" : "Лошадь",
  };
}

export function horseSpeed(tile, base = 1) {
  if (BLOCKED_TILES.has(tile)) return 0;
  return base * (FAST_TILES.has(tile) ? HORSE_SPEED_ROAD : HORSE_SPEED_OFFROAD);
}

// Можно ли сесть. Возвращает { ok, reason }.
export function canMount(state, horse, tile, distance) {
  if (!horse || !horse.alive) return { ok: false, reason: "no_horse" };
  if (state && state.mounted) return { ok: false, reason: "already_mounted" };
  if (state && state.blocking) return { ok: false, reason: "blocking" };
  if (distance !== undefined && distance > HORSE_MOUNT_RANGE) {
    return { ok: false, reason: "too_far" };
  }
  if (BLOCKED_TILES.has(tile)) return { ok: false, reason: "blocked_terrain" };
  return { ok: true, reason: "" };
}

// Причины отказа человеческим языком.
export const MOUNT_REFUSAL = {
  no_horse: "Лошади здесь нет.",
  already_mounted: "Вы уже в седле.",
  blocking: "Опустите щит, прежде чем садиться.",
  too_far: "Слишком далеко до лошади.",
  blocked_terrain: "Здесь не проехать.",
};

export function mountReasonText(reason) {
  return MOUNT_REFUSAL[reason] || "Не получилось сесть.";
}

// Верхом нельзя: обыск фургона, блок, приседание.
export function allowsAtMount(action) {
  if (action === "steal" || action === "block" || action === "crouch") return false;
  if (action === "attack" || action === "move" || action === "eat") return true;
  return true;
}

export function mountedDamage(damage) {
  return Math.max(1, Math.round(damage * MOUNTED_DAMAGE_MULT));
}

// Позиции лошадей в мире: конюшня и (опционально) личная у спавна.
export function horseSpawns(bonuses = {}) {
  const list = [{ x: 76.5, y: 88.5, id: "stable", personal: false }];
  if (bonuses.fastTravel) {
    list.push({ x: 15.5, y: 96.5, id: "personal", personal: true });
  }
  return list;
}

export function createHorseList(bonuses = {}) {
  return horseSpawns(bonuses).map((s) => createHorse(s.id, s.x, s.y, s));
}
