// Жизнь мира: дым из труб, птицы, ветер в траве, следы на земле.
// Чистый модуль — считает позиции, а рисует их rayсaster/main.
//
// Всё детерминировано от времени и сида. Никаких Math.random в кадре:
// иначе частица за частицей будут прыгать при перерисовке, и мир
// задрожит. Это ровно та же ошибка, что была с погодой.

// ── Дым из труб ─────────────────────────────────────────────────────
// Привязан к домам, а не к отдельным тайлам: труба одна на дом,
// и дым должен идти из неё, а не из середины крыши.

export const SMOKE_RISE = 1.6;      // на сколько поднимается за срок жизни
export const SMOKE_LIFE = 4.5;      // секунд до полного растворения
export const SMOKE_COUNT = 6;       // частиц на трубу одновременно

// Позиция частицы дыма. index — номер частицы, time — игровое время.
// Частица рождается в момент (time - offset), где offset сдвигает её
// по циклу: так дым идёт непрерывной струёй, а не залпом.
export function smokeParticle(index, count, time, seed = 0) {
  const cycle = SMOKE_LIFE;
  // Каждая частица смещена по фазе, чтобы струя была ровной.
  const offset = (index / count) * cycle;
  const age = ((time + offset + (seed % 100) * 0.01) % cycle) / cycle; // 0..1

  // Лёгкий снос ветром вправо: дым не поднимается строго вертикально.
  const drift = age * 0.55 + Math.sin(age * 5.2 + index) * 0.08;

  return {
    age,
    // 1 в начале, 0 в конце — гаснет плавно, без щелчка.
    alpha: Math.max(0, 1 - age) * Math.min(1, age * 6),
    rise: age * SMOKE_RISE,
    drift,
    // Расширяется по мере подъёма.
    scale: 0.35 + age * 0.9,
    alive: age < 1,
  };
}

// ── Птицы ───────────────────────────────────────────────────────────
// Стая летит по небу по прямой и заворачивает за край экрана.
// Не привязана к игроку: птицы — часть неба, а не мира.

export const BIRD_COUNT = 9;
export const BIRD_SPEED = 0.045;   // долей экрана в секунду

export function birdAt(index, time, seed = 0) {
  const rngSeed = (seed + index * 7919) % 100000;
  const phase = ((rngSeed % 1000) / 1000) * Math.PI * 2;
  const speed = BIRD_SPEED * (0.7 + ((rngSeed % 53) / 53) * 0.6);

  // Летят вправо и по кругу возвращаются слева.
  const t = (time * speed + (rngSeed % 97) / 97) % 1;
  const x = t;

  // Высота: несколько птиц на одной линии, остальные выше/ниже.
  const height = 0.12 + ((rngSeed % 31) / 31) * 0.18;
  // Лёгкое покачивание на воздухе.
  const bob = Math.sin(time * 1.7 + phase) * 0.012;

  // Взмах: фаза определяет, поднято крыло или опущено.
  const flap = Math.sin(time * 6.5 + phase * 3);

  return { x, y: height + bob, flap, visible: true };
}

// Весь клин: птицы летят строем, а не случайной россыпью.
export function flockAt(time, seed = 0) {
  const birds = [];
  for (let i = 0; i < BIRD_COUNT; i++) {
    const base = birdAt(i, time, seed);
    // Строй: смещение по x и y от ведущей птицы.
    const row = Math.floor(i / 3);
    const col = i % 3;
    birds.push({
      ...base,
      x: (base.x + row * 0.035 + col * 0.018) % 1,
      y: base.y + row * 0.022 + (col === 2 ? -0.01 : 0),
    });
  }
  return birds;
}

// ── Ветер в траве ───────────────────────────────────────────────────
// Не рябь по всему экрану, а порывы: сила ветра меняется волной,
// поэтому трава колышется неровно.

export function windStrength(time, weather = null) {
  const base = 0.35 + Math.sin(time * 0.31) * 0.22 + Math.sin(time * 0.73) * 0.1;
  // В дождь и снег ветер сильнее: трава ходит ходуном.
  const wet = weather && weather.intensity ? weather.intensity * 0.35 : 0;
  return Math.max(0, Math.min(1.4, base + wet));
}

// Смещение колоса по x на экране. Возвращает долю тайла.
export function grassLean(worldX, worldY, time, strength = 1) {
  // Фаза привязана к координате: соседние кустики качаются не синхронно.
  const phase = worldX * 2.3 + worldY * 1.7;
  return Math.sin(time * 2.4 + phase) * 0.06 * strength;
}

// ── Следы ───────────────────────────────────────────────────────────
// Игрок оставляет следы на мягкой земле. Это не механика, а след:
// видно, откуда пришёл. Хранятся в мире, а не в ране — перезагрузка
// не должна показывать следы из прошлой жизни.

export const TRACK_LIFE = 9;
export const TRACK_LIMIT = 48;

export function shouldDropTrack(lastX, lastY, x, y, minDist = 0.55) {
  if (lastX === null || lastX === undefined) return true;
  return Math.hypot(x - lastX, y - lastY) >= minDist;
}

// Обновление списка следов. Возвращает новый массив нужной длины.
// Шаг считается по времени: следы тают, а не висят вечно.
export function stepTracks(tracks, dt, max = TRACK_LIMIT) {
  if (!tracks || tracks.length === 0) return tracks || [];
  const alive = [];
  for (const track of tracks) {
    const age = (track.age || 0) + dt;
    if (age >= TRACK_LIFE) continue;
    alive.push({ ...track, age });
  }
  // Обрезаем с начала: старые исчезают первыми.
  return alive.length > max ? alive.slice(alive.length - max) : alive;
}

export function trackAlpha(track) {
  if (!track) return 0;
  const t = Math.min(1, (track.age || 0) / TRACK_LIFE);
  return Math.max(0, (1 - t) * 0.55);
}
