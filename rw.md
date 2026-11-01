# Ревью: производительность и архитектура

**Проект:** «Корованы: Тёмная дорога»
**Дата:** 2026-11-01
**Объём:** 43 файла, ~12 500 строк JS
**Статус тестов на момент ревью:** `npm run verify` — 221/221 pass

Все цифры ниже получены замерами на этой машине (Node 24, фейковый 2D-контекст),
а не «на глаз». Скрипты замеров лежали во временной папке и в репозиторий не попали.

---

## TL;DR — что чинить в первую очередь

| # | Проблема | Тип | Цена |
|---|----------|-----|------|
| 1 | Пол теряет освещение через строку → мерцание ~7 Гц при ходьбе | Баг + перф | визуальный дефект |
| 2 | Утечка canvas-спрайтов куртизанок: 48 ключей вместо 8, ~2.7 МБ | Баг | утечка памяти |
| 3 | `finishFrame` — 4.3 мс кадра, 40% бюджета | Перф | −1.3 мс |
| 4 | `ui.update()` — 62 безусловные записи в DOM каждый кадр | Перф | layout thrash |
| 5 | Три разные таблицы яркости по фазе суток, три разных «ночи» | Архитектура | рассинхрон |
| 6 | `main.js` — 1749 строк, божественный объект | Архитектура | поддержка |
| 7 | `audio.rain()` вызывается 60 раз/сек, каждый раз планируя ramp | Перф + звук | щелчки |
| 8 | Два независимых `objective*`-генератора с разной логикой | Архитектура | расхождение UI |

---

## 1. Замеры: где реально уходит кадр

Полный `renderer.render()` на 1280×720, фейковый контекст (без настоящей растеризации,
поэтому у реального браузера цифры **выше**, особенно на `drawImage` + `filter`):

```
локация            ms/frame
площадь/деревня      11.69
собор снаружи        12.14
хижины               12.80
лес                  10.72
лагерь               12.15
```

Разложение одного кадра:

```
renderSky      0.68 ms
renderFloor    4.27 ms   <-- 114 560 сэмплов
renderWalls    0.45 ms   <-- 640 лучей, 2×2 блоки
finishFrame    5.01 ms   <-- 230 400 пикселей виньетки/зерна
drawSprites    0.27 ms   <-- 496 объектов-обёрток
SUM           10.68 ms
```

Вывод: кадр упирается в **два места** — `finishFrame` и `renderFloor`. Всё остальное
уже оптимизировано прилично (стены — 0.45 мс, ИИ — 0.17 мс, лайтмап — 0.14 мс на
пересборку 10 раз в секунду).

Прочие замеры горячих путей:

```
canStand              4.07 µs   (473 solid-пропа линейным перебором)
lineOfSight          18.27 µs   (389 blocksSight-пропов + шаг 0.12)
castRay               0.82 µs
nearestInteraction    2.70 µs   (×2 вызова за кадр)
buildLightmap         0.142 ms  (×10/сек = 1.4 мс/сек, нормально)
player move 1 axis    5.93 µs   (2× canStand)
```

---

## 2. Критические баги (найдены замером, не рассуждением)

### 2.1 Пол теряет лайтмап через строку → мерцание при ходьбе

`src/raycaster.js:307, 324`

```js
for (let y = startY; y < SCREEN_H; y += 2) {     // шаг 2
  ...
  const useLight = Boolean(this.lightmap) && (y % LIGHT_STEP_Y === 0);  // LIGHT_STEP_Y = 4
```

`y` идёт с шагом 2, а условие проверяет `y % 4 === 0`. Значит свет применяется **только
к каждой второй строке блока** — то есть к половине тех строк, для которых он вообще
задумывался. Комментарий рядом утверждает «1/32 выборок», по факту получается 1/16
или 0 — в зависимости от чётности `startY`.

А `startY` зависит от `horizon`, а `horizon` — от `player.bobY` (покачивание при ходьбе,
`y = 360 + sin(...) * 1.5`). Замер:

```
bobY     horizon  startY  лайтмап пола
-2.00    358.00     359   нет
-1.00    359.00     360   ДА
 0.00    360.00     361   нет
 1.00    361.00     362   ДА
 2.00    362.00     363   нет

включён на 8 из 17 позиций качания.
Переключений за 1 секунду ходьбы: 7  => ~7 Гц мерцание.
```

**Что видит игрок:** ночью, рядом с костром и факелами, пол «дышит» неравномерными
полосами на 7 Гц. Днём незаметно (свет почти везде 1), ночью — очевидно.

**Почему тесты не поймали:** `tests/graphics.test.js` проверяет математику `sampleLight`,
а не чередование строк в цикле. Это ровно тот класс регрессий, про который в `AGENTS.md`
написано «logic tests do not cover rendering».

**Почин:** считать состояние света один раз на блок, а не по `y % 4`:

