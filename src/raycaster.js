import { buildTextures, TEX_SIZE } from "./textures.js";
import { buildSprites } from "./sprites.js";
import { MAP_W, MAP_H, TILE } from "./world.js";
import { castRay } from "./ray.js";
import { quantize, quantizeFast, makeQuantTables, murk, murkInto, wallOcclusion, applyGrain, vignette, clampChannel, grain, MURK_TINT } from "./dither.js";
import { sampleLight } from "./lighting.js";
import { dropCount, dropPosition, dropLength, skyTint, snowflakePosition, snowflakeCount } from "./weather.js";

const SCREEN_W = 1280;
const SCREEN_H = 720;
const FOV_PLANE = 0.66;
const MAX_DIST = 40;

// Дальше этого спрайт не рисуется: туман его уже съел, а работа настоящая.
// В лесу без отсечки проходило 475 спрайтов из 496 — каждый с filter.
const SPRITE_MAX_DIST = 26;

// Пиксели интерфейса заданы в «старых» единицах 640×360 и умножаются
// на UI_SCALE. Так оружие, полосы подозрения и голова лошади остаются
// того же размера относительно экрана, а не превращаются в игрушки.
const UI_SCALE = SCREEN_H / 360;

// Рост человека на экране: SCREEN_H / depth * HUMAN_SCALE.
// 1.16 при глубине 4 даёт ~104 px — крупная фигура в паре шагов,
// но не во весь экран. Все люди мира держатся этой линейки.
const HUMAN_SCALE = 1.16;

// Уровней на канал: меньше — грубее и «аутентичнее», больше — чище.
const DITHER_LEVELS = 16;
// Доля высоты стены, занятая крышей-фронтоном.
const ROOF_HEIGHT = 0.22;

// Подмес «сумрака» в предвычисленном виде: горячий цикл пола не должен
// вызывать murk() на каждый пиксель.
const MURK_AMOUNT = 0.16;
const MURK_K = 1 - MURK_AMOUNT;
const MURK_R = MURK_TINT[0] * MURK_AMOUNT;
const MURK_G = MURK_TINT[1] * MURK_AMOUNT;
const MURK_B = MURK_TINT[2] * MURK_AMOUNT;

// Освещённость по фазам суток: множитель к цвету сцены.
const LIGHT_LEVELS = { dawn: 0.82, day: 1, dusk: 0.72, night: 0.45 };

