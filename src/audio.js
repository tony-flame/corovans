// Синтезированный звук: без внешних файлов.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);

    const length = this.ctx.sampleRate * 0.6;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  tone(freq, duration, type = "sine", gain = 0.15, endFreq = null) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise(duration, gain = 0.15, filterFreq = 1200, q = 0.8) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter).connect(env).connect(this.master);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  step(crouch = false) {
    this.noise(0.08, crouch ? 0.035 : 0.075, crouch ? 500 : 260, 1.2);
  }

  swing() {
    this.noise(0.16, 0.12, 1800, 1.4);
    this.tone(220, 0.12, "triangle", 0.04, 90);
  }

  hit() {
    this.noise(0.12, 0.18, 420, 0.9);
    this.tone(95, 0.18, "square", 0.1, 45);
  }

  // Шум дождя: ровный слой, плавно включается.
  rain(on, intensity = 0.5) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (!this.rainNode) {
      const length = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 900;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();

      this.rainNode = { src, gain };
      this.rainTarget = 0;
    }

    const target = on ? 0.05 + intensity * 0.09 : 0;
    // Раньше эта функция вызывалась каждый кадр (60 раз/сек) и каждый раз
    // отменяла и создавала события автоматизации AudioParam. Отсюда
    // дрожание громкости и мусор в планировщике. Теперь — только по изменению.
    if (Math.abs(target - (this.rainTarget ?? -1)) < 0.005) return;
    this.rainTarget = target;

    this.rainNode.gain.gain.cancelScheduledValues(now);
    this.rainNode.gain.gain.setTargetAtTime(target, now, 0.5);
  }

  // Металлический лязг блока: короткий звон + шум удара по стали.
  block() {
    this.tone(1180, 0.09, "triangle", 0.1, 900);
    this.tone(760, 0.14, "square", 0.06, 620);
    this.noise(0.08, 0.12, 3200, 2.4);
  }

  // Чавканье: короткий низкий шум.
  eat() {
    this.noise(0.12, 0.09, 480, 0.7);
    this.tone(120, 0.1, "triangle", 0.05, 90);
  }

  // Крик зверя: разный тон по виду.
  beast(kind) {
    if (kind === "fox") {
      this.tone(720, 0.12, "sawtooth", 0.07, 480);
    } else if (kind === "goat") {
      this.tone(520, 0.16, "triangle", 0.08, 380);
    } else {
      this.tone(180, 0.35, "sawtooth", 0.09, 120);
    }
  }

  // Рычание стража при обнаружении: низкое, раскатистое.
  guardGrowl() {
    this.tone(115, 0.42, "sawtooth", 0.11, 72);
    this.noise(0.3, 0.08, 260, 0.6);
    setTimeout(() => this.tone(98, 0.22, "sawtooth", 0.08, 60), 160);
  }

  // Попадание по стражу: хрип и лязг доспеха.
  guardHit() {
    this.noise(0.13, 0.16, 520, 0.9);
    this.tone(150, 0.16, "square", 0.09, 85);
    this.tone(880, 0.06, "triangle", 0.05, 620);
  }

  // Смерть стража: падение и последний выдох.
  guardDeath() {
    this.tone(180, 0.5, "sawtooth", 0.1, 55);
    this.noise(0.35, 0.1, 300, 0.7);
    setTimeout(() => this.noise(0.22, 0.14, 180, 0.9), 200);
  }

  // Тяжёлые шаги стражи: редко, тихо, чтобы не раздражать.
  // dist — расстояние до игрока: вблизи громче, дальше почти не слышно.
  guardStep(dist = 6) {
    const k = Math.max(0.12, Math.min(1, 1 - (dist - 2) / 12));
    this.noise(0.07, 0.05 * k, 220, 1.4);
  }

  hurt() {
    this.tone(140, 0.3, "sawtooth", 0.12, 60);
    this.noise(0.15, 0.1, 300, 0.7);
  }

  coin() {
    this.tone(880, 0.09, "sine", 0.09);
    setTimeout(() => this.tone(1320, 0.12, "sine", 0.07), 70);
  }

  alert() {
    this.tone(520, 0.14, "square", 0.08);
    setTimeout(() => this.tone(390, 0.2, "square", 0.08), 130);
  }

  steal() {
    this.noise(0.4, 0.06, 900, 0.6);
  }

  ui() {
    this.tone(600, 0.05, "triangle", 0.05);
  }

  victory() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this.tone(f, 0.35, "triangle", 0.09), i * 130));
  }

  // ── Фоновая музыка ──────────────────────────────────────────────
  // Процедурная, как и весь звук: ни одного файла. Три слоя —
  // бурдон (низкая выдержанная нота), пентатоника (редкие колокольчики)
  // и шумовой воздух. Набор и темп зависят от фазы суток и места.
  //
  // Всё держится на планировщике AudioParam: ноты ставятся заранее,
  // без setTimeout — иначе при потере фокуса ритм разъезжается.

  // Таблицы: фаза → параметры. Минор ночью, мажор днём.
  musicProfile(phase, inTown) {
    const base = {
      // Корневая нота бурдона. Ночь ниже — тревожнее.
      root: 110,
      // Интервал квинты: 1.5 — чистая квинта, 1.335 — тритон (злее).
      fifth: 1.5,
      // Доля от мастера. Музыка тише эффектов всегда.
      level: 0.055,
      // Секунд между «колокольчиками».
      bellEvery: 4.5,
      // Пентатоника: полутоны от корня, применяются с множителем 2^k.
      scale: [0, 3, 5, 7, 10],
      brightness: 1200,
    };

    if (phase === "night") {
      base.root = 82;
      base.level = 0.05;
      base.bellEvery = 6.5;
      base.scale = [0, 3, 5, 7, 10];
      base.fifth = 1.335;
      base.brightness = 700;
    } else if (phase === "dusk") {
      base.root = 98;
      base.level = 0.052;
      base.bellEvery = 5.2;
      base.fifth = 1.5;
      base.brightness = 900;
    } else if (phase === "dawn") {
      base.root = 123;
      base.level = 0.05;
      base.bellEvery = 5.5;
      base.fifth = 1.5;
      base.brightness = 1400;
    } else {
      base.root = 131;
      base.level = 0.048;
      base.bellEvery = 4.2;
      base.fifth = 1.5;
      base.brightness = 1700;
    }

    // В деревне спокойнее и светлее, в дороге — реже и темнее.
    if (!inTown) {
      base.bellEvery *= 1.4;
      base.level *= 0.85;
      base.brightness *= 0.8;
    }
    return base;
  }

  // Запуск или смена настроения. Повторный вызов с теми же параметрами
  // ничего не делает: иначе планировщик забивается ramp'ами (та же беда,
  // что была у rain).
  music(phase = "day", inTown = true) {
    if (!this.ctx) return;
    const profile = this.musicProfile(phase, inTown);
    const key = `${phase}:${inTown ? "town" : "road"}`;
    if (this.musicKey === key) return;
    this.musicKey = key;

    if (!this.musicNode) this.startMusic();
    if (!this.musicNode) return;

    const now = this.ctx.currentTime;
    const { drone, droneFifth, gain, filter } = this.musicNode;

    // Плавный переход: старые ноты гаснут, новые входят.
    drone.frequency.cancelScheduledValues(now);
    drone.frequency.setTargetAtTime(profile.root, now, 1.5);
    droneFifth.frequency.cancelScheduledValues(now);
    droneFifth.frequency.setTargetAtTime(profile.root * profile.fifth, now, 2.2);
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setTargetAtTime(profile.brightness, now, 2);

    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(profile.level, now, 2.5);

    this.musicProfileNow = profile;
  }

  startMusic() {
    if (!this.ctx || this.musicNode) return;

    const drone = this.ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 110;

    const droneFifth = this.ctx.createOscillator();
    droneFifth.type = "sine";
    droneFifth.frequency.value = 165;

    // Третий голос — субоктава: даёт «вес» без громкости.
    const sub = this.ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 55;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    filter.Q.value = 0.6;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    // Медленное «дыхание» громкости, чтобы бурдон не был мёртвым.
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    // Бурдон чуть расстроен — это даёт живое биение.
    drone.detune.value = -6;
    droneFifth.detune.value = 7;

    drone.connect(filter);
    droneFifth.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    drone.start();
    droneFifth.start();
    sub.start();
    lfo.start();

    this.musicNode = { drone, droneFifth, sub, filter, gain, lfo, lfoGain };
    this.nextBellAt = this.ctx.currentTime + 3;
  }

  // Колокольчики по пентатонике. Вызывается из кадра, сам решает,
  // пора ли ставить следующую ноту.
  stepMusic(phase, inTown) {
    if (!this.ctx) return;
    // music() создаёт узлы при первом вызове. Проверять musicNode ДО него
    // было ошибкой: он ещё не существует, и музыка не запускалась никогда.
    this.music(phase, inTown);
    if (!this.musicNode) return;

    const profile = this.musicProfileNow || this.musicProfile(phase, inTown);
    const now = this.ctx.currentTime;
    if (!this.nextBellAt) this.nextBellAt = now + 2;
    if (now < this.nextBellAt) return;

    // Детерминированная мелодия: шаг по пентатонике от номера ноты.
    this.bellIndex = (this.bellIndex || 0) + 1;
    const idx = this.bellIndex;
    const step = profile.scale[idx % profile.scale.length];
    const octave = 2 + ((idx * 7) % 3); // 2..4 октавы
    const freq = profile.root * Math.pow(2, octave) * Math.pow(2, step / 12);

    // Каждый пятый колокольчик — пауза: мелодия не должна строчиться.
    if (idx % 5 !== 0) this.bellTone(freq, profile.level * 1.6);

    // Небольшой джиттер интервала, чтобы ритм не был метрономом.
    const jitter = ((idx * 37) % 100) / 100;
    this.nextBellAt = now + profile.bellEvery * (0.6 + jitter * 0.8);
  }

  bellTone(freq, gain) {
    if (!this.ctx || !this.musicNode) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    // Второй обертон — колокольчик, а не синус.
    const over = this.ctx.createOscillator();
    over.type = "sine";
    over.frequency.value = freq * 2.01;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(gain, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);

    const overEnv = this.ctx.createGain();
    overEnv.gain.setValueAtTime(0.0001, now);
    overEnv.gain.exponentialRampToValueAtTime(gain * 0.35, now + 0.015);
    overEnv.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

    osc.connect(env).connect(this.musicNode.filter);
    over.connect(overEnv).connect(this.musicNode.filter);
    osc.start(now);
    over.start(now);
    osc.stop(now + 2.5);
    over.stop(now + 1.2);
  }

  // Выключить музыку (пауза, смерть, финал).
  // Guard по ключу: без него на паузе setTargetAtTime планировался
  // 60 раз в секунду — ровно та же беда, что была у rain().
  musicStop(fade = 1.2) {
    if (!this.ctx || !this.musicNode) return;
    if (this.musicKey === null) return;
    const now = this.ctx.currentTime;
    this.musicNode.gain.gain.cancelScheduledValues(now);
    this.musicNode.gain.gain.setTargetAtTime(0, now, fade);
    this.musicKey = null;
  }

  death() {
    this.tone(180, 0.8, "sawtooth", 0.12, 50);
  }
}