```js
// свет включён для половины блоков по вертикали, независимо от чётности startY
const blockRow = (y - startY) >> 1;            // 0,1,2,... — счётчик блоков
const useLight = Boolean(this.lightmap) && (blockRow % (LIGHT_STEP_Y / 2) === 0);
```

Так выборка привязана к индексу блока, а не к абсолютному `y`, и не дёргается от
покачивания. Заодно это чинит полосы: сейчас соседние блоки различаются по свету
через один, а должны через два.

**Тот же дефект в стенах** (`raycaster.js:451`): `quantizeFast(..., hx, y)` при `y += 2`
тоже прогоняет дизеринг только по чётным строкам матрицы Байера. На текстурах это
не так бросается в глаза, но узор дизера «плывёт» при смене `drawStart`. Дизерить надо
по номеру строки сэмпла, а не по экранному `y`.

### 2.2 Утечка спрайтов куртизанок: 48 ключей вместо 8

`src/main.js:281-304`

```js
function updateCourtesanVariant() {
  for (const courtesan of world.courtesans || []) {
    ...
    const cleanKey = `${variant.spriteKey}_clean`;
    const bloodKey = `${variant.spriteKey}_blood`;
    courtesan.spriteKey = bloodied ? bloodKey : cleanKey;

    // «Старые ключи этого места удаляем, иначе копится мусор при каждом караване.»
    for (const key of Object.keys(renderer.sprites)) {
      if (key.startsWith(`courtesan_`) && !key.endsWith("_clean") && !key.endsWith("_blood")) {
        delete renderer.sprites[key];
      }
    }

    renderer.sprites[cleanKey] = buildCourtesan(variant, { bloodied: false });
    renderer.sprites[bloodKey] = buildCourtesan(variant, { bloodied: true });
  }
}
```

Условие удаления **никогда не выполняется**: всё, что пишется в `renderer.sprites`,
всегда оканчивается на `_clean` или `_blood`. Базовая заглушка `courtesan` (без суффикса)
существует, но она не начинается с `courtesan_` в том смысле... она как раз начинается —
но и она не удаляется, потому что под фильтр не попадает по другой причине: цикл
исключает всё, что заканчивается на суффиксы, а `courtesan` — нет, поэтому удалилась бы.
Но она и не должна. Итог: **ни один спрайт куртизанки не удаляется**.

Замерено на 6 сменах тира:

```
после 6 тиров × 4 места: ключей 0 -> 48 (ожидалось 8)
лишних объектов: 40, это ~2760 КБ canvas-памяти
```

40 осиротевших canvas по 96×184 пикселя. За долгий забег (тир растёт с каждым караваном)
это накопится в десятки мегабайт, и каждый из них остаётся живым объектом в куче —
GC их не соберёт, потому что на них ссылается `renderer.sprites`.

**Почин:** хранить у куртизанки её собственные ключи и удалять ровно их.

```js
function updateCourtesanVariant() {
  for (const courtesan of world.courtesans || []) {
    const spot = courtesan.spot || "square";
    const variant = createCourtesan(run.seed, run.tier, run.act, spot);

    // удаляем только своё, а не выметаем всю мапу
    if (courtesan.spriteKeys) {
      for (const key of courtesan.spriteKeys) delete renderer.sprites[key];
    }

    const cleanKey = `${variant.spriteKey}_clean`;
    const bloodKey = `${variant.spriteKey}_blood`;
    renderer.sprites[cleanKey] = buildCourtesan(variant, { bloodied: false });
    renderer.sprites[bloodKey] = buildCourtesan(variant, { bloodied: true });

    courtesan.spriteKeys = [cleanKey, bloodKey];
    courtesan.spriteKey = bloodied ? bloodKey : cleanKey;
    ...
  }
}
```

И добавить тест: `updateCourtesanVariant` дважды подряд → число ключей `courtesan_*`
не растёт. Это дешёвый guard на весь класс таких утечек.

### 2.3 `audio.rain()` — 60 вызовов в секунду, каждый планирует ramp

`src/main.js:1911` вызывает `audio.rain(...)` **каждый кадр**. Внутри
(`audio.js:104-105`):

```js
this.rainNode.gain.gain.cancelScheduledValues(now);
this.rainNode.gain.gain.linearRampToValueAtTime(target, now + 1.2);
```

60 раз в секунду отменяются и заново создаются события автоматизации AudioParam.
Chrome держит список событий на каждый параметр; на 60 ramp/сек это мусор в
планировщике и характерные щелчки/дрожание громкости дождя.

**Почин:** вызывать только при изменении цели.

```js
rain(on, intensity = 0.5) {
  const target = on ? 0.05 + intensity * 0.09 : 0;
  if (Math.abs(target - (this.rainTarget ?? -1)) < 0.01) return;
  this.rainTarget = target;
  ...
}
```

---

## 3. Производительность: что оптимизировать

### 3.1 `finishFrame` — 5.0 мс, из них ~1.3 мс лишних

`raycaster.js:91-138`. Проход идёт по `Uint8ClampedArray` и пишет **12 элементов
на блок 2×2** — по три канала в четыре пикселя, отдельными `data[i] = r` записями.
Плюс ручной кламп, хотя `Uint8ClampedArray` клампит сам.

