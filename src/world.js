// Карта, коллизии, актёры и стоянка каравана.
export const TILE = {
  GRASS: 0,
  BRICK: 1,
  WOOD: 2,
  STONE: 3,
  ROAD: 4,
  DIRT: 5,
};

export const MAP_W = 40;
export const MAP_H = 40;

let nextActorId = 1;

function isWallTile(t) {
  return t === TILE.BRICK || t === TILE.WOOD || t === TILE.STONE;
}

export function createWorld() {
  const map = new Uint8Array(MAP_W * MAP_H).fill(TILE.GRASS);

  const setTile = (x, y, t) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) map[y * MAP_W + x] = t;
  };
  const fillRect = (x0, y0, x1, y1, t) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) setTile(x, y, t);
    }
  };

  // граница мира
  fillRect(0, 0, MAP_W - 1, 0, TILE.STONE);
  fillRect(0, MAP_H - 1, MAP_W - 1, MAP_H - 1, TILE.STONE);
  fillRect(0, 0, 0, MAP_H - 1, TILE.STONE);
  fillRect(MAP_W - 1, 0, MAP_W - 1, MAP_H - 1, TILE.STONE);

  // стоянка каравана и деревенская площадь
  fillRect(25, 3, 36, 13, TILE.DIRT);
  fillRect(8, 22, 16, 25, TILE.DIRT);

  // дороги: деревня -> восток -> север к стоянке
  fillRect(3, 23, 33, 24, TILE.ROAD);
  fillRect(29, 4, 30, 22, TILE.ROAD);

  // дома деревни
  fillRect(4, 18, 8, 21, TILE.BRICK);
  fillRect(10, 18, 13, 21, TILE.WOOD);
  fillRect(4, 26, 7, 29, TILE.STONE);
  fillRect(11, 26, 14, 29, TILE.WOOD);

  // руины у дороги — укрытия
  fillRect(19, 19, 20, 20, TILE.STONE);
  fillRect(23, 16, 24, 17, TILE.STONE);
  fillRect(35, 20, 35, 21, TILE.STONE);

  const props = [];
  const addProp = (sprite, x, y, r, scale, solid = true, blocksSight = false) => {
    props.push({ sprite, x, y, r, scale, solid, blocksSight });
  };

  // стоянка
  addProp("wagon", 30.3, 8.1, 1.15, 0.95, true, true);
  addProp("horse", 33.1, 6.9, 0.55, 0.85, true, true);
  addProp("campfire", 27.2, 6.8, 0.32, 0.5, true, false);
  addProp("crate", 28.9, 6.4, 0.36, 0.6, true, false);
  addProp("crate", 33.6, 10.9, 0.36, 0.6, true, false);
  addProp("barrel", 27.3, 9.9, 0.32, 0.55, true, false);
  addProp("barrel", 33.8, 6.1, 0.32, 0.55, true, false);
  addProp("sign", 27.4, 22.1, 0.22, 0.8, true, false);

  // деревья и кусты
  const trees = [
    [16, 27], [20, 27], [24, 27], [34.5, 22.4], [35.2, 25.6], [34, 18],
    [27, 15], [24, 12], [21, 8], [18, 5], [24, 3.6], [36, 4.5],
    [12, 16], [9, 14], [5, 33], [14, 34], [22, 34], [30, 34], [35, 31],
    [37, 14], [6, 15], [15, 10], [4, 8], [20, 16], [26, 26.6],
    [17, 12], [11, 8], [32, 17], [38, 8], [2.5, 18], [2.5, 29],
  ];
  for (const [x, y] of trees) addProp("tree", x, y, 0.36, 1.5, true, true);

  const bushes = [
    [17.2, 25.6], [22.8, 25.7], [12.5, 21.7], [7.2, 23.4], [18.6, 22.5],
    [31.8, 12.6], [25.4, 12.7], [36.4, 11.8], [15.6, 30.8], [9.5, 31.5],
  ];
  for (const [x, y] of bushes) addProp("bush", x, y, 0.32, 0.7, true, true);

  const rocks = [
    [27, 12.5], [34.2, 12.2], [26.2, 4.6], [36.2, 9], [17, 29],
    [23, 22.2], [13.5, 23.2], [38, 20],
  ];
  for (const [x, y] of rocks) addProp("rock", x, y, 0.48, 0.65, true, true);

  const actors = [];

  const addActor = (kind, x, y, options = {}) => {
    const actor = {
      id: nextActorId++,
      kind,
      x,
      y,
      r: 0.32,
      hp: 40,
      maxHp: 40,
      damage: 7,
      speed: 2,
      viewRange: 8,
      state: "idle",
      suspicion: 0,
      attackCd: 0,
      angle: 0,
      patrol: [],
      patrolIndex: 0,
      homeX: x,
      homeY: y,
      alive: true,
      alertTimer: 0,
      lostTimer: 0,
      ...options,
    };
    actors.push(actor);
    return actor;
  };

  const merchant = addActor("merchant", 9.6, 22.35, {
    hp: 9999,
    maxHp: 9999,
    speed: 0,
    viewRange: 0,
  });

  const villageGuard = addActor("village_guard", 16.6, 24.4, {
    hp: 70,
    maxHp: 70,
    damage: 10,
    speed: 2.2,
    viewRange: 9,
    patrol: [
      { x: 16.6, y: 24.4 },
      { x: 20.4, y: 24.4 },
      { x: 20.4, y: 23.4 },
      { x: 16.6, y: 23.4 },
    ],
  });

  const world = {
    map,
    props,
    actors,
    merchant,
    villageGuard,
    spawn: { x: 7.5, y: 24.5 },
    wagon: { x: 30.3, y: 8.1 },
    tier: 1,
    wagonLooted: false,
    campGuards: [],
  };

  spawnCamp(world, 1);
  return world;
}

