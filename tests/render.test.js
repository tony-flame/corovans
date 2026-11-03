import test from "node:test";
import assert from "node:assert/strict";

// ── Почему этот файл существует ─────────────────────────────────────
// `raycaster.js` не был покрыт вообще: он требует canvas, а в Node его нет.
// Из-за этого 298 зелёных тестов ничего не значили для рендеринга — и
// игра умерла на `trackAlpha is not defined`: drawTracks звал функцию,
// которую забыли импортировать. Логические тесты такое не ловят в принципе,
// а `node --check` видит только синтаксис.
//
// Здесь поднимается минимальная заглушка DOM, и Renderer вызывается
// по-настоящему. Полной картинки не получается — но любая опечатка в
// импорте, любое обращение к несуществующему методу и любой NaN в
// геометрии сразу дают исключение.

const W = 1280;
const H = 720;

function makeFakeCtx() {
  const calls = [];
  const record = (name) => (...args) => {
    calls.push({ name, args });
    if (name === "createImageData") {
      return { width: args[0], height: args[1], data: new Uint8ClampedArray(args[0] * args[1] * 4) };
    }
    if (name === "getImageData") {
      const [x, y, w, h] = args;
      return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    }
    if (name === "createLinearGradient" || name === "createRadialGradient") {
      return { addColorStop: () => {} };
    }
    if (name === "measureText") return { width: 10 };
    return undefined;
  };

  const ctx = {
    calls,
    canvas: null,
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    filter: "none",
  };

  const methods = [
    "fillRect", "strokeRect", "clearRect", "beginPath", "closePath",
    "moveTo", "lineTo", "arc", "ellipse", "rect", "fill", "stroke",
    "save", "restore", "translate", "rotate", "scale", "drawImage",
    "putImageData", "createImageData", "getImageData", "fillText",
    "strokeText", "measureText", "createLinearGradient", "createRadialGradient",
    "setTransform", "resetTransform", "clip", "quadraticCurveTo",
    "bezierCurveTo", "arcTo", "roundRect",
  ];
  for (const name of methods) ctx[name] = record(name);
  return ctx;
}