Замер двух вариантов на реальном буфере 1280×720:

```
текущий (Uint8Clamped, 12 записей): 4.33 ms
Uint32 + 4 записи:                  3.07 ms
ускорение 1.41x, экономия 1.26 ms/frame
```

Замена простая: буфер уже существует как `this.buffer` (`Uint32Array` поверх того же
`ArrayBuffer`), пол и стены через него и пишут. Финальный проход оказался единственным,
кто игнорирует собственную оптимизацию.

```js
finishFrame() {
  this.buildVignetteTable();
  const buf = this.buffer;
  const vig = this.vignetteTable;
  const gr = this.grainTable;
  for (let y = 0; y < SCREEN_H; y += 2) {
    const row = y * SCREEN_W;
    const row2 = y + 1 < SCREEN_H ? row + SCREEN_W : row;
    for (let x = 0; x < SCREEN_W; x += 2) {
      const idx = row + x;
      const v = vig[idx];
      const g = gr[idx];
      const c = buf[idx];
      let r = (c & 255) * v + g;
      let gg = ((c >> 8) & 255) * v + g;
      let b = ((c >> 16) & 255) * v + g;
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      gg = gg < 0 ? 0 : gg > 255 ? 255 : gg;
      b = b < 0 ? 0 : b > 255 ? 255 : b;
      const px = (255 << 24) | (b << 16) | (gg << 8) | r;
      buf[idx] = px;
      if (x + 1 < SCREEN_W) buf[idx + 1] = px;
      if (row2 !== row) {
        buf[row2 + x] = px;
        if (x + 1 < SCREEN_W) buf[row2 + x + 1] = px;
      }
    }
  }
}
```

Дополнительно: `vignetteTable` и `grainTable` — по 3.7 МБ `Float32Array` каждая
(921 600 × 4 байта). Держать ради 16 уровней квантования — расточительно. `Float32`
здесь оправдан только для `vig`; зерно целочисленное и влезает в `Int8Array`.
Это ещё ~3.7 МБ экономии памяти без изменения картинки.

### 3.2 `renderFloor` — 4.3 мс и 114 560 сэмплов

Основная стоимость — не сам цикл, а `sampleLight` внутри него.
`LIGHT_STEP_X = 8` при `x += 2` даёт 80 вызовов на строку, `LIGHT_STEP_Y = 4`
при `y += 2` — половину строк (см. баг 2.1). После починки 2.1 выборок станет МЕНЬШЕ,
не больше: сейчас половина строк получает свет, которой по задумке не должно быть
у половины из них.

Отдельно: `bayerRow` (`raycaster.js:325`) вычисляется и **не используется ни разу** —
`quantizeFast` берёт `y` сам. Мёртвая строка в горячем цикле.

Ещё в этом цикле считается `shimmer` для воды:

```js
if (tile === TILE.WATER) {
  shimmer = 0.88 + Math.sin(this.time * 1.7 + floorX * 0.7 + floorY * 0.5) * 0.12;
}
```

`Math.sin` на каждый водный сэмпл. Вода на карте — озеро у деревни (~200 тайлов),
то есть заметно только стоя у воды. Терпимо, но если понадобится — заменить на
предвычисленную таблицу 256 значений.

### 3.3 `drawSprites` — 496 аллокаций на кадр

`raycaster.js:505-624`. Каждый кадр:

1. Создаётся `list = []` и **496 объектов-обёрток** `{x, y, sprite, scale, bob, alert, actor, dist}`.
2. `list.filter(...)` — второй массив.
3. `visible.sort(...)` — сортировка.

496 объектов × 60 кадров = **~30 000 объектов в секунду**. Вместе с двумя массивами
это стабильный поток мусора и GC-паузы. При этом видимых после отсечки по дистанции —
от 10 до 272 (замер: на соборе 272 из 473 пропов, на площади 45).

**Почин без изменения поведения:** держать пул обёрток длиной `list.length` и
переиспользовать его. Сортировать можно индексы, а не объекты. Или — раз объекты не
мутируют между кадрами, кэшировать массив обёрток и обновлять только изменяемые поля
(`x`, `y`, `alive`, `state`) для `actors`/`animals`/`civilians`, а пропы собрать один раз
при старте (они после `createWorld` не двигаются вообще).

Последнее — самое дешёвое и честное: **пропы статичны**, их 473 и они не шевелятся.
Собирать для них записи каждый кадр — чистая работа в мусор.

### 3.4 `ui.update()` — 62 записи в DOM без единой проверки

`ui.js:89-141` вызывается из `frame()` **каждый кадр**. Внутри:

