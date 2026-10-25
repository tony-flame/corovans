import { Renderer } from "./raycaster.js";
import { Input } from "./input.js";
import { Player } from "./player.js";
import { createWorld, nearestInteraction, spawnCamp } from "./world.js";
import { updateActors } from "./enemies.js";
import { UI } from "./ui.js";
import { AudioSys } from "./audio.js";
import { createInventory, addItem, totalValue, rollLoot } from "./inventory.js";
import { createUpgrades, purchase, fineFor, sellMultiplier, UPGRADES } from "./economy.js";
import { damageRoll, inMeleeCone, attackCooldown, stealTime, applyArmor } from "./combat.js";

const canvas = document.getElementById("game");
const world = createWorld();
const player = new Player(world.spawn);
const renderer = new Renderer(canvas);
const audio = new AudioSys();

const game = {
  world,
  player,
  renderer,
  audio,
  gold: 25,
  upgrades: createUpgrades(),
  inventory: createInventory(),
  wanted: 0,
  totalSold: 0,
  stealing: false,
  stealProgress: 0,
  pendingCaravan: false,
  caravanTimer: 0,
  lootSoldForTier: false,
  started: false,
  paused: false,
  gameOver: false,
  victoryShown: false,
  uiOpen: false,
  noiseTimer: 0,
  noiseLevel: 0,
  time: 0,
  lastAlertMsg: -99,
};

let ui;

function canControl() {
  return (
    game.started &&
    !game.paused &&
    !game.gameOver &&
    !game.victoryShown &&
    !ui.tradeOpen &&
    !ui.helpOpen
  );
}

const input = new Input(canvas, {
  attack: () => {
    if (canControl()) performAttack();
  },
  keyDown: handleKeyDown,
  keyUp: handleKeyUp,
  lockChange: (locked) => {
    if (
      !locked &&
      game.started &&
      !game.gameOver &&
      !game.victoryShown &&
      !game.paused &&
      !game.uiOpen
    ) {
      pauseGame();
    }
  },
});

ui = new UI({
  start: startGame,
  resume: resumeGame,
  restart: () => window.location.reload(),
  continueGame: continueGame,
  sell: sellLoot,
  fine: payFine,
  buy: buyUpgrade,
  closeTrade: closeTrade,
});

canvas.addEventListener("click", () => {
  if (canControl() && !input.locked) input.requestLock();
});

function startGame() {
  audio.init();
  audio.ui();
  game.started = true;
  game.paused = false;
  document.body.classList.add("playing");
  ui.hideStart();
  ui.message("Мардо: «Караван стоит на северной стоянке. Иди на восток по дороге, потом на север.»");
  input.requestLock();
}

function pauseGame() {
  game.paused = true;
  input.clear();
  ui.setPrompt(null);
  ui.setProgress(null);
  ui.showPause();
}

function resumeGame() {
  if (game.gameOver) return;
  game.paused = false;
  ui.hidePause();
  input.requestLock();
}

function continueGame() {
  ui.closeTrade();
  ui.hideHelp();
  ui.hideEnd();
  game.uiOpen = false;
  game.victoryShown = false;
  game.paused = false;
  input.requestLock();
}

function handleKeyDown(code) {
  if (code === "KeyI" && game.started && !game.gameOver && !ui.tradeOpen) {
    if (ui.helpOpen) closeHelp();
    else openHelp();
    return;
  }
  if (code === "Escape") {
    if (ui.tradeOpen) closeTrade();
    else if (ui.helpOpen) closeHelp();
    return;
  }
  if (code === "KeyR" && game.gameOver) {
    window.location.reload();
    return;
  }
  if (code === "Space" && canControl()) {
    performAttack();
    return;
  }
  if (code === "KeyE" && canControl()) {
    const near = nearestInteraction(world, player);
    if (near && near.type === "merchant") openTrade();
  }
}

function handleKeyUp(code) {
  if (code === "KeyE") {
    game.stealing = false;
    game.stealProgress = 0;
  }
}

function openHelp() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.showHelp();
  ui.setPrompt(null);
  ui.setProgress(null);
}

function closeHelp() {
  ui.hideHelp();
  game.uiOpen = false;
  input.requestLock();
}

function openTrade() {
  game.uiOpen = true;
  input.clear();
  input.exitLock();
  ui.setPrompt(null);
  ui.setProgress(null);
  ui.openTrade(game);
  audio.ui();
}

function closeTrade() {
  ui.closeTrade();
  game.uiOpen = false;
  input.requestLock();
}

function sellLoot() {
  if (!ui.tradeOpen) return;
  const value = totalValue(game.inventory);
  if (value <= 0) return;

  const earned = Math.round(value * sellMultiplier(game.upgrades));
  game.gold += earned;
  game.totalSold += earned;
  game.inventory.items = [];
  audio.coin();
  ui.message(`Мардо отсчитал ${earned} зм.`);

  if (world.wagonLooted && !game.lootSoldForTier) {
    game.lootSoldForTier = true;
    game.pendingCaravan = true;
    game.caravanTimer = 12;
    ui.message("Слух: на северной дороге скоро появится новый караван.");
  }

  ui.renderTrade(game);
  checkVictory();
}