function installFakeDom() {
  const created = [];

  function makeCanvas() {
    const ctx = makeFakeCtx();
    const canvas = {
      width: 1,
      height: 1,
      style: {},
      getContext: () => ctx,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    ctx.canvas = canvas;
    created.push(canvas);
    return canvas;
  }

  const doc = {
    createElement(tag) {
      if (tag === "canvas") return makeCanvas();
      // Прочие элементы (div и т.п.) спрайты не создают, но пусть будет.
      return { style: {}, appendChild: () => {}, addEventListener: () => {} };
    },
    getElementById: () => null,
    addEventListener: () => {},
  };

  const win = {
    devicePixelRatio: 1,
    innerWidth: W,
    innerHeight: H,
    addEventListener: () => {},
  };

  const prevDoc = globalThis.document;
  const prevWin = globalThis.window;
  globalThis.document = doc;
  globalThis.window = win;

  return {
    restore() {
      globalThis.document = prevDoc;
      globalThis.window = prevWin;
    },
    created,
  };
}

// Renderer поднимается один раз на весь файл: buildTextures/buildSprites —
// самая дорогая часть, и повторять её на каждый тест незачем.
const dom = installFakeDom();
const { Renderer } = await import("../src/raycaster.js");
const { createWorld, SPAWN } = await import("../src/world.js");
const { Player } = await import("../src/player.js");

const canvasEl = { width: W, height: H, style: {}, getContext: () => makeFakeCtx() };
const renderer = new Renderer(canvasEl);
const world = createWorld();
const player = new Player(SPAWN);

function baseState(extra = {}) {
  return {
    world,
    player,
    time: 10,
    hurtFlash: 0,
    started: true,
    light: "day",
    lightmap: null,
    weather: null,
    mounted: false,
    seed: 1234,
    tracks: [],
    suspicionSource: () => 0,
    showSuspicion: false,
    ...extra,
  };
}

test("рендер: кадр собирается без исключения", () => {
  assert.doesNotThrow(() => renderer.render(baseState()));
});

test("рендер: непустые следы не роняют кадр", () => {
  // ЭТО регрессия на настоящий баг: drawTracks звал trackAlpha, которая
  // не была импортирована. Пустой массив следов проходил мимо цикла,
  // поэтому баг и жил до первых шагов игрока по земле.
  const tracks = [
    { x: player.x + 0.8, y: player.y, age: 0.1 },
    { x: player.x + 1.6, y: player.y, age: 1.2 },
    { x: player.x + 2.4, y: player.y, age: 8.9 },
  ];
  assert.doesNotThrow(() => renderer.render(baseState({ tracks })));
});

test("рендер: следы на всех стадиях жизни не роняют кадр", () => {
  // Включая просроченные и с отсутствующим age: trackAlpha не должна
  // падать ни на null, ни на undefined.
  const tracks = [
    { x: player.x + 1, y: player.y, age: 0 },
    { x: player.x + 2, y: player.y, age: 99 },
    { x: player.x + 3, y: player.y },
    { x: player.x + 4, y: player.y, age: null },
  ];
  assert.doesNotThrow(() => renderer.render(baseState({ tracks })));
});

test("рендер: все фазы суток и все режимы погоды", () => {
  for (const light of ["dawn", "day", "dusk", "night"]) {
    for (const weather of [
      null,
      { intensity: 0.9, wind: 0.3, raining: true, kind: "rain", targetKind: "rain" },
      { intensity: 0.9, wind: 0.1, raining: false, kind: "snow", targetKind: "snow" },
    ]) {
      assert.doesNotThrow(
        () => renderer.render(baseState({ light, weather })),
        `фаза ${light}, погода ${weather ? weather.kind : "нет"}`
      );
    }
  }
});

test("рендер: наклон камеры до пределов", () => {
  const origin = player.pitch;
  for (const pitch of [0, 159, -159, 80, -80]) {
    player.pitch = pitch;
    assert.doesNotThrow(() => renderer.render(baseState()), `pitch=${pitch}`);
  }
  player.pitch = origin;
});

test("рендер: камера в ключевых точках карты и на повороте 180°", () => {
  const { x, y, angle } = player;
  const spots = [
    ["спавн", 52.5, 132.5],
    ["площадь", 62, 128],
    ["рынок", 116, 140],
    ["лес", 85, 80],
    ["дорога", 100, 126.5],
    ["стоянка", 142, 68],
    ["собор", 165, 118],
  ];
  const tracks = [{ x: 52, y: 132, age: 0.5 }];

  for (const [name, sx, sy] of spots) {
    player.x = sx;
    player.y = sy;
    for (let deg = 0; deg < 360; deg += 45) {
      player.setAngle((deg * Math.PI) / 180);
      assert.doesNotThrow(
        () => renderer.render(baseState({ tracks })),
        `${name}, ${deg}°`
      );
    }
  }

  player.x = x;
  player.y = y;
  player.setAngle(angle);
});

test("рендер: полный оборот не даёт NaN в направлении", () => {
  for (let deg = 0; deg <= 720; deg += 7) {
    player.setAngle((deg * Math.PI) / 180);
    assert.ok(Number.isFinite(player.dirX), `dirX NaN на ${deg}°`);
    assert.ok(Number.isFinite(player.dirY), `dirY NaN на ${deg}°`);
    assert.ok(Number.isFinite(player.planeX), `planeX NaN на ${deg}°`);
    assert.ok(Number.isFinite(player.planeY), `planeY NaN на ${deg}°`);
    // Направление всегда единичное: иначе лучи «растягиваются».
    assert.ok(Math.abs(Math.hypot(player.dirX, player.dirY) - 1) < 1e-9, `длина dir ≠ 1 на ${deg}°`);
  }
});

test("рендер: горизонт и zBuffer остаются числами", () => {
  player.setAngle(Math.PI); // ровно 180°, sin ≈ 1.2e-16
  renderer.render(baseState({ tracks: [{ x: 53, y: 132, age: 0 }] }));

  for (let i = 0; i < renderer.zBuffer.length; i++) {
    if (!Number.isFinite(renderer.zBuffer[i])) {
      assert.fail(`zBuffer[${i}] = ${renderer.zBuffer[i]}`);
    }
  }
});

test("рендер: ctx.filter не используется (он уводит Chrome в software)", () => {
  // Правило из AGENTS.md: спрайты затемняются через shadedSprite, а не filter.
  const ctx = canvasEl.getContext("2d");
  renderer.render(baseState());
  const filterWrites = ctx.calls.filter((c) => c.name === "filter");
  assert.equal(filterWrites.length, 0);
});

// Заглушку снимаем ПОСЛЕ тестов, а не на верхнем уровне модуля:
// node:test запускает тесты уже после вычисления файла, и restore()
// в конце модуля срабатывал раньше первого теста.
test.after(() => dom.restore());