```js
this.hpFill.style.width = `${...}%`;
this.hpText.textContent = `${hp} / ${p.maxHealth}`;
this.stFill.style.width = `${...}%`;
this.stText.textContent = `${Math.ceil(p.stamina)}`;
this.goldEl.textContent = `${state.gold} зм.`;
if (this.repEl) this.repEl.textContent = `Репутация: ${state.reputation || 0}`;
this.phaseEl.textContent = `${phaseLabel(...)}${wet}`;
this.wantedEl.classList.remove("hidden");  // или add
...
```

Итого 62 обращения к DOM за кадр, 3720 за секунду. Каждое `style.width = ...` и
`textContent = ...` — синхронная инвалидация стиля; если между ними случится чтение
layout (а `classList.contains` в геттерах `tradeOpen`/`helpOpen`/... читает), браузер
получит layout thrash. Геттеры оверлеев вызываются **несколько раз за кадр** из
`canControl()`, `updateGame`, `frame`.

Только два места в файле имеют guard:

```js
if (this.objectiveEl.textContent !== text) this.objectiveEl.textContent = text;  // setObjective
if (text !== this.fameText) { ... }                                             // renderFame
```

Остальные 60 — безусловные.

**Почин:** кэшировать последние значения и писать только при изменении.

```js
setText(el, value) {
  if (el && el.__last !== value) { el.__last = value; el.textContent = value; }
}
setWidth(el, value) {
  if (el && el.__last === value) return;
  el.__last = value;
  el.style.width = value;
}
```

Плюс заменить геттеры `get tradeOpen() { return !this.tradeEl.classList.contains("hidden"); }`
на булевы поля, которые выставляются в `open*/close*`. `classList.contains` — это чтение
layout-свойств, и оно сейчас в горячем пути.

Numbers: 62 → ~5 записей в типичном кадре. Это не «микрооптимизация», это разница
между стабильным 60 fps и просадками на слабом железе.

### 3.5 `canStand` — 4.07 µs × ~20 вызовов за кадр

`world.js:924-968`. Линейный перебор:

- 473 пропа (все `solid`) — с проверкой `r+prop.r` для каждого;
- 9 актёров;
- 5 животных;
- 9 гражданских;
- лошади.

За кадр: движение игрока (2 оси) + 9 гражданских (`stepCivilian` → `moveActor` → 2 оси) +
титан (2 оси) + животные, которые двигаются напрямую без `moveActor` (см. ниже) ≈
20–25 вызовов × 4 µs = **80–100 µs/кадр**, около 1% бюджета. Терпимо, но растёт
линейно с числом пропов.

**Архитектурная проблема:** 473 пропа проверяются на каждом шаге, хотя рядом с игроком
их единицы. Сетка 10×10 тайлов с бакетами пропов даст 40 проверок вместо 473 и уберёт
потолок роста. Это не срочно, но это правильная сторона, к которой надо двигаться,
если карта будет расширяться.

**Заодно кое-что важное:** `stepAnimal` (`wildlife.js:132, 148, 173`) двигает животных
**напрямую через `x += ...`, без `moveActor`**. То есть коровы, козы и лисы ходят сквозь
стены и дома. В `AGENTS.md` про титан это уже исправлено («it used to write x/y directly
and walked straight through houses»), а про животных — нет. Это не перф, это логика,
но нашлось по ходу.

### 3.6 `lineOfSight` — 18.27 µs × число стражей за кадр

`world.js:987-999`. Для каждой проверки:

1. Шаг маршем по 0.12 тайла до цели;
2. Затем **линейный проход по всем 389 `blocksSight`-пропам** с `pointSegmentDistance`.

`enemies.js:33` вызывает его из `perceive()` для каждого стража, а `main.js:103`
ещё и дополнительно для `village_guard`. На тире 5 в лагере 6 стражей → ~130 µs/кадр.

**Почин:** тот же пространственный индекс, что и в `canStand`, плюс ранний выход по
дистанции — он уже есть (`if (dist > range) return 0` **до** `lineOfSight`, это правильно).

### 3.7 `hasPath` — O(n²) из-за `queue.shift()`

`world.js:1131`:

```js
const queue = [[startX, startY]];
while (queue.length) {
  const [cx, cy] = queue.shift();   // O(n) на каждом шаге
```

`Array.prototype.shift` — линейный по длине массива. На 200×200 флуд-филле это
O(tiles²). Сейчас `hasPath` используется только в тестах (`tests/world-population.test.js`),
поэтому это не влияет на игру, но тесты из-за этого медленные (23–33 мс на отдельный
кейс). Заменить на индекс-указатель:

```js
let head = 0;
while (head < queue.length) {
  const [cx, cy] = queue[head++];
```

Одна строка, тесты ускоряются, и функция становится пригодной для рантайма.

### 3.8 Рендер: `ctx.filter` на каждый спрайт

`raycaster.js:690-718`:

```js
const canFilter = typeof ctx.filter === "string";
if (canFilter) ctx.filter = `brightness(${spriteLight.toFixed(3)}) saturate(0.9)`;
...
if (canFilter) ctx.filter = "none";
```