export function spawnCamp(world, tier) {
  world.actors = world.actors.filter((a) => a.kind !== "guard" && a.kind !== "driver");
  world.tier = tier;
  world.wagonLooted = false;

  const guardSpots = [
    [28.2, 10.2],
    [32.7, 9.6],
    [28.0, 7.6],
    [33.2, 11.4],
    [27.4, 11.4],
  ];
  const guardCount = Math.min(1 + tier, guardSpots.length);
  world.campGuards = [];

  for (let i = 0; i < guardCount; i++) {
    const [x, y] = guardSpots[i];
    const guard = {
      id: nextActorId++,
      kind: "guard",
      x,
      y,
      r: 0.32,
      hp: 38 + tier * 14,
      maxHp: 38 + tier * 14,
      damage: 7 + tier * 2,
      speed: 2.0 + tier * 0.08,
      viewRange: 8 + tier * 0.4,
      state: "idle",
      suspicion: 0,
      attackCd: 0,
      angle: Math.PI / 2,
      patrol: [
        { x, y },
        { x: x + 1.4, y: y + 1.2 },
        { x: x + 0.6, y: y + 2.2 },
        { x: x - 0.8, y: y + 1.0 },
      ],
      patrolIndex: 1,
      homeX: x,
      homeY: y,
      alive: true,
      alertTimer: 0,
      lostTimer: 0,
    };
    world.actors.push(guard);
    world.campGuards.push(guard);
  }

  const driver = {
    id: nextActorId++,
    kind: "driver",
    x: 30.4,
    y: 6.3,
    r: 0.3,
    hp: 22 + tier * 6,
    maxHp: 22 + tier * 6,
    damage: 3,
    speed: 2.6,
    viewRange: 7,
    state: "idle",
    suspicion: 0,
    attackCd: 0,
    angle: Math.PI / 2,
    patrol: [{ x: 30.4, y: 6.3 }],
    patrolIndex: 0,
    homeX: 30.4,
    homeY: 6.3,
    alive: true,
    alertTimer: 0,
    lostTimer: 0,
  };
  world.actors.push(driver);
  world.campGuards.push(driver);
}

export function isSolid(world, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return true;
  return isWallTile(world.map[cy * MAP_W + cx]);
}

export function tileAt(world, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= MAP_W || cy >= MAP_H) return TILE.STONE;
  return world.map[cy * MAP_W + cx];
}

export function circleHitsWall(world, x, y, r) {
  if (isSolid(world, x, y)) return true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (isSolid(world, x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
  }
  return false;
}

export function canStand(world, x, y, r, ignore = null) {
  if (circleHitsWall(world, x, y, r)) return false;

  for (const prop of world.props) {
    if (!prop.solid) continue;
    const dx = x - prop.x;
    const dy = y - prop.y;
    if (dx * dx + dy * dy < (r + prop.r) * (r + prop.r)) return false;
  }

  for (const actor of world.actors) {
    if (actor === ignore || !actor.alive) continue;
    const dx = x - actor.x;
    const dy = y - actor.y;
    if (dx * dx + dy * dy < (r + actor.r) * (r + actor.r)) return false;
  }
  return true;
}

// Движение по осям отдельно — позволяет скользить вдоль стен.
export function moveActor(world, actor, dx, dy, r = actor.r) {
  if (dx !== 0 && canStand(world, actor.x + dx, actor.y, r, actor)) actor.x += dx;
  if (dy !== 0 && canStand(world, actor.x, actor.y + dy, r, actor)) actor.y += dy;
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  let t = lenSq > 0 ? ((px - x1) * vx + (py - y1) * vy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + vx * t;
  const cy = y1 + vy * t;
  return Math.hypot(px - cx, py - cy);
}

export function lineOfSight(world, x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.ceil(dist / 0.12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (isSolid(world, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  for (const prop of world.props) {
    if (!prop.blocksSight) continue;
    if (pointSegmentDistance(prop.x, prop.y, x1, y1, x2, y2) < prop.r * 0.85) return false;
  }
  return true;
}

export function nearestInteraction(world, player) {
  const candidates = [];

  if (!world.wagonLooted) {
    candidates.push({
      type: "wagon",
      x: world.wagon.x,
      y: world.wagon.y,
      radius: 2.5,
      label: "Удерживайте E — обыскать фургон",
    });
  }

  const merchant = world.merchant;
  candidates.push({
    type: "merchant",
    x: merchant.x,
    y: merchant.y,
    radius: 2.3,
    label: "E — поговорить со скупщиком",
  });

  let best = null;
  for (const c of candidates) {
    const dist = Math.hypot(player.x - c.x, player.y - c.y);
    if (dist <= c.radius && (!best || dist < best.dist)) best = { ...c, dist };
  }
  return best;
}
