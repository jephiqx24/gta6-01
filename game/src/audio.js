// Sound, synthesised with WebAudio only — no audio files. Engine hum,
// sirens, blips, jingles, thuds and gunshots, all built from oscillators
// and filtered noise. The context starts on the first user gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
  }

  /** Create the context (call from a user gesture). */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.16;
    this.master.connect(this.ctx.destination);
    // Engine hum: sawtooth through a lowpass, pitch follows speed.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Siren: a square wave that alternates two tones.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    let high = false;
    this.sirenTimer = setInterval(() => {
      if (!this.ctx || this.sirenGain.gain.value <= 0) return;
      high = !high;
      this.sirenOsc.frequency.setTargetAtTime(high ? 960 : 660, this.ctx.currentTime, 0.05);
    }, 320);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.16;
  }

  /** Engine hum follows speed 0..1 (0 = silent). */
  setEngine(speed01) {
    if (!this.ctx || this.muted) return;
    this.engineGain.gain.setTargetAtTime(speed01 * 0.5, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 145, this.ctx.currentTime, 0.08);
  }

  /** Siren on/off with loudness 0..1. */
  setSiren(on, loudness = 0.5) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on && !this.muted ? loudness * 0.14 : 0, this.ctx.currentTime, 0.1);
  }

  blip(freq = 880, dur = 0.12, type = 'sine', vol = 0.5) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  /** Short two-note pickup blip. */
  pickup() {
    this.blip(880, 0.09);
    setTimeout(() => this.blip(1318, 0.14), 70);
  }

  /** Mission-complete jingle: four rising notes. */
  jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 'triangle', 0.55), i * 110));
  }

  /** Low thud: filtered noise burst. */
  thud(vol = 0.8) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.22;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  /** Gunshot: short noise crack + low thump. */
  gunshot() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const dur = 0.12;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 900;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.9;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    this.thud(0.35);
  }

  /** Police radio chirp when wanted rises. */
  radio() {
    this.blip(1200, 0.06, 'square', 0.25);
    setTimeout(() => this.blip(900, 0.06, 'square', 0.25), 90);
    setTimeout(() => this.blip(1200, 0.06, 'square', 0.25), 180);
  }
}