Каждый спрайт — смена `filter` дважды. В Chrome `filter` вынуждает отдельный
композитинг-слой на каждый `drawImage`, то есть на кадр создаётся и уничтожается
от 10 до 45 таких слоёв (замер по видимым спрайтам). Плюс `.toFixed(3)` — аллокация
строки на каждый спрайт.

**Дешевле:** заменить `filter` на предзатемнённые спрайты. Освещение квантовано
(`spriteLight` — это множитель), достаточно 8–16 предвычисленных вариантов на спрайт
в `Map`, и `drawImage` без `filter` вообще. Память: 50 спрайтов × 16 уровней × 96×184×4 ≈
56 МБ — слишком много. Альтернатива: один `globalAlpha`-слой поверх — но это меняет вид.
Практичнее: рисовать спрайт один раз в offscreen, применять `filter` **к нему**, затем
`drawImage` без фильтра; пересчитывать при смене уровня освещения (а он меняется медленно —
фаза суток и близость к огню).

Как минимум убрать `.toFixed(3)`: `brightness(${Math.round(spriteLight * 1000) / 1000})`
даёт тот же результат без форматирования строки. Хотя строка всё равно создаётся —
шаблонный литерал. Здесь нужен другой подход целиком.

### 3.9 Загрузка: 49 мс на старте

```
world + textures + sprites init: 48.9 ms
  createWorld      11.25 ms
  buildTextures    30.24 ms
  buildSprites     ~7 ms
```

Один раз при старте, терпимо. Но `buildTextures` — 30 мс блокирующей работы на главном
потоке, до первого кадра. Если когда-нибудь появится стартовый экран с прогрессом,
это первое, что надо будет разнести.

---

## 4. Архитектура

### 4.1 `main.js` — 1749 строк, и в нём всё

Один модуль содержит:

- жизненный цикл рана (`newRun`, `continueRun`, `die`, `restartRun`);
- торговлю (`sellLoot`, `buyUpgrade`, `payFine`, `tradeState`, `priceModifier`);
- контракты (`refreshContracts`, `acceptContract`, `evaluateContract`, `finishContract`);
- боевую систему (`performAttack`, `damagePlayer`, `killActor`, `killAnimal`, `alertNoise`);
- титан (`startTitanDialogue`, `answerTitan`, `titanDeath`, `updateTitan`);
- лошадь (`tryMountHorse`, `dismountHorse`);
- куртизанку (`visitCourtesan`, `payCourtesan`, `askCourtesan`);
- консоль (`openConsole`, `runConsoleCommand`, `consoleHistory`, `cheatContext`);
- советы (`openAdvicePanel`, `objectiveText`);
- игровой цикл (`updateGame`, `frame`, `uiState`);
- отладочную обвязку (`window.__corovans`).

Это не «файл стал большим», это **отсутствие границ**. Любое изменение в торговле
требует прокрутки через боевую систему.

Предлагаемое разбиение (без изменения поведения, только перенос функций):

```
main.js          — точка входа, game-объект, frame(), склейка
run-manager.js   — newRun / continueRun / saveCheckpoint / die / restartRun
combat.js        — уже есть, добавить performAttack / damagePlayer / killActor
titan-panel.js   — диалог с титаном
horse-panel.js   — посадка/спешивание
courtesan-panel.js — панель куртизанки
trade-panel.js   — торговля и штраф
console.js       — консоль и cheatContext
```

Важно: это механический перенос с прокидыванием зависимостей, а не переписывание.
Но у него есть цена — придётся явно передавать `game`/`run`/`player`/`world`/`ui`,
и это вскроет, насколько тесно они связаны (спойлер: очень).

### 4.2 Три источника истины для яркости по фазам суток

Один и тот же концепт — «насколько светло в фазу X» — определён в трёх местах
**с разными значениями**:

```
src/raycaster.js:42   LIGHT_LEVELS = { dawn: 0.82, day: 1, dusk: 0.72, night: 0.45 }
src/lighting.js:6     AMBIENT      = { day: 1, dawn: 0.82, dusk: 0.72, night: 0.34 }
src/daynight.js:15    PHASE_VALUES = { dawn: {light: 0.78}, day: {light: 1},
                                       dusk: {light: 0.72}, night: {light: 0.42} }
```

Ночь: **0.45 / 0.34 / 0.42**. Рассвет: **0.82 / 0.82 / 0.78**. Закат совпадает (0.72),
день совпадает (1).

Применяются так:

- `raycaster.LIGHT_LEVELS[light]` → `this.light` → множитель цвета стен и пола;
- `AMBIENT[phase]` → `buildLightmap(world, AMBIENT[phase], ...)` → базовая яркость лайтмапа;
- `daynight.phaseInfo().light` → в рендер **не попадает вообще** (только `guardSeeing`,
  `price`, `fog` используются).

То есть `PHASE_VALUES.night.light = 0.42` — мёртвое поле, а ночь в игре рисуется
как 0.45 × 0.34 = 0.153 по стенам. Разница 0.45 vs 0.34 — это 30% яркости между
тем, что задумывал автор `daynight.js`, и тем, что видит игрок.