function pack(r, g, b) {
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.width = SCREEN_W;
    this.height = SCREEN_H;
    this.imageData = this.ctx.createImageData(SCREEN_W, SCREEN_H);
    this.buffer = new Uint32Array(this.imageData.data.buffer);
    this.zBuffer = new Float32Array(SCREEN_W);
    this.textures = buildTextures();
    this.sprites = buildSprites();
    this.fog = { r: 58, g: 56, b: 48 };
    this.light = 1;
    this.lightmap = null;
    this.ditherStrength = 0.28;
    // Таблицы дизера и константы подмеса: в горячем цикле пола нельзя
    // считать их на каждый пиксель.
    this.qt = makeQuantTables(DITHER_LEVELS, this.ditherStrength);
    this.murkOut = [0, 0, 0];
  }

  // Финальный проход: виньетка и зерно. Без этого картинка «слишком чистая».
  // Виньетка и зерно зависят только от координат, поэтому обе таблицы
  // считаются один раз: раньше в кадре было 921600 Math.sqrt и столько же
  // хешей зерна — на 720p это больше тридцати миллисекунд.
  buildVignetteTable() {
    if (this.vignetteTable && this.vignetteSize === SCREEN_W * SCREEN_H) return;
    const size = SCREEN_W * SCREEN_H;
    const vig = new Float32Array(size);
    const grainTable = new Float32Array(size);
    for (let y = 0; y < SCREEN_H; y++) {
      const row = y * SCREEN_W;
      for (let x = 0; x < SCREEN_W; x++) {
        vig[row + x] = vignette(x, y, SCREEN_W, SCREEN_H, 0.2);
        grainTable[row + x] = grain(x, y, 0, 0.5);
      }
    }
    this.vignetteTable = vig;
    this.grainTable = grainTable;
    this.vignetteSize = size;
  }

  finishFrame() {
    this.buildVignetteTable();
    const data = this.imageData.data;
    const vig = this.vignetteTable;
    const gr = this.grainTable;

    // Блок 2×2: виньетка и зерно меняются плавно, шаг в два пикселя
    // не виден. Четыре пикселя обрабатываются одним проходом.
    for (let y = 0; y < SCREEN_H; y += 2) {
      const row = y * SCREEN_W;
      const row2 = y + 1 < SCREEN_H ? row + SCREEN_W : row;
      for (let x = 0; x < SCREEN_W; x += 2) {
        const idx = row + x;
        const v = vig[idx];
        const g = gr[idx];
        const i = idx << 2;
        let r = data[i] * v + g;
        let gg = data[i + 1] * v + g;
        let b = data[i + 2] * v + g;
        r = r < 0 ? 0 : r > 255 ? 255 : r;
        gg = gg < 0 ? 0 : gg > 255 ? 255 : gg;
        b = b < 0 ? 0 : b > 255 ? 255 : b;
        data[i] = r;
        data[i + 1] = gg;
        data[i + 2] = b;

        // сосед справа
        const i1 = i + 4;
        if (x + 1 < SCREEN_W) {
          data[i1] = r;
          data[i1 + 1] = gg;
          data[i1 + 2] = b;
        }
        // соседи снизу
        if (row2 !== row) {
          const i2 = (row2 + x) << 2;
          data[i2] = r;
          data[i2 + 1] = gg;
          data[i2 + 2] = b;
          if (x + 1 < SCREEN_W) {
            data[i2 + 4] = r;
            data[i2 + 5] = gg;
            data[i2 + 6] = b;
          }
        }
      }
    }
  }

  // Осадки: дождь штрихами, снег точками. Физика разная, поэтому ветки разные.
  drawRain(weather, time, horizon) {
    if (!weather || weather.intensity <= 0.01) return;
    const ctx = this.ctx;
    const tint = skyTint(weather);

    if (tint.cold > 0.05) {
      this.drawSnow(weather, time, tint);
      return;
    }

    const count = dropCount(weather, SCREEN_W);

    ctx.save();
    ctx.strokeStyle = `rgba(190, 205, 215, ${0.18 + weather.intensity * 0.3})`;
    ctx.lineWidth = (weather.intensity > 0.7 ? 1.4 : 1) * UI_SCALE;
    ctx.beginPath();

    for (let i = 0; i < count; i++) {
      const drop = dropPosition(i, time, weather.wind, SCREEN_W, SCREEN_H, UI_SCALE);
      const len = dropLength(weather, drop.speedY);
      // Капля летит по ветру: рисуем отрезок вдоль направления падения.
      const dx = (drop.speedX / drop.speedY) * len;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x + dx, drop.y + len);
    }
    ctx.stroke();
    ctx.restore();

    // Мокрая дымка у горизонта.
    if (tint.grey > 0.02) {
      ctx.save();
      ctx.fillStyle = `rgba(150, 160, 168, ${tint.grey * 0.28})`;
      ctx.fillRect(0, Math.max(0, horizon - 40 * UI_SCALE), SCREEN_W, 80 * UI_SCALE);
      ctx.restore();
    }
  }

  drawSnow(weather, time, tint) {
    const ctx = this.ctx;
    const count = snowflakeCount(weather, SCREEN_W);
    const i = weather.intensity;

    ctx.save();
    ctx.fillStyle = `rgba(226, 236, 245, ${0.35 + i * 0.45})`;

    for (let k = 0; k < count; k++) {
      const flake = snowflakePosition(k, time, weather.wind, SCREEN_W, SCREEN_H);
      // Ближние снежинки крупнее: два размера вместо одного.
      const size = (k % 3 === 0 ? 2 : 1) * UI_SCALE;
      ctx.fillRect(flake.x, flake.y, size, size);
    }
    ctx.restore();

    // Холодная дымка.
    ctx.save();
    ctx.fillStyle = `rgba(200, 214, 228, ${tint.cold * 0.16})`;
    ctx.fillRect(0, Math.max(0, tint.dim * SCREEN_H * 0.2), SCREEN_W, SCREEN_H);
    ctx.restore();
  }

  render(state) {
    const { world, player, time, hurtFlash = 0, light = "day", lightmap = null, weather = null } = state;
    // Прыжок поднимает камеру, наклон сдвигает горизонт (shear), а не поворачивает.
    this.jumpZ = player.jumpZ || 0;
    // Верхом сдвигаем горизонт: сидишь выше, земля уходит вниз.
    const lift = state.mounted ? 20 : 0;
    const horizon = SCREEN_H * 0.5 + player.bobY - (player.pitch || 0) - lift;
    this.light = LIGHT_LEVELS[light] !== undefined ? LIGHT_LEVELS[light] : 1;
    this.lightmap = lightmap;
    this.time = time;
    this.renderSky(player, horizon, weather);
    this.renderFloor(world, player, horizon);
    this.renderWalls(world, player, horizon);
    this.finishFrame();

    this.ctx.putImageData(this.imageData, 0, 0);
    this.drawSprites(world, player, horizon, time, state);
    this.drawRain(state.weather, time, horizon);
    if (state.started) {
      // Верхом вместо меча в кадре голова лошади.
      if (state.mounted) this.drawHorseHead(time, player);
      this.drawWeapon(player, time);
    }

    if (hurtFlash > 0) {
      this.ctx.fillStyle = `rgba(150, 20, 12, ${Math.min(0.35, hurtFlash * 0.35)})`;
      this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
    if (player.health <= 30) {
      const pulse = 0.08 + Math.sin(time * 4) * 0.04;
      this.ctx.fillStyle = `rgba(120, 10, 6, ${pulse})`;
      this.ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    }
  }

  renderSky(player, horizon, weather = null) {
    const buf = this.buffer;
    const tint = skyTint(weather);
    const dim = tint.dim;
    const grey = tint.grey;

    // Дождь делает небо серее и темнее.
    const top = [
      24 * dim + grey * 70,
      31 * dim + grey * 74,
      46 * dim + grey * 78,
    ];
    const bottom = [
      132 * dim + grey * 96,
      116 * dim + grey * 100,
      88 * dim + grey * 104,
    ];
    const h = Math.max(1, Math.floor(horizon));

    for (let y = 0; y < h; y++) {
      const t = Math.pow(y / h, 1.4);
      const r = (top[0] + (bottom[0] - top[0]) * t) | 0;
      const g = (top[1] + (bottom[1] - top[1]) * t) | 0;
      const b = (top[2] + (bottom[2] - top[2]) * t) | 0;
      const c = pack(r, g, b);
      const row = y * SCREEN_W;
      for (let x = 0; x < SCREEN_W; x++) buf[row + x] = c;
    }

    // Дальние холмы, привязанные к мировому углу.
    // pack() считался в самом внутреннем цикле — почти полмиллиона вызовов
    // на кадр. Цвета постоянные, выносим их наружу и заливаем строками.
    const hillFar = pack(43, 52, 43);
    const hillNear = pack(31, 41, 32);
    const tanHalf = FOV_PLANE;
    for (let x = 0; x < SCREEN_W; x++) {
      const cameraX = (2 * x) / SCREEN_W - 1;
      const angle = player.angle + Math.atan(cameraX * tanHalf);
      const h1 = 10 + Math.sin(angle * 2.3) * 5 + Math.sin(angle * 5.7 + 1) * 2.5;
      const h2 = 5 + Math.sin(angle * 3.7 + 2) * 3 + Math.sin(angle * 9.1) * 1.5;
      const start1 = Math.max(0, Math.floor(horizon - h1));
      const start2 = Math.max(0, Math.floor(horizon - h2));
      for (let y = start1; y < h; y++) buf[y * SCREEN_W + x] = hillFar;
      for (let y = start2; y < h; y++) buf[y * SCREEN_W + x] = hillNear;
    }
  }

  renderFloor(world, player, horizon) {
    const buf = this.buffer;
    const dirX = player.dirX;
    const dirY = player.dirY;
    const planeX = player.planeX;
    const planeY = player.planeY;
    const rayDirX0 = dirX - planeX;
    const rayDirY0 = dirY - planeY;
    const rayDirX1 = dirX + planeX;
    const rayDirY1 = dirY + planeY;
    const posZ = 0.5 * SCREEN_H + this.jumpZ;
    const floors = this.textures.floors;
    const map = world.map;

    const startY = Math.max(0, Math.floor(horizon) + 1);
    // Свет раз в 8 пикселей по X и раз в 4 по Y: 1/32 выборок.
    // Он мягкий и низкочастотный, ступенек не видно, а вызовов в 32 раза меньше.
    const LIGHT_STEP_X = 8;
    const LIGHT_STEP_Y = 4;

    for (let y = startY; y < SCREEN_H; y += 2) {
      const p = y - horizon;
      if (p <= 0.5) continue;
      const rowDistance = posZ / p;
      const stepX = (rowDistance * (rayDirX1 - rayDirX0)) / SCREEN_W;
      const stepY = (rowDistance * (rayDirY1 - rayDirY0)) / SCREEN_W;
      let floorX = player.x + rowDistance * rayDirX0;
      let floorY = player.y + rowDistance * rayDirY0;

      const fogT = Math.max(0, Math.min(0.8, (rowDistance - 7) / 34));
      const rowShade = Math.max(0.34, 1 - rowDistance * 0.028) * this.light;
      const fogK = 1 - fogT;
      const fr = this.fog.r * fogT;
      const fg = this.fog.g * fogT;
      const fb = this.fog.b * fogT;
      const row = y * SCREEN_W;
      const row2 = y + 1 < SCREEN_H ? row + SCREEN_W : row;
      const useLight = Boolean(this.lightmap) && (y % LIGHT_STEP_Y === 0);
      const bayerRow = (y & 3) << 2;

      let lightHere = 1;
      let lightCounter = 0;

      // Пол рисуется блоками 2×2: буфер 1280×720, работаем 640×360.
      // Ровно столько детализации было на прежнем разрешении, поэтому
      // картинка ничего не теряет, а тяжёлый цикл идёт вчетверо быстрее.
      for (let hx = 0, x = 0; x < SCREEN_W; hx++, x += 2) {
        // Счётчик вместо модуля: остаток от деления в горячем цикле дорог.
        if (useLight && lightCounter++ === 0) {
          lightHere = sampleLight(this.lightmap, floorX, floorY);
        }
        if (lightCounter >= LIGHT_STEP_X) lightCounter = 0;
        const cx = floorX | 0;
        const cy = floorY | 0;
        let tile = TILE.STONE;
        if (cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H) tile = map[cy * MAP_W + cx];
        const tex = floors[tile] || floors[TILE.GRASS];
        const tx = ((floorX - cx) * TEX_SIZE) | 0;
        const ty = ((floorY - cy) * TEX_SIZE) | 0;
        const c = tex[((ty & 63) << 6) + (tx & 63)];
        // Вода «дышит»: медленная волна яркости по времени.
        let shimmer = 1;
        if (tile === TILE.WATER) {
          shimmer = 0.88 + Math.sin(this.time * 1.7 + floorX * 0.7 + floorY * 0.5) * 0.12;
        }
        const shade = rowShade * lightHere * shimmer;
        const sr = (c & 255) * shade * fogK + fr;
        const sg = ((c >> 8) & 255) * shade * fogK + fg;
        const sb = ((c >> 16) & 255) * shade * fogK + fb;

        // Тёмный подмес без массива: murk() аллоцировал объект на пиксель.
        const mr = sr * MURK_K + MURK_R;
        const mg = sg * MURK_K + MURK_G;
        const mb = sb * MURK_K + MURK_B;

        const px = pack(
          quantizeFast(mr, this.qt, hx, y),
          quantizeFast(mg, this.qt, hx, y),
          quantizeFast(mb, this.qt, hx, y)
        );
        buf[row + x] = px;
        if (x + 1 < SCREEN_W) buf[row + x + 1] = px;
        // Вторая строка блока: та же выборка, другая строка буфера.
        if (row2 !== row) {
          buf[row2 + x] = px;
          if (x + 1 < SCREEN_W) buf[row2 + x + 1] = px;
        }
        floorX += stepX * 2;
        floorY += stepY * 2;
      }
    }
  }

  renderWalls(world, player, horizon) {
    const buf = this.buffer;
    const walls = this.textures.walls;
    const halfW = SCREEN_W >> 1;
    // Стены считаются раз в 2 колонки, как и пол: буфер 1280, работа 640.
    // Детализации ровно столько же, сколько было на прежнем разрешении.
    // Кэш ключа тайла: шаблонная строка на каждую колонку — это 640
    // аллокаций в кадре, а соседние лучи часто бьют в один и тот же тайл.
    let keyX = -1;
    let keyY = -1;
    let keyStr = "";

    for (let hx = 0; hx < halfW; hx++) {
      const x = hx << 1;
      const cameraX = (2 * hx) / halfW - 1;
      const rayDirX = player.dirX + player.planeX * cameraX;
      const rayDirY = player.dirY + player.planeY * cameraX;

      const ray = castRay(world, player.x, player.y, rayDirX, rayDirY, MAX_DIST);

      // Промах больше не превращается в стену в упор: луч просто уходит в туман.
      const perpDist = ray.dist;
      this.zBuffer[x] = perpDist;
      if (x + 1 < SCREEN_W) this.zBuffer[x + 1] = perpDist;

      if (!ray.hit) continue;

      if (ray.mapX !== keyX || ray.mapY !== keyY) {
        keyX = ray.mapX;
        keyY = ray.mapY;
        keyStr = `${ray.mapX},${ray.mapY}`;
      }
      const tallMul = (world.tallTiles && world.tallTiles.get(keyStr)) || 1;
      // Камера поднята на jumpZ: верх и низ стены смещаются на jumpZ/perpDist,
      // иначе стена отрывается от пола.
      const topOffset = ((SCREEN_H * 0.5) * tallMul - this.jumpZ) / perpDist;
      const bottomOffset = (SCREEN_H * 0.5 + this.jumpZ) / perpDist;
      const wallTop = horizon - topOffset;
      const drawStart = Math.floor(wallTop);
      const drawEnd = Math.floor(horizon + bottomOffset);

      const side = ray.side;
      const tile = ray.tile;
      let texX = Math.floor(ray.wallX * TEX_SIZE);
      if (side === 0 && rayDirX > 0) texX = TEX_SIZE - texX - 1;
      if (side === 1 && rayDirY < 0) texX = TEX_SIZE - texX - 1;
      texX = Math.max(0, Math.min(TEX_SIZE - 1, texX));

      // Скин здания (готика, замковая кладка) важнее окна и базовой текстуры.
      const skinName = world.skinTiles && world.skinTiles.get(keyStr);
      const winName = world.windowTiles && world.windowTiles.get(keyStr);
      const texture = (skinName && walls[skinName])
        || (winName && walls[winName])
        || walls[tile] || walls[TILE.STONE];
      const fogT = Math.max(0, Math.min(0.82, (perpDist - 6) / 32));
      const fogK = 1 - fogT;
      const baseShade = Math.max(0.28, (side === 1 ? 0.72 : 1) * (1 - perpDist * 0.022)) * this.light;
      // Свет по тайлам: факелы, костёр, окна. Интерполяция уже внутри.
      const tileLight = sampleLight(this.lightmap, ray.mapX + 0.5, ray.mapY + 0.5);
      const fr = this.fog.r * fogT;
      const fg = this.fog.g * fogT;
      const fb = this.fog.b * fogT;

      const y0 = Math.max(0, drawStart);
      const y1 = Math.min(SCREEN_H - 1, drawEnd);
      const step = TEX_SIZE * perpDist / SCREEN_H; // текстура в натуральном масштабе
      let texPos = (y0 - wallTop) * step;
      const span = Math.max(1, drawEnd - drawStart);
      const gable = Math.abs(ray.wallX - 0.5) * 2;
      const hasRoof = tallMul <= 1.5;

      // Стена считается блоками 2×2 по вертикали: у собора высота в девять
      // тайлов — это 1300 пикселей на колонку, и каждый проходил полный
      // расчёт цвета. Блок 2×2 режет работу вчетверо без потери детализации
      // относительно прежнего разрешения 640×360.
      for (let y = y0; y <= y1; y += 2) {
        const texY = ((texPos | 0) & 63);
        const c = texture[(texY << 6) + texX];
        texPos += step * 2;

        // Затенение к полу: стена перестаёт быть плоской.
        const occlusion = wallOcclusion((y - wallTop) / span, 0.4);
        const shade = baseShade * occlusion * tileLight;

        // ── Двускатная крыша ──
        // У высоких зданий (собор, ратуша) крыши нет: их фронтон начинался
        // бы на четырёхэтажной высоте и висел чёрной полосой через экран.
        const roofT = (y - wallTop) / span;
        let sr;
        let sg;
        let sb;

        if (hasRoof && roofT < ROOF_HEIGHT) {
          const tileRow = ((roofT * 18) | 0) & 1;
          const tileBand = tileRow === 0 ? 1 : 0.86;
          const slope = 0.55 + (1 - gable) * 0.45;
          const eave = roofT > ROOF_HEIGHT - 0.02 ? 0.45 : 1;
          const finalShade = shade * slope * tileBand * eave * 1.15;
          sr = 116 * slope * tileBand * finalShade + fr * 0.15;
          sg = 74 * slope * tileBand * finalShade + fg * 0.15;
          sb = 48 * slope * tileBand * finalShade + fb * 0.15;
        } else {
          sr = (c & 255) * shade * fogK + fr;
          sg = ((c >> 8) & 255) * shade * fogK + fg;
          sb = ((c >> 16) & 255) * shade * fogK + fb;
        }

        // Подмес сумрака и дизеринг: быстрые версии без массивов.
        const mr = sr * MURK_K + MURK_R;
        const mg = sg * MURK_K + MURK_G;
        const mb = sb * MURK_K + MURK_B;
        const px = pack(
          quantizeFast(mr, this.qt, hx, y),
          quantizeFast(mg, this.qt, hx, y),
          quantizeFast(mb, this.qt, hx, y)
        );
        const row = y * SCREEN_W;
        buf[row + x] = px;
        if (x + 1 < SCREEN_W) buf[row + x + 1] = px;
        // Вторая строка блока.
        if (y + 1 <= y1) {
          const row2 = row + SCREEN_W;
          buf[row2 + x] = px;
          if (x + 1 < SCREEN_W) buf[row2 + x + 1] = px;
        }
      }
    }
  }

  drawSprites(world, player, horizon, time, state = {}) {
    const ctx = this.ctx;
    const suspicionSource = state.suspicionSource || ((actor) => actor.suspicion);
    const showSuspicion = Boolean(state.showSuspicion);
    const list = [];
    for (const prop of world.props) {
      list.push({
        x: prop.x,
        y: prop.y,
        sprite: prop.sprite,
        scale: prop.scale,
        bob: 0,
        alert: false,
        actor: null,
      });
    }
    for (const actor of world.actors) {
      if (actor.kind === "merchant" || actor.kind === "courtesan") {
        list.push({
          x: actor.x,
          y: actor.y,
          sprite: actor.spriteKey || actor.kind,
          // Высота на экране = SCREEN_H / depth * scale, размер холста
          // на неё не влияет (он задаёт только пропорции ширины).
          // Поэтому все люди — на одной линейке, а не кто во что горазд.
          scale: actor.kind === "courtesan" ? HUMAN_SCALE + 0.05 : HUMAN_SCALE,
          bob: 0,
          alert: false,
          actor: null,
        });
        continue;
      }
      if (!actor.alive) {
        list.push({ x: actor.x, y: actor.y, sprite: "corpse", scale: 0.32, bob: 0, alert: false, actor: null });
        continue;
      }
      list.push({
        x: actor.x,
        y: actor.y,
        sprite: actor.spriteKey || actor.kind,
        scale: actor.kind === "driver" ? HUMAN_SCALE - 0.03 : HUMAN_SCALE,
        bob: actor.state === "chase" ? 1 : 0,
        alert: actor.state === "chase",
        actor: actor.kind === "courtesan" ? null : actor,
      });
    }

    for (const animal of world.animals || []) {
      if (!animal.alive) {
        list.push({
          x: animal.x,
          y: animal.y,
          sprite: "corpse",
          scale: 0.28,
          bob: 0,
          alert: false,
          actor: null,
        });
        continue;
      }
      list.push({
        x: animal.x,
        y: animal.y,
        sprite: animal.spriteKey || animal.kind,
        scale: animal.scale || 0.8,
        bob: animal.state === "chase" ? 1 : 0,
        alert: false,
        actor: null,
      });
    }

    // Гражданские: фон мира, без индикаторов подозрения.
    for (const person of world.civilians || []) {
      if (!person.alive) continue;
      list.push({
        x: person.x,
        y: person.y,
        sprite: person.spriteKey || person.kind,
        scale: HUMAN_SCALE,
        bob: person.state === "walk" ? 1 : 0,
        alert: false,
        actor: null,
      });
    }

    // Титан: огромный, с собственным масштабом. Не цель, не сюжетный индикатор.
    if (world.titan && world.titan.alive) {
      list.push({
        x: world.titan.x,
        y: world.titan.y,
        sprite: world.titan.spriteKey || "titan_calm",
        scale: 2.4,
        bob: world.titan.state === "hunt" ? 1 : 0,
        alert: false,
        actor: null,
      });
    }

    // Лошади: в мире видны как спрайты, если на них не сидят.
    for (const horse of world.horses || []) {
      if (!horse.alive) continue;
      list.push({
        x: horse.x,
        y: horse.y,
        sprite: horse.spriteKey || "horseSaddled",
        scale: 0.95,
        bob: 0,
        alert: false,
        actor: null,
      });
    }

    for (const item of list) {
      item.dist = (item.x - player.x) ** 2 + (item.y - player.y) ** 2;
    }
    // Дальние спрайты выбрасываются ДО сортировки: сортировать 500 объектов,
    // чтобы потом отбросить 470 по дистанции, — работа впустую.
    const maxDistSq = SPRITE_MAX_DIST * SPRITE_MAX_DIST;
    const visible = list.filter((item) => item.dist <= maxDistSq);
    visible.sort((a, b) => b.dist - a.dist);

    const invDet = 1 / (player.planeX * player.dirY - player.dirX * player.planeY);

    for (const item of visible) {
      const sprite = this.sprites[item.sprite];
      if (!sprite) continue;

      const dx = item.x - player.x;
      const dy = item.y - player.y;
      const transformX = invDet * (player.dirY * dx - player.dirX * dy);
      const transformY = invDet * (-player.planeY * dx + player.planeX * dy);
      if (transformY <= 0.18) continue;

      const screenX = (SCREEN_W / 2) * (1 + transformX / transformY);

      // Размер по глубине (это правильная перспектива). Проблема была не в нём,
      // а в отсутствии отсечек: при transformY ≈ 0 спрайт раздувался в полосу
      // на весь экран. Лечим отсечкой по глубине и реальному расстоянию.
      const trueDist = Math.sqrt(dx * dx + dy * dy);
      if (trueDist < 0.55 || transformY < 0.5) continue;

      const spriteH = Math.abs(SCREEN_H / transformY) * item.scale;
      const spriteW = spriteH * (sprite.width / sprite.height);
      if (spriteH < 2) continue;

      // Спрайт больше пары экранов бесполезен и ломает кадр.
      if (spriteH > SCREEN_H * 2.2 || spriteW > SCREEN_W * 2.2) continue;

      // Освещение: у спрайтов его не было вообще, они светились ночью.
      const lightHere = this.lightmap
        ? sampleLight(this.lightmap, item.x, item.y)
        : 1;
      const spriteLight = Math.max(0.28, Math.min(1.15, this.light * lightHere));
      const ambientAlpha = Math.max(0.35, Math.min(1, spriteLight));

      const bob = item.bob ? Math.sin(time * 11 + item.x * 3) * spriteH * 0.018 : 0;
      const groundY = horizon + (SCREEN_H * 0.5 + this.jumpZ) / transformY + bob;
      const top = groundY - spriteH;
      const left = screenX - spriteW / 2;

      const startX = Math.max(0, Math.floor(left));
      const endX = Math.min(SCREEN_W - 1, Math.ceil(left + spriteW));
      if (startX > endX) continue;

      // тень
      const centerCol = Math.floor(screenX);
      if (centerCol >= 0 && centerCol < SCREEN_W && transformY < this.zBuffer[centerCol]) {
        ctx.save();
        ctx.globalAlpha = Math.max(0.12, 0.38 - transformY * 0.006);
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(screenX, groundY - spriteH * 0.015, spriteW * 0.36, Math.max(2, spriteH * 0.055), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Затухание по дистанции: раньше нижняя граница была 0.4,
      // и всё на средней дистанции выглядело стеклянным.
      // Теперь объект остаётся почти непрозрачным, а дальше его съедает туман.
      // ambientAlpha НЕ домножаем: освещение уже применяется через filter,
      // а прозрачность от света делала объекты призрачными в тени.
      const alpha = Math.max(0.85, Math.min(1, 1.15 - transformY * 0.01));
      ctx.globalAlpha = alpha;

      // Затемнение спрайта по освещению: без этого всё светится ночью.
      const canFilter = typeof ctx.filter === "string";
      if (canFilter) {
        ctx.filter = `brightness(${spriteLight.toFixed(3)}) saturate(0.9)`;
      }

      let runStart = -1;
      for (let col = startX; col <= endX + 1; col++) {
        const visible = col <= endX && transformY < this.zBuffer[col];
        if (visible && runStart === -1) {
          runStart = col;
        } else if (!visible && runStart !== -1) {
          const runEnd = col;
          const sx = ((runStart - left) / spriteW) * sprite.width;
          const sw = ((runEnd - runStart) / spriteW) * sprite.width;
          ctx.drawImage(
            sprite,
            Math.max(0, sx),
            0,
            Math.max(0.5, sw),
            sprite.height,
            runStart,
            top,
            runEnd - runStart,
            spriteH
          );
          runStart = -1;
        }
      }
      if (canFilter) ctx.filter = "none";
      ctx.globalAlpha = 1;

      if (item.actor && showSuspicion) {
        const col = Math.floor(screenX);
        if (col >= 0 && col < SCREEN_W && transformY < this.zBuffer[col]) {
          this.drawSuspicion(ctx, item.actor, suspicionSource(item.actor), screenX, top, spriteH);
        }
      }

      if (item.alert && centerCol >= 0 && centerCol < SCREEN_W && transformY < this.zBuffer[centerCol]) {
        ctx.save();
        ctx.font = "bold 20px Georgia";
        ctx.textAlign = "center";
        ctx.fillStyle = "#e2453a";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeText("!", screenX, top - 4);
        ctx.fillText("!", screenX, top - 4);
        ctx.restore();
      }
    }
  }

  // Дуга подозрения над стражем: зелёный → жёлтый → красный.
  drawSuspicion(ctx, actor, suspicion, screenX, top, spriteH) {
    if (!Number.isFinite(suspicion) || suspicion < 0.04) return;
    // Слишком далёкий или слишком близкий спрайт не должен давать полосу на весь экран.
    // Порог масштабируется вместе с разрешением: 24 px при 360p — это 48 при 720p.
    if (!Number.isFinite(spriteH) || spriteH < 24 * UI_SCALE || spriteH > 260 * UI_SCALE) return;

    const clamped = Math.min(1, suspicion);
    const y = top - (spriteH > 60 * UI_SCALE ? 16 : 10) * UI_SCALE;
    const width = Math.max(14 * UI_SCALE, Math.min(38 * UI_SCALE, spriteH * 0.38));
    const height = 3 * UI_SCALE;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(screenX - width / 2 - UI_SCALE, y - UI_SCALE, width + 2 * UI_SCALE, height + 2 * UI_SCALE);

    let color = "#6fa84a";
    if (clamped > 0.65) color = "#d8a03a";
    if (clamped > 0.85 || actor.state === "chase") color = "#d8402f";

    ctx.fillStyle = color;
    ctx.fillRect(screenX - width / 2, y, width * clamped, height);

    if (actor.asleep) {
      ctx.fillStyle = "#8aa2b8";
      ctx.font = `bold ${11 * UI_SCALE}px Georgia`;
      ctx.textAlign = "center";
      ctx.fillText("z", screenX + width / 2 + 5 * UI_SCALE, y + 5 * UI_SCALE);
    }
    ctx.restore();
  }

  // Голова лошади внизу кадра: единственное, что видно от лошади
  // в виде от первого лица. Покачивается в такт иноходи.
  drawHorseHead(time, player) {
    const sprite = this.sprites.horseHead;
    if (!sprite) return;

    const ctx = this.ctx;
    const bob = Math.sin(player.walkPhase * 1.4) * 8 * UI_SCALE;
    const sway = Math.sin(player.walkPhase * 0.7) * 5 * UI_SCALE;
    // Уже и ниже: голова должна занимать нижнюю треть, а не пол-экрана.
    const w = SCREEN_W * 0.26;
    const h = w * (sprite.height / sprite.width);

    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.drawImage(
      sprite,
      SCREEN_W * 0.5 - w * 0.62 + sway,
      SCREEN_H - h + 26 * UI_SCALE + bob,
      w,
      h
    );
    ctx.restore();
  }

  drawWeapon(player, time) {
    const ctx = this.ctx;
    const swing = player.swingT > 0 ? 1 - player.swingT / 0.34 : 0;
    const bob = Math.sin(player.walkPhase) * 5 * UI_SCALE + (player.crouching ? 8 * UI_SCALE : 0);
    // Блок: меч разворачивается поперёк корпуса, гарда ближе к центру экрана.
    const block = player.blocking ? 1 : 0;
    const x = SCREEN_W * 0.76 - (swing * 150 + block * 190) * UI_SCALE;
    const y = SCREEN_H - 22 * UI_SCALE + bob + (swing * 26 - block * 46) * UI_SCALE
      + (player.jumpZ || 0) * -0.35 * UI_SCALE;
    const angle = -0.55 + swing * 1.5 - block * 0.85;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(UI_SCALE, UI_SCALE);
    // рукоять
    ctx.fillStyle = "#3a2918";
    ctx.fillRect(-5, 10, 10, 54);
    ctx.fillStyle = "#8f7434";
    ctx.fillRect(-16, 4, 32, 8);
    // клинок
    ctx.beginPath();
    ctx.moveTo(-7, 4);
    ctx.lineTo(-5, -92);
    ctx.lineTo(0, -108);
    ctx.lineTo(5, -92);
    ctx.lineTo(7, 4);
    ctx.closePath();
    const grad = ctx.createLinearGradient(-7, 0, 7, 0);
    grad.addColorStop(0, "#9aa1aa");
    grad.addColorStop(0.5, "#e2e6ea");
    grad.addColorStop(1, "#70767e");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "#2c3036";
    ctx.lineWidth = 1;
    ctx.stroke();
    // блик
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(-1, -88, 1.5, 86);
    ctx.restore();
  }
}
