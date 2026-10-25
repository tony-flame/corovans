import { buildTextures, TEX_SIZE } from "./textures.js";
import { buildSprites } from "./sprites.js";
import { MAP_W, MAP_H, TILE } from "./world.js";

const SCREEN_W = 640;
const SCREEN_H = 360;
const FOV_PLANE = 0.66;
const MAX_DIST = 40;

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
  }

  render(state) {
    const { world, player, time, hurtFlash = 0 } = state;
    const horizon = SCREEN_H * 0.5 + player.bobY;
    this.renderSky(player, horizon);
    this.renderFloor(world, player, horizon);
    this.renderWalls(world, player, horizon);

    this.ctx.putImageData(this.imageData, 0, 0);
    this.drawSprites(world, player, horizon, time);
    if (state.started) this.drawWeapon(player, time);

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

  renderSky(player, horizon) {
    const buf = this.buffer;
    const top = [24, 31, 46];
    const bottom = [132, 116, 88];
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
    const tanHalf = FOV_PLANE;
    for (let x = 0; x < SCREEN_W; x++) {
      const cameraX = (2 * x) / SCREEN_W - 1;
      const angle = player.angle + Math.atan(cameraX * tanHalf);
      const h1 = 10 + Math.sin(angle * 2.3) * 5 + Math.sin(angle * 5.7 + 1) * 2.5;
      const h2 = 5 + Math.sin(angle * 3.7 + 2) * 3 + Math.sin(angle * 9.1) * 1.5;
      const start1 = Math.max(0, Math.floor(horizon - h1));
      const start2 = Math.max(0, Math.floor(horizon - h2));
      for (let y = start1; y < h; y++) buf[y * SCREEN_W + x] = pack(43, 52, 43);
      for (let y = start2; y < h; y++) buf[y * SCREEN_W + x] = pack(31, 41, 32);
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
    const posZ = 0.5 * SCREEN_H;
    const floors = this.textures.floors;
    const map = world.map;

    const startY = Math.max(0, Math.floor(horizon) + 1);

    for (let y = startY; y < SCREEN_H; y++) {
      const p = y - horizon;
      if (p <= 0.5) continue;
      const rowDistance = posZ / p;
      const stepX = (rowDistance * (rayDirX1 - rayDirX0)) / SCREEN_W;
      const stepY = (rowDistance * (rayDirY1 - rayDirY0)) / SCREEN_W;
      let floorX = player.x + rowDistance * rayDirX0;
      let floorY = player.y + rowDistance * rayDirY0;

      const fogT = Math.max(0, Math.min(0.8, (rowDistance - 7) / 34));
      const shade = Math.max(0.34, 1 - rowDistance * 0.028);
      const fr = this.fog.r * fogT;
      const fg = this.fog.g * fogT;
      const fb = this.fog.b * fogT;
      const row = y * SCREEN_W;

      for (let x = 0; x < SCREEN_W; x++) {
        const cx = Math.floor(floorX);
        const cy = Math.floor(floorY);
        let tile = TILE.STONE;
        if (cx >= 0 && cy >= 0 && cx < MAP_W && cy < MAP_H) tile = map[cy * MAP_W + cx];
        const tex = floors[tile] || floors[TILE.GRASS];
        const tx = ((floorX - cx) * TEX_SIZE) | 0;
        const ty = ((floorY - cy) * TEX_SIZE) | 0;
        const c = tex[(ty & 63) * TEX_SIZE + (tx & 63)];
        const r = (c & 255) * shade * (1 - fogT) + fr;
        const g = ((c >> 8) & 255) * shade * (1 - fogT) + fg;
        const b = ((c >> 16) & 255) * shade * (1 - fogT) + fb;
        buf[row + x] = pack(r | 0, g | 0, b | 0);
        floorX += stepX;
        floorY += stepY;
      }
    }
  }

  renderWalls(world, player, horizon) {
    const buf = this.buffer;
    const map = world.map;
    const walls = this.textures.walls;

    for (let x = 0; x < SCREEN_W; x++) {
      const cameraX = (2 * x) / SCREEN_W - 1;
      const rayDirX = player.dirX + player.planeX * cameraX;
      const rayDirY = player.dirY + player.planeY * cameraX;

      let mapX = Math.floor(player.x);
      let mapY = Math.floor(player.y);

      const deltaDistX = Math.abs(rayDirX) < 1e-9 ? 1e30 : Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(rayDirY) < 1e-9 ? 1e30 : Math.abs(1 / rayDirY);

      let stepX;
      let stepY;
      let sideDistX;
      let sideDistY;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (player.x - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1 - player.x) * deltaDistX;
      }
      if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (player.y - mapY) * deltaDistY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1 - player.y) * deltaDistY;
      }

      let side = 0;
      let tile = TILE.STONE;
      let hit = false;
      for (let i = 0; i < 80; i++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) {
          tile = TILE.STONE;
          hit = true;
          break;
        }
        tile = map[mapY * MAP_W + mapX];
        if (tile === TILE.BRICK || tile === TILE.WOOD || tile === TILE.STONE) {
          hit = true;
          break;
        }
      }

      let perpDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
      if (!hit || perpDist < 0.05) perpDist = 0.05;
      if (perpDist > MAX_DIST) perpDist = MAX_DIST;
      this.zBuffer[x] = perpDist;

      const lineHeight = SCREEN_H / perpDist;
      const drawStart = Math.floor(horizon - lineHeight / 2);
      const drawEnd = Math.floor(horizon + lineHeight / 2);

      let wallX;
      if (side === 0) wallX = player.y + perpDist * rayDirY;
      else wallX = player.x + perpDist * rayDirX;
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * TEX_SIZE);
      if (side === 0 && rayDirX > 0) texX = TEX_SIZE - texX - 1;
      if (side === 1 && rayDirY < 0) texX = TEX_SIZE - texX - 1;
      texX = Math.max(0, Math.min(TEX_SIZE - 1, texX));

      const texture = walls[tile] || walls[TILE.STONE];
      const fogT = Math.max(0, Math.min(0.82, (perpDist - 6) / 32));
      const shade = Math.max(0.28, (side === 1 ? 0.72 : 1) * (1 - perpDist * 0.022));
      const fr = this.fog.r * fogT;
      const fg = this.fog.g * fogT;
      const fb = this.fog.b * fogT;

      const y0 = Math.max(0, drawStart);
      const y1 = Math.min(SCREEN_H - 1, drawEnd);
      const step = TEX_SIZE / lineHeight;
      let texPos = (y0 - horizon + lineHeight / 2) * step;

      for (let y = y0; y <= y1; y++) {
        const texY = ((texPos | 0) & 63);
        texPos += step;
        const c = texture[texY * TEX_SIZE + texX];
        const r = (c & 255) * shade * (1 - fogT) + fr;
        const g = ((c >> 8) & 255) * shade * (1 - fogT) + fg;
        const b = ((c >> 16) & 255) * shade * (1 - fogT) + fb;
        buf[y * SCREEN_W + x] = pack(r | 0, g | 0, b | 0);
      }
    }
  }

  drawSprites(world, player, horizon, time) {
    const ctx = this.ctx;
    const list = [];
    for (const prop of world.props) {
      list.push({
        x: prop.x,
        y: prop.y,
        sprite: prop.sprite,
        scale: prop.scale,
        bob: 0,
        alert: false,
      });
    }
    for (const actor of world.actors) {
      if (actor.kind === "merchant") {
        list.push({ x: actor.x, y: actor.y, sprite: "merchant", scale: 0.94, bob: 0, alert: false });
        continue;
      }
      if (!actor.alive) {
        list.push({ x: actor.x, y: actor.y, sprite: "corpse", scale: 0.32, bob: 0, alert: false });
        continue;
      }
      list.push({
        x: actor.x,
        y: actor.y,
        sprite: actor.kind,
        scale: actor.kind === "driver" ? 0.9 : 0.94,
        bob: actor.state === "chase" ? 1 : 0,
        alert: actor.state === "chase",
      });
    }

    for (const item of list) {
      item.dist = (item.x - player.x) ** 2 + (item.y - player.y) ** 2;
    }
    list.sort((a, b) => b.dist - a.dist);

    const invDet = 1 / (player.planeX * player.dirY - player.dirX * player.planeY);

    for (const item of list) {
      const sprite = this.sprites[item.sprite];
      if (!sprite) continue;

      const dx = item.x - player.x;
      const dy = item.y - player.y;
      const transformX = invDet * (player.dirY * dx - player.dirX * dy);
      const transformY = invDet * (-player.planeY * dx + player.planeX * dy);
      if (transformY <= 0.18) continue;

      const screenX = (SCREEN_W / 2) * (1 + transformX / transformY);
      const spriteH = Math.abs(SCREEN_H / transformY) * item.scale;
      const spriteW = spriteH * (sprite.width / sprite.height);
      if (spriteH < 2) continue;

      const bob = item.bob ? Math.sin(time * 11 + item.x * 3) * spriteH * 0.018 : 0;
      const groundY = horizon + SCREEN_H / (2 * transformY) + bob;
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

      const alpha = Math.max(0.4, Math.min(1, 1.15 - transformY * 0.028));
      ctx.globalAlpha = alpha;

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
      ctx.globalAlpha = 1;

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

  drawWeapon(player, time) {
    const ctx = this.ctx;
    const swing = player.swingT > 0 ? 1 - player.swingT / 0.34 : 0;
    const bob = Math.sin(player.walkPhase) * 5 + (player.crouching ? 8 : 0);
    const x = SCREEN_W * 0.76 - swing * 150;
    const y = SCREEN_H - 22 + bob + swing * 26;
    const angle = -0.55 + swing * 1.5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
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