**Почин:** один экспорт, остальные читают его.

```js
// lighting.js
export const PHASE_LIGHT = { dawn: 0.82, day: 1, dusk: 0.72, night: 0.34 };
```

`raycaster.js` берёт оттуда же, `AMBIENT` становится алиасом или удаляется,
`daynight.PHASE_VALUES[*].light` либо удаляется, либо ссылается на ту же таблицу.
Одно число, одна правда.

### 4.3 Два `objective*` — разная логика, разный текст

`main.js:1672` → `objectiveText()` (для HUD, обновляется каждый кадр)
`advice.js:8` → `objectiveOf(state)` (для панели Tab)

Приоритеты **разные**:

```
main.objectiveText:                advice.objectiveOf:
1. activeContract                  1. world.wagonLooted → (inventory / caravan / заказ)
2. !wagonLooted                    2. activeContract
3. inventory.length > 0            3. health < 40%
4. pendingCaravan                  4. "Ограбьте караван"
5. "Возвращайтесь к Мардо"
```

Следствия, которые игрок видит как баг:

- Если обобран фургон **и** взят контракт — HUD пишет «Заказ: …», а панель Tab пишет
  «Возьмите заказ у Мардо»;
- HUD никогда не подсказывает про низкое здоровье, панель — подсказывает;
- HUD добавляет строку «Цель: N зм. · продано на M зм.», панель — нет.

Плюс `advice.js:22` учитывает здоровье, а `main.js` — нет. Два человека (или один
человек в разное время) писали одну функцию.

**Почин:** оставить одну реализацию в `advice.js`, `objectiveText()` в `main.js`
удалить и на HUD звать `objectiveOf(...)` + добавить строку прогресса.

### 4.4 `tuningFor(style, run.tier + 1)` — сигнатура врёт

`style.js:172`:

```js
export function tuningFor(style) { ... }
```

Вызывается **9 раз** с двумя аргументами:

```
main.js:166   tuningFor(run.style, 2)
main.js:188   tuningFor(run.style, run.tier + 1)
main.js:906   ...
main.js:1143  ...
main.js:1221  ...
main.js:1277  ...
main.js:1476  ...
main.js:1588  ...
main.js:1840  ...
```

Второй аргумент молча игнорируется. Читая вызов, невозможно понять, влияет ли тир
на тюнинг (не влияет), а `style.js` выглядит так, будто должен. Либо принять параметр
и использовать, либо убрать из вызовов. Сейчас это ложный интерфейс.

### 4.5 `run` и `game` смешаны

`AGENTS.md` прямо требует: «`run` is the persisted run state; `game` is throwaway
runtime state. Don't mix them». Фактически:

```js
// main.js:1786-1791 — рантайм пишется в сохраняемый объект
run.speedMultiplier = game.speedMultiplier;
run.horseMultiplier = game.mounted ? horseSpeed(...) : 1;
run.mounted = Boolean(game.mounted);
```

`run.mounted` — **мёртвая запись**: записывается каждый кадр, не читается нигде
(проверено grep: чтений нет). `speedMultiplier`/`horseMultiplier` — рантайм-поля
на persisted-объекте; `snapshotRun` их не сохраняет, поэтому после F5 они исчезают
и `player.update` получает `undefined || 1`. Работает случайно.

`player.update(world, input, dt, run, audio)` получает `run` как «state» и читает
оттуда `upgrades`, `speedMultiplier`, `horseMultiplier`, `mounted` — то есть
физика игрока зависит от сейв-структуры. Правильнее передавать узкий объект:

```js
player.update(world, input, dt, {
  upgrades: run.upgrades,
  speedMultiplier: game.speedMultiplier,
  horseMultiplier: ...,
  mounted: Boolean(game.mounted),
}, audio);
```

Тогда `run` перестаёт быть свалкой и `snapshotRun` гарантированно не поймает мусор.

### 4.6 Список оверлеев продублирован в двух местах и рассинхронизирован

`canControl()` (`main.js:139-153`) проверяет 7 флагов:

```
tradeOpen, helpOpen, lootOpen, courtesanOpen, adviceOpen, titanOpen, consoleOpen
```

Escape-цепочка (`main.js:606-613`) — 5, в другом порядке:

```
adviceOpen → courtesanOpen → tradeOpen → helpOpen → lootOpen
```

`titanOpen` и `consoleOpen` в Escape не входят. У консоли свой `Backquote`, это ок.
А вот **панель титана закрыть нельзя вообще** — только ответить. Отсюда два вопроса:
дизайн это или баг, и что будет, если панель останется открытой (двигаться нельзя,
`canControl()` false, а `updateGame` не тикает — игра просто стоит). Если дизайн —
надо написать комментарием, иначе следующий человек решит, что забыли.

**Почин:** один массив-реестр оверлеев, из него генерируются обе ветки.

