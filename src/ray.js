// Трассировка лучей для рендера стен. Чистый модуль: без DOM и canvas,
// поэтому геометрию можно проверять тестами.
//
// История бага: в renderWalls стояло
//     if (!hit || perpDist < 0.05) perpDist = 0.05;
// то есть промах луча трактовался как стена в 5 см от лица. На карте 40×40
// луч всегда успевал упереться в границу мира за 80 шагов, поэтому баг не
// проявлялся. На карте 120×120 луч до границы не доходил, hit оставался
// false, и стена растягивалась на 20 экранов — те самые серые столбы.

import { MAP_W, MAP_H, TILE, isWallTile } from "./world.js";

// Минимальная дистанция, ниже которой считаем, что игрок упёрся в стену.
export const MIN_HIT_DIST = 0.05;
// Максимальная дальность отрисовки, совпадает с MAX_DIST в raycaster.js.
export const MAX_RAY_DIST = 40;

export { isWallTile };

// Каст одного луча методом DDA.
// dirX/dirY — направление луча (не обязательно нормализованное, как в
// классическом Lodev-рейкастере: тогда dist получается перпендикулярным).
export function castRay(world, px, py, dirX, dirY, maxDist = MAX_RAY_DIST) {
  let mapX = Math.floor(px);
  let mapY = Math.floor(py);

  const deltaX = Math.abs(dirX) < 1e-9 ? 1e30 : Math.abs(1 / dirX);
  const deltaY = Math.abs(dirY) < 1e-9 ? 1e30 : Math.abs(1 / dirY);

  let stepX;
  let stepY;
  let sideX;
  let sideY;

  if (dirX < 0) {
    stepX = -1;
    sideX = (px - mapX) * deltaX;
  } else {
    stepX = 1;
    sideX = (mapX + 1 - px) * deltaX;
  }

  if (dirY < 0) {
    stepY = -1;
    sideY = (py - mapY) * deltaY;
  } else {
    stepY = 1;
    sideY = (mapY + 1 - py) * deltaY;
  }

  // Лимит шагов привязан к диагонали карты, а не к магическому числу:
  // иначе он молча перестаёт хватать при росте карты.
  const maxSteps = Math.ceil(Math.hypot(MAP_W, MAP_H)) + 2;

  let side = 0;
  let tile = TILE.STONE;
  let hit = false;

  for (let i = 0; i < maxSteps; i++) {
    if (sideX < sideY) {
      sideX += deltaX;
      mapX += stepX;
      side = 0;
    } else {
      sideY += deltaY;
      mapY += stepY;
      side = 1;
    }

    if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) {
      // Вышли за мир: это не стена, а пустота.
      hit = false;
      break;
    }

    tile = world.map[mapY * MAP_W + mapX];
    if (isWallTile(tile)) {
      hit = true;
      break;
    }

    const travelled = side === 0 ? sideX - deltaX : sideY - deltaY;
    if (travelled > maxDist) break;
  }

  if (!hit) {
    return {
      hit: false,
      dist: maxDist,
      side: 0,
      tile: TILE.STONE,
      mapX,
      mapY,
      wallX: 0,
    };
  }

  let dist = side === 0 ? sideX - deltaX : sideY - deltaY;
  if (!Number.isFinite(dist) || dist < MIN_HIT_DIST) dist = MIN_HIT_DIST;
  if (dist > maxDist) dist = maxDist;

  let wallX = side === 0 ? py + dist * dirY : px + dist * dirX;
  wallX -= Math.floor(wallX);
  if (wallX < 0) wallX = 0;
  if (wallX >= 1) wallX = 0.999999;

  return { hit: true, dist, side, tile, mapX, mapY, wallX };
}
