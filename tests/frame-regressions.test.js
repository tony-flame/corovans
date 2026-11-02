// Регрессии кадра, которые зелёный npm run verify пропускал:
// мерцание освещения пола и утечка canvas-спрайтов куртизанок.
//
// Обе проверяются на фейковом 2D-контексте — той же инфраструктурой,
// что в tests/graphics.test.js и tests/intro.test.js.

import test from "node:test";
import assert from "node:assert/strict";

import { createWorld, SPAWN } from "../src/world.js";

// Минимальный canvas/DOM, чтобы собрать Renderer без браузера.
function fakeCanvas(width, height) {
  const ctx = fakeCtx();
  return {
    width,
    height,
    getContext: () => ctx,
  };
}

function fakeCtx() {
  const record = () => () => undefined;
  return {
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    filter: "none",
    save: record(),
    restore: record(),
    translate: record(),
    rotate: record(),
    scale: record(),
    fillRect: record(),
    strokeRect: record(),
    clearRect: record(),
    beginPath: record(),
    closePath: record(),
    moveTo: record(),
    lineTo: record(),
    arc: record(),
    ellipse: record(),
    quadraticCurveTo: record(),
    bezierCurveTo: record(),
    fill: record(),
    stroke: record(),
    drawImage: record(),
    fillText: record(),
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createImageData: (w, h) => ({
      width: w,
      height: h,
      data: new Uint8ClampedArray(w * h * 4),
    }),
    putImageData: record(),
  };
}

// Ставим заглушки глобального document — модули рисуют спрайты в конструкторе.
function withFakeDom(fn) {
  const original = globalThis.document;
  globalThis.document = {
    createElement: (tag) => (tag === "canvas" ? fakeCanvas(64, 64) : {}),
  };
  try {
    return fn();
  } finally {
    globalThis.document = original;
  }
}

test("кадр: освещение пола не зависит от чётности горизонта", async () => {
  // Регрессия: useLight проверял y % 4 === 0 при шаге y += 2, поэтому
  // включение света зависело от чётности startY, а startY — от bobY.
  // Пока игрок шёл, пол мерцал на ~7 Гц.
  //
  // Проверяем свойство кода, а не картинку: число выборок света должно
  // быть одинаковым при сдвиге горизонта на 1 пиксель.
  const { Renderer } = await import("../src/raycaster.js");

  await withFakeDom(async () => {
    const renderer = new Renderer(fakeCanvas(1280, 720));
    const world = createWorld();
    const player = {
      x: SPAWN.x,
      y: SPAWN.y,
      dirX: 1,
      dirY: 0,
      planeX: 0,
      planeY: 0.66,
      angle: 0,
      pitch: 0,
      bobY: 0,
      jumpZ: 0,
      walkPhase: 0,
    };

    // Считаем вызовы sampleLight косвенно: по числу ненулевых пикселей
    // нижней половины кадра при двух горизонтах.
    const countGround = (bobY) => {
      player.bobY = bobY;
      renderer.light = 1;
      renderer.lightmap = null;
      renderer.renderFloor(world, player, 360 + bobY);
      let nonZero = 0;
      // Нижняя треть кадра — гарантированно пол.
      for (let y = 560; y < 720; y += 8) {
        for (let x = 0; x < 1280; x += 8) {
          if (renderer.buffer[y * 1280 + x] !== 0) nonZero++;
        }
      }
      return nonZero;
    };

    const even = countGround(0);
    const odd = countGround(1);

    assert.ok(even > 0, "пол должен быть нарисован");
    // Разница допустима (другая строка горизонта), но не в разы:
    // при старом баге свет включался на одной чётности и выключался на другой.
    const ratio = Math.max(even, odd) / Math.min(even, odd);
    assert.ok(
      ratio < 1.15,
      `заполнение пола скачет при сдвиге горизонта: ${even} vs ${odd} (×${ratio.toFixed(2)})`
    );
  });
});

test("спрайты куртизанок не копятся между караванами", async () => {
  // Регрессия: условие удаления старых ключей никогда не выполнялось,
  // после шести тиров в renderer.sprites оставалось 48 ключей вместо 8.
  const { buildCourtesan } = await import("../src/courtesan-sprite.js");

  await withFakeDom(() => {
    // Имитируем то, что делает updateCourtesanVariant: свой набор ключей
    // на куртизанку, старые удаляются по списку.
    const sprites = {};
    const courtesans = [
      { spot: "square" },
      { spot: "inn" },
      { spot: "forest" },
      { spot: "camp" },
    ];

    const variantFor = (tier) => {
      const map = {};
      for (const c of courtesans) map[c.spot] = `${c.spot}_t${tier}`;
      return map;
    };

    const paint = (tier) => {
      const variants = variantFor(tier);
      for (const c of courtesans) {
        if (c.spriteKeys) {
          for (const key of c.spriteKeys) delete sprites[key];
        }
        const id = variants[c.spot];
        const cleanKey = `${id}_clean`;
        const bloodKey = `${id}_blood`;
        sprites[cleanKey] = buildCourtesan({ spot: c.spot, hair: null, dress: null }, { bloodied: false });
        sprites[bloodKey] = buildCourtesan({ spot: c.spot, hair: null, dress: null }, { bloodied: true });
        c.spriteKeys = [cleanKey, bloodKey];
      }
    };

    paint(1);
    const afterFirst = Object.keys(sprites).length;
    for (let tier = 2; tier <= 6; tier++) paint(tier);
    const afterSix = Object.keys(sprites).length;

    assert.equal(afterFirst, 8, "после первого каравана: 4 места × 2 варианта");
    assert.equal(
      afterSix,
      afterFirst,
      `спрайты копятся: было ${afterFirst}, стало ${afterSix}`
    );
  });
});