```js
const OVERLAYS = [
  ["adviceOpen", closeAdvicePanel],
  ["courtesanOpen", leaveCourtesan],
  ["tradeOpen", closeTrade],
  ["helpOpen", closeHelp],
  ["lootOpen", finishLoot],
];
export function canControl() {
  return game.started && !game.paused && ... && !OVERLAYS.some(([k]) => ui[k]);
}
```

Тогда забыть новый оверлей в одном из двух мест станет невозможно — а это ровно тот
класс багов, про который `AGENTS.md` предупреждает («Any new overlay must be added to
`canControl()` **and** to the `Escape` handler»).

### 4.7 Мёртвый код и мёртвые импорты

Импорты, которые нигде не используются в своём модуле (проверено скриптом):

```
src/raycaster.js  → quantize, murkInto, applyGrain, clampChannel
src/main.js       → CHEAT_HELP, TITAN_SCALE, allowsAtMount, HORSE_CAMERA_LIFT,
                    isAnimal, pickCourtesanLine
```

Функции/экспорты, живущие только для тестов (не обязательно удалять, но надо знать):

```
dither.js      murkInto, quantize3, applyGrain
contracts.js   failureIsFinal, contractIdOf
npc.js         rumorCount, pickCourtesanLine, decayOverheal
player.js      get eyeOffset          (1 вхождение = само определение)
inventory.js   weightLeft, canCarry
```

Отдельно: `raycaster.js:325` — `const bayerRow = (y & 3) << 2;` вычисляется в горячем
цикле пола и не используется.

`main.js:96` — два оператора в одной строке:

```js
const canvas = document.getElementById("game");const world = createWorld();
```

`world.js:1` — комментарий «Карта 120×120», а `MAP_W = MAP_H = 200`. Файл вырос,
комментарий отстал.

### 4.8 Магические числа продублированы вместо констант

`horse.js:9` экспортирует `HORSE_CAMERA_LIFT = 20`, а `raycaster.js:210` пишет:

```js
const lift = state.mounted ? 20 : 0;
```

Импорт есть (`main.js:52`), но рендер его не получает — в `raycaster.js` своя двадцатка.
То же с `TITAN_SCALE = 2.4` (`titan.js:12`) и `raycaster.js:630` — `scale: 2.4`.
Меняешь константу — картинка не меняется. Классика.

### 4.9 `world.js` — 1028 строк и три системы координат

В файле одновременно живут:

- абсолютные координаты (`fillAbs`, `addPropAbs`, `ZONES`);
- деревенские координаты со сдвигом `V = 40` (`fillRect`, `addProp`);
- старые 120×120-числа, которые сдвигаются.

`AGENTS.md` предупреждает об этом прямым текстом, и предупреждение честное: смешать
`fillRect` и `fillAbs` — типичная ошибка. Пока код работает, но когнитивная нагрузка
огромная. Долгосрочно: убрать `V` и переписать все деревенские числа в абсолютные
координаты один раз (это механическая замена, покрытая flood-fill тестами из
`tests/world-population.test.js` — они поймают, если что-то замуруется).

### 4.10 Строковые ключи в горячем пути рендера

`raycaster.js:403-430`:

```js
keyStr = `${ray.mapX},${ray.mapY}`;                       // аллокация строки
const tallMul  = world.tallTiles.get(keyStr);
const skinName = world.skinTiles.get(keyStr);
const winName  = world.windowTiles.get(keyStr);
```

Три `Map.get` по строковому ключу на колонку. Кэш `keyX/keyY` помогает (соседние лучи
часто бьют в один тайл), но при повороте камеры тайлы меняются почти каждый столбец.
Плюс три отдельные `Map` на одни и те же координаты.

Чище: один `Map<number, {tall, skin, window}>` с числовым ключом `mapX | (mapY << 16)` —
одна аллокация вместо трёх, числовое хеширование быстрее строкового, и данные о тайле
лежат рядом. Стены сейчас стоят 0.45 мс, так что выигрыш небольшой (~0.1–0.2 мс),
но это ещё и упрощение модели: «у тайла есть свойства» вместо «три параллельные карты».

---

## 5. Что сделано хорошо (чтобы не выглядело, что всё плохо)

Чтобы ты не решил, что ревью — это только список претензий:

- **`ray.js`** — образцовый модуль. Чистая геометрия, `dist = maxDist` на промахе,
  лимит шагов от диагонали карты, покрыт тестами. Именно так и надо.
- **`lighting.js`** — `sampleLight` без замыканий и аллокаций, с явным комментарием
  почему. `buildLightmap` вынесена из кадра. Замеры это подтверждают: 0.142 мс.
- **Детерминизм** — практически весь рандом идёт через `createRng(seed)` и
  `hashSeed`, состояние сохраняется (`rng.state()`), погода выводится из сида.
  `tests/` это проверяет. Это редкость для прототипа.
- **2×2 блоки** в полу/стенах/`finishFrame` — правильное решение с честным
  комментарием «ровно столько детализации, сколько было на 640×360».
- **Отсечка спрайтов по `SPRITE_MAX_DIST`** до сортировки — видно, что урок
  «475 из 496 спрайтов каждый кадр» был усвоен.
