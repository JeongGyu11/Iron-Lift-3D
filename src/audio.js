// Web Audio API Synthesizer - Realistic Gym SFX & Dynamic Synth BGM
class GymAudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.bgmPlaying = false;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.bgmBpm = 128;
    this.pumpLevel = 0; // 0 to 1
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // --- SOUND EFFECTS ---

  // Barbell Metallic Clank (Deep heavy steel resonance)
  playBarbellClank(weightKg = 100, intensity = 1.0) {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // Pitch shifts lower for heavier weights
    const baseFreq = Math.max(90, 260 - (weightKg * 0.7));

    // Metallic ring (dual bandpass filtered noise + resonant sine)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.6, now + 0.35);

    oscGain.gain.setValueAtTime(0.4 * intensity, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);

    // Overtones for clinking plates
    [1.8, 2.76, 4.15].forEach((multiplier, i) => {
      const harm = this.ctx.createOscillator();
      const harmGain = this.ctx.createGain();
      harm.type = 'sine';
      harm.frequency.setValueAtTime(baseFreq * multiplier, now);
      harmGain.gain.setValueAtTime(0.2 * intensity / (i + 1), now);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25 + i * 0.1);

      harm.connect(harmGain);
      harmGain.connect(this.ctx.destination);
      harm.start(now);
      harm.stop(now + 0.4);
    });

    // Sub-thud
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(80, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.2);
    subGain.gain.setValueAtTime(0.5 * intensity, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.3);
  }

  // Heavy lock-out boom
  playLockoutBoom() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);

    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  // Heartbeat thump for Sticking Point tension
  playHeartbeat(rateMultiplier = 1.0) {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const playThump = (time, freq, vol) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(25, time + 0.12);

      gain.gain.setValueAtTime(vol, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(time);
      osc.stop(time + 0.15);
    };

    // Lub-dub
    playThump(now, 75 * rateMultiplier, 0.7);
    playThump(now + 0.12, 65 * rateMultiplier, 0.45);
  }

  // Chalk slap sound
  playChalkSlap() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.03));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(1.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // Ammonia sniff / Rush burst
  playAmmoniaRush() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    // High whoosh sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.3);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(400, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  // Grunt / Exertion sound (Vocal synth)
  playGrunt() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110 + Math.random() * 30, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.25);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(550, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Metronome tick (bench rhythm, grip alert)
  playTick(strong = false) {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(strong ? 1760 : 1320, now);
    gain.gain.setValueAtTime(strong ? 0.12 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Failure / Pin buzz
  playFailure() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    [220, 207, 196, 175].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.15);

      gain.gain.setValueAtTime(0.3, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.2);
    });
  }

  // PR Celebration Fanfare
  playPRCelebration() {
    if (this.isMuted) return;
    this.init();
    const now = this.ctx.currentTime;

    const chords = [
      [261.63, 329.63, 392.00], // C
      [329.63, 392.00, 523.25], // E min
      [349.23, 440.00, 523.25], // F
      [392.00, 493.88, 587.33, 783.99] // G power
    ];

    chords.forEach((chord, step) => {
      const startTime = now + step * 0.22;
      chord.forEach(freq => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    });
  }

  // --- DYNAMIC PROCEDURAL SYNTH BGM ---
  // Energetic driving gym beat (Kick + Bass + Arp)
  startBGM() {
    if (this.bgmPlaying) return;
    this.init();
    this.bgmPlaying = true;
    this.bgmStep = 0;

    const stepIntervalMs = (60 / this.bgmBpm / 4) * 1000; // 16th notes

    const bassNotes = [36, 36, 48, 36, 39, 36, 41, 42]; // MIDI notes (C1, Eb1, F1, F#1...)
    const arpNotes = [60, 63, 67, 70, 72, 75, 72, 67];

    this.bgmTimer = setInterval(() => {
      if (this.isMuted || !this.bgmPlaying) return;
      const now = this.ctx.currentTime;
      const step = this.bgmStep % 16;

      // 1. Kick on beats 0, 4, 8, 12
      if (step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(140, now);
        kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.08);

        kickGain.gain.setValueAtTime(0.4, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        kickOsc.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.15);
      }

      // 2. Hi-hat on offbeats
      if (step % 2 === 1) {
        const bufferSize = this.ctx.sampleRate * 0.03;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(8000, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08 + this.pumpLevel * 0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
      }

      // 3. Synth Bassline
      if (step % 2 === 0) {
        const noteIndex = Math.floor(step / 2);
        const midi = bassNotes[noteIndex % bassNotes.length];
        const freq = 440 * Math.pow(2, (midi - 69) / 12);

        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(freq, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300 + this.pumpLevel * 500, now);

        bassGain.gain.setValueAtTime(0.12, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        bassOsc.connect(filter);
        filter.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.16);
      }

      // 4. Pump mode Arpeggiator (active when pump level is high)
      if (this.pumpLevel > 0.3 && step % 2 === 1) {
        const midi = arpNotes[step % arpNotes.length];
        const freq = 440 * Math.pow(2, (midi - 69) / 12);

        const arpOsc = this.ctx.createOscillator();
        const arpGain = this.ctx.createGain();
        arpOsc.type = 'sine';
        arpOsc.frequency.setValueAtTime(freq, now);

        arpGain.gain.setValueAtTime(0.08 * this.pumpLevel, now);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        arpOsc.connect(arpGain);
        arpGain.connect(this.ctx.destination);
        arpOsc.start(now);
        arpOsc.stop(now + 0.1);
      }

      this.bgmStep++;
    }, stepIntervalMs);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  setPumpLevel(val) {
    this.pumpLevel = Math.max(0, Math.min(1, val));
  }
}

export const sound = new GymAudioEngine();