function buyUpgrade(id) {
  if (!ui.tradeOpen) return;
  const result = purchase(game.gold, game.upgrades, id);
  if (!result) return;
  game.gold = result.gold;
  game.upgrades = result.upgrades;
  audio.coin();
  ui.message(`Куплено: ${UPGRADES[id].name}, уровень ${game.upgrades[id]}.`);
  ui.renderTrade(game);
}

function payFine() {
  if (!ui.tradeOpen) return;
  const cost = fineFor(game.wanted);
  if (cost <= 0) return;
  if (game.gold < cost) {
    ui.message("Не хватает золота на штраф.");
    return;
  }
  game.gold -= cost;
  game.wanted = 0;
  const guard = world.villageGuard;
  guard.state = "idle";
  guard.suspicion = 0;
  guard.alerted = false;
  audio.coin();
  ui.message("Штраф уплачен. Стража больше не ищет вас.");
  ui.renderTrade(game);
}

function lootWagon() {
  const tier = world.tier;
  world.wagonLooted = true;

  const witnessed = world.campGuards.some(
    (a) => a.alive && (a.state === "chase" || a.suspicion > 0.4)
  );

  const coin = 18 + tier * 8;
  game.gold += coin;

  const items = rollLoot(tier, Math.random, 2 + tier);
  let taken = 0;
  for (const item of items) {
    if (addItem(game.inventory, item)) taken++;
  }

  if (witnessed) {
    game.wanted = Math.min(5, Math.max(game.wanted, 1));
    ui.message("Стража видела ограбление! Розыск +1.");
  }

  if (taken < items.length) {
    ui.message(`Вы вынесли ${taken} из ${items.length} тюков: остальное не поместилось.`);
  } else {
    ui.message(`Вы вынесли из фургона ${taken} тюка и ${coin} зм.`);
  }

  audio.coin();
  game.stealing = false;
  game.stealProgress = 0;
  checkVictory();
}

function performAttack() {
  if (player.attackCd > 0 || player.dead) return;

  player.attackCd = attackCooldown(game.upgrades.sword);
  player.swingT = 0.34;
  audio.swing();
  game.noiseTimer = 0.5;

  let target = null;
  let bestDist = Infinity;
  for (const actor of world.actors) {
    if (!actor.alive || actor.kind === "merchant") continue;
    if (
      inMeleeCone(
        player.x,
        player.y,
        player.dirX,
        player.dirY,
        actor.x,
        actor.y,
        1.95,
        0.4
      )
    ) {
      const dist = Math.hypot(actor.x - player.x, actor.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        target = actor;
      }
    }
  }

  if (!target) {
    alertNoise(player.x, player.y, 7);
    return;
  }

  const dmg = damageRoll(12 + game.upgrades.sword * 5);
  target.hp -= dmg;
  ui.flashHit();
  audio.hit();
  alertNoise(player.x, player.y, 9);

  if (target.hp <= 0) {
    killActor(target);
    return;
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
    game.wanted = Math.min(5, game.wanted + 1);
  }

  const label = target.kind === "driver" ? "возницу" : "стражника";
  ui.message(`Вы ранили ${label} (-${dmg}).`);
}

function alertNoise(x, y, radius) {
  for (const actor of world.actors) {
    if (!actor.alive) continue;
    if (actor.kind !== "guard" && actor.kind !== "driver") continue;
    const dist = Math.hypot(actor.x - x, actor.y - y);
    if (dist <= radius) {
      if (actor.kind === "driver") {
        actor.state = "flee";
        actor.suspicion = 1;
      } else if (actor.state !== "chase") {
        actor.state = "chase";
        actor.suspicion = 1.2;
        actor.alerted = true;
        actor.lostTimer = 0;
      }
    }
  }
}

function killActor(actor) {
  actor.alive = false;
  actor.hp = 0;
  actor.state = "dead";

  const drop = 6 + world.tier * 3 + Math.floor(Math.random() * 6);
  game.gold += drop;
  game.wanted = Math.min(5, game.wanted + 1);
  audio.coin();

  const label =
    actor.kind === "driver"
      ? "возницу"
      : actor.kind === "village_guard"
        ? "городского стражника"
        : "стражника";
  ui.message(`Вы убили ${label}. Добыча: ${drop} зм. Розыск +1.`);
  checkVictory();
}

function damagePlayer(amount, source) {
  if (player.dead || game.gameOver) return;

  const dmg = applyArmor(damageRoll(amount), game.upgrades.armor);
  player.health = Math.max(0, player.health - dmg);
  player.hurtFlash = 1;
  audio.hurt();

  const label =
    source?.kind === "village_guard"
      ? "Городской стражник"
      : source?.kind === "driver"
        ? "Возница"
        : "Стражник";
  ui.message(`${label} ранил вас (-${dmg}).`);

  if (player.health <= 0) die();
}

