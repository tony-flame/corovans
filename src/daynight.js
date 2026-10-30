// Сутки: фаза влияет на рендер, обзор стражи и цены скупщика.

export const PHASE = {
  DAWN: "dawn",
  DAY: "day",
  DUSK: "dusk",
  NIGHT: "night",
};

export const PHASE_ORDER = [PHASE.DAWN, PHASE.DAY, PHASE.DUSK, PHASE.NIGHT];

// Полный цикл в игровых секундах.
export const CYCLE_LENGTH = 240;

const PHASE_VALUES = {
  dawn: { light: 0.78, label: "Рассвет", guardSeeing: 0.9, price: 0.95, fog: 0.85 },
  day: { light: 1, label: "День", guardSeeing: 1, price: 1, fog: 1 },
  dusk: { light: 0.72, label: "Закат", guardSeeing: 0.95, price: 1.1, fog: 1.15 },
  night: { light: 0.42, label: "Ночь", guardSeeing: 0.62, price: 1.25, fog: 1.6 },
};

// Начало каждой фазы в долях цикла.
const PHASE_START = {
  dawn: 0,
  day: 0.15,
  dusk: 0.55,
  night: 0.72,
};

export function normalizeTime(time) {
  const wrapped = time % CYCLE_LENGTH;
  return wrapped < 0 ? wrapped + CYCLE_LENGTH : wrapped;
}

export function phaseOf(time) {
  const t = normalizeTime(time) / CYCLE_LENGTH;
  if (t < PHASE_START.day) return PHASE.DAWN;
  if (t < PHASE_START.dusk) return PHASE.DAY;
  if (t < PHASE_START.night) return PHASE.DUSK;
  return PHASE.NIGHT;
}

export function phaseInfo(phase) {
  return PHASE_VALUES[phase] || PHASE_VALUES.day;
}

export function phaseLabel(phase) {
  return phaseInfo(phase).label;
}

export function advance(time, dt) {
  return normalizeTime(time + dt);
}

// Ночь: меньше света, стража видит хуже, но товар дороже.
export function lightOf(time) {
  return phaseInfo(phaseOf(time)).light;
}

export function pricesAt(time) {
  return phaseInfo(phaseOf(time)).price;
}

// Через сколько игровых секунд наступит нужная фаза.
export function secondsUntilPhase(time, target) {
  const start = PHASE_START[target];
  if (start === undefined) return 0;
  const t = normalizeTime(time) / CYCLE_LENGTH;
  const delta = (start - t + 1) % 1;
  return delta === 0 ? CYCLE_LENGTH : delta * CYCLE_LENGTH;
}
