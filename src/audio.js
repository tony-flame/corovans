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
    }

    const target = on ? 0.05 + intensity * 0.09 : 0;
    this.rainNode.gain.gain.cancelScheduledValues(now);
    this.rainNode.gain.gain.linearRampToValueAtTime(target, now + 1.2);
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

  death() {
    this.tone(180, 0.8, "sawtooth", 0.12, 50);
  }
}
