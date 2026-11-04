// Контейнер изменяемого состояния игры.
//
// Зачем он нужен. В ES-модулях импорт читается один раз при загрузке,
// а `run`, `profile` и `rng` в main.js переприсваиваются (новый забег,
// загрузка сейва, смерть). Модуль, который сделал `import { run }`,
// после `run = loaded.run` продолжал бы видеть старый объект — то есть
// молча работал бы с мёртвым состоянием.
//
// Здесь те же ЖИВЫЕ ссылки, только через геттеры: `state.run` всегда
// отдаёт текущее значение, потому что читает замыкание. Так логику
// можно выносить из main.js, не переписывая 800 обращений к `run`.
//
// Что НЕ хранится здесь: производные значения и флаги интерфейса.
// Контейнер — про то, что «принадлежит игре», а не про кэш кадра.

export function createState() {
  // Живые ячейки. Снаружи они доступны только через геттеры/сеттеры,
  // поэтому случайно перезаписать всю ссылку не получится.
  let run = null;
  let profile = null;
  let rng = null;
  let ui = null;
  let saved = null;

  // Рантайм: не сохраняется, живёт до перезагрузки страницы.
  const game = {
    started: false,
    paused: false,
    gameOver: false,
    victoryShown: false,
    uiOpen: false,
    haggleRolled: 0,
    stealing: false,
    stealProgress: 0,
    noiseTimer: 0,
    noiseLevel: 0,
    weather: null,
    godMode: false,
    noclip: false,
    speedMultiplier: 1,
    mounted: null,
    horseRef: null,
    consoleHistory: [],
    consoleHistoryIndex: -1,
    time: 0,
    lastAlertMsg: -99,
    contractTimeLeft: null,
    lootBuffer: null,
    lootSecondWagon: false,
    suspicion: 0,
    chasing: false,
    tracks: [],
    trackTimer: 0,
    lastTrackX: null,
    lastTrackY: null,
    dialog: null,
    activeCourtesan: null,
    courtesanRumorUsed: false,
  };

  const state = {
    get run() {
      return run;
    },
    set run(value) {
      run = value;
    },

    get profile() {
      return profile;
    },
    set profile(value) {
      profile = value;
    },

    get rng() {
      return rng;
    },
    set rng(value) {
      rng = value;
    },

    get ui() {
      return ui;
    },
    set ui(value) {
      ui = value;
    },

    get saved() {
      return saved;
    },
    set saved(value) {
      saved = value;
    },

    // game — постоянный объект, поэтому просто ссылка.
    game,
  };

  return state;
}