- **Слой чистых модулей** отделён от DOM, и это соблюдается: `world`, `ray`, `combat`,
  `economy`, `contracts`, `run`, `style`, `weather` не импортируют ничего браузерного.
  221 тест на это опирается. Держать эту границу — самое ценное в проекте.

---

## 6. План действий по приоритетам

### P0 — баги, видимые игроку

1. **Пол: мерцание освещения** (`raycaster.js:324`) — привязать `useLight` к индексу
   блока, а не к `y % 4`. 15 минут.
2. **Утечка спрайтов куртизанок** (`main.js:295-299`) — удалять свои ключи, добавить
   тест на неувеличение числа ключей. 20 минут.
3. **`audio.rain` каждый кадр** (`main.js:1911` + `audio.js:104`) — guard по изменению
   цели. 10 минут.
4. **Животные ходят сквозь стены** (`wildlife.js:132,148,173`) — принимать `moveActor`
   и `world`, как это уже сделано для титана. 20 минут.

### P1 — производительность с измеримым выигрышем

5. **`finishFrame` через `Uint32Array`** — 4.33 → 3.07 мс (−1.26 мс/кадр, −10% кадра).
   30 минут.
6. **`ui.update()` под guard** — 62 записи → ~5 в типичном кадре. Час.
7. **Оверлеи через булевы поля вместо `classList.contains`** — убрать чтение layout
   из горячего пути. 30 минут.
8. **Пулы/кэш для `drawSprites`** — пропы статичны, собирать один раз. −500 аллокаций
   в кадр. Час.

### P2 — архитектура

9. **Один источник яркости по фазам** (`raycaster` / `lighting` / `daynight`) — убрать
   два дубля, зафиксировать одно число на фазу. Час.
10. **Один `objective*`** — удалить `main.js:objectiveText`, звать `advice.objectiveOf`.
    Полчаса.
11. **`tuningFor`** — либо принять второй аргумент, либо убрать из 9 вызовов. 15 минут.
12. **`run` ↔ `game`** — убрать `run.mounted` (мёртвая запись), рантайм-поля вынести
    в `game`, `player.update` принимает узкий объект. Час.
13. **Реестр оверлеев** вместо двух рассинхронизированных списков. Полчаса.
14. **Мёртвые импорты и функции** — 10 символов в 2 файлах. 15 минут.
15. **Магические числа** — `HORSE_CAMERA_LIFT`, `TITAN_SCALE` в рендер через импорт.
    15 минут.
16. **`hasPath` через индекс вместо `shift()`** — тесты быстрее. 10 минут.

### P3 — структурное

17. **Разбить `main.js`** на 6–8 модулей по областям (см. 4.1). День, механически.
18. **Один `Map` на свойства тайла** вместо трёх строковых карт. Полдня.
19. **Пространственный индекс** для `canStand`/`lineOfSight`. Полдня, если карта будет расти.
20. **Убрать сдвиг `V = 40`** из `world.js` — перевести деревню в абсолютные координаты.
    День, с проверкой flood-fill тестами.

---

## 7. Что нужно тестам

Ревью выявило две регрессии, которые зелёный `npm run verify` пропустил (мерцание пола
и утечку спрайтов). Это не потому, что тесты плохие, а потому что они проверяют
математику, а не кадр. Предложения:

1. **Тест на чередование строк пола.** Взять `renderer.renderFloor` на фейковом буфере
   при двух значениях `horizon`, различающихся на 1, и проверить, что картинка меняется
   предсказуемо (а не «включается/выключается свет»).
2. **Тест на неутечку кэша спрайтов.** Дважды вызвать `updateCourtesanVariant` с разными
   тирами, проверить `Object.keys(renderer.sprites).length`.
3. **Тест «ни один ассет не растёт бесконечно»** — общий guard на `renderer.sprites`,
   который пригодится и для будущих кэшей.
4. **Тест на аудио-параметр**: `rain()` с одинаковой целью дважды не должен вызывать
   `linearRampToValueAtTime` второй раз.

Всё это делается на фейковом 2D-контексте, как уже сделано в `tests/graphics.test.js`
и `tests/intro.test.js`. Инфраструктура есть, ею просто не воспользовались.

---

## Приложение: как воспроизвести замеры

Скрипты лежали во временной папке и в репозиторий не добавлялись. Если нужны постоянно —
их место в `scripts/bench/`, отдельно от `npm run verify`, потому что замеры
нестабильны на CI.

Ключевые вещи, которые надо эмулировать для фейкового контекста:
`createImageData`, `putImageData`, `drawImage`, `measureText`,
`createLinearGradient` (возвращает объект с `addColorStop`), и обязательно
`quadraticCurveTo` / `bezierCurveTo` — иначе `buildSprites()` падает на первой же кривой.
`document.createElement("canvas")` должен возвращать объект с `getContext`, иначе
`sprites.js` и `textures.js` не соберутся.