function die() {
  player.dead = true;
  game.gameOver = true;
  game.paused = false;
  input.exitLock();
  ui.closeTrade();
  ui.hideHelp();
  game.uiOpen = false;
  ui.setPrompt(null);
  ui.setProgress(null);
  audio.death();
  ui.showEnd(
    "Вы погибли",
    "Дорога оказалась сильнее. Стража и караванщики не прощают ошибок. Попробуйте другой подход — или более крепкий меч.",
    false
  );
}

function checkVictory() {
  if (game.victoryShown) return;
  if (game.gold >= 300 && game.totalSold > 0) {
    game.victoryShown = true;
    game.paused = true;
    input.exitLock();
    ui.closeTrade();
    ui.hideHelp();
    game.uiOpen = false;
    ui.setPrompt(null);
    ui.setProgress(null);
    audio.victory();
    ui.showEnd(
      "Демо пройдено",
      `Вы собрали ${game.gold} золотых на чужих караванах. Мардо довольно потирает руки, а дорога ждёт новых путников.`,
      true
    );
  }
}

game.damagePlayer = damagePlayer;

game.onGuardAlert = (actor) => {
  if (game.time - game.lastAlertMsg > 3) {
    game.lastAlertMsg = game.time;
    ui.message("Вас заметили!");
  }
  audio.alert();
};

function objectiveText() {
  let line;
  if (!world.wagonLooted) {
    line = "Ограбьте караван на северной стоянке";
  } else if (game.inventory.items.length > 0) {
    line = "Продайте добычу Мардо в деревне";
  } else if (game.pendingCaravan) {
    line = `Новый караван через ${Math.max(1, Math.ceil(game.caravanTimer))} с`;
  } else {
    line = "Демо пройдено — можно продолжать";
  }
  return `${line}\nЦель демо: 300 зм. · продано на ${game.totalSold} зм.`;
}

function updateGame(dt) {
  game.time += dt;

  const mouse = input.consumeMouse();
  if (input.locked && mouse.dx !== 0) player.turn(mouse.dx * 0.0022);
  const turnAxis = (input.isDown("ArrowRight") ? 1 : 0) - (input.isDown("ArrowLeft") ? 1 : 0);
  if (turnAxis !== 0) player.turn(turnAxis * 1.9 * dt);

  game.noiseTimer = Math.max(0, game.noiseTimer - dt);
  game.noiseLevel = Math.max(game.stealing ? 1 : 0, game.noiseTimer > 0 ? 0.9 : 0);

  let near = nearestInteraction(world, player);
  const wagonNear = near && near.type === "wagon";

  if (wagonNear && input.isDown("KeyE") && !game.stealing) {
    game.stealing = true;
    game.stealProgress = 0;
    audio.steal();
  }

  if (game.stealing) {
    if (!input.isDown("KeyE") || !wagonNear) {
      game.stealing = false;
      game.stealProgress = 0;
    } else {
      game.stealProgress += dt / stealTime(game.upgrades.lockpick);
      if (game.stealProgress >= 1) lootWagon();
    }
  }

  if (!game.stealing) {
    player.update(world, input, dt, game, audio);
  }

  updateActors(game, dt);

  near = nearestInteraction(world, player);
  if (game.stealing) {
    ui.setPrompt("Обыскиваете фургон… не дайте страже заметить вас");
    ui.setProgress(game.stealProgress);
  } else if (near && near.type === "wagon") {
    ui.setPrompt(near.label);
    ui.setProgress(null);
  } else if (near && near.type === "merchant") {
    ui.setPrompt(near.label);
    ui.setProgress(null);
  } else {
    ui.setPrompt(null);
    ui.setProgress(null);
  }

  if (game.pendingCaravan) {
    game.caravanTimer -= dt;
    if (game.caravanTimer <= 0) {
      const distToWagon = Math.hypot(player.x - world.wagon.x, player.y - world.wagon.y);
      if (distToWagon < 13) {
        game.caravanTimer = 3;
      } else {
        spawnCamp(world, world.tier + 1);
        game.pendingCaravan = false;
        game.lootSoldForTier = false;
        ui.message("На северной дороге замечен новый караван — охраны больше.");
      }
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (canControl()) {
    updateGame(dt);
  } else {
    input.consumeMouse();
  }

  renderer.render({
    world,
    player,
    time: game.time,
    hurtFlash: player.hurtFlash,
    started: game.started,
  });
  ui.update(game);
  ui.setObjective(objectiveText());

  requestAnimationFrame(frame);
}

if (new URLSearchParams(window.location.search).has("debug")) {
  window.__corovans = { game, ui, input, player, world, renderer };
}

requestAnimationFrame(frame);
