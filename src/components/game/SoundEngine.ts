// Web Audio API sound engine — audio file based engine + synthesized effects
class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;

  // Audio file engine
  private engineBuffer: AudioBuffer | null = null;
  private engineSource: AudioBufferSourceNode | null = null;
  private engineGain: GainNode | null = null;
  private bufferLoaded = false;

  private getMasterGain(): GainNode {
    const ctx = this.getCtx();
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0; // default OFF
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  setMasterVolume(volume: number) {
    const gain = this.getMasterGain();
    gain.gain.setValueAtTime(volume, this.getCtx().currentTime);
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  // Load engine audio file
  async loadEngineSound(url: string) {
    try {
      const ctx = this.getCtx();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.engineBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.bufferLoaded = true;
    } catch (error) {
      console.warn(
        "Failed to load engine sound, falling back to synthesizer:",
        error,
      );
      this.bufferLoaded = false;
    }
  }

  startEngine() {
    if (this.isPlaying) return;
    const ctx = this.getCtx();
    const master = this.getMasterGain();

    if (this.bufferLoaded && this.engineBuffer) {
      // Audio file based engine
      this.engineSource = ctx.createBufferSource();
      this.engineSource.buffer = this.engineBuffer;
      this.engineSource.loop = true;
      this.engineSource.playbackRate.value = 0.6; // idle pitch

      this.engineGain = ctx.createGain();
      this.engineGain.gain.value = 0.3;

      this.engineSource.connect(this.engineGain);
      this.engineGain.connect(master);
      this.engineSource.start();
    }

    this.isPlaying = true;
  }

  updateEngine(speed: number) {
    if (!this.isPlaying) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const ratio = speed / 250; // 0 to 1

    if (this.engineSource && this.engineGain) {
      // playbackRate: 0.6 (idle) → 2.5 (max rev) — pitch shifts the sample
      const rate = 0.6 + ratio * 1.9;
      this.engineSource.playbackRate.setTargetAtTime(rate, now, 0.08);

      // Volume: louder at higher speed
      const volume = 0.25 + ratio * 0.55;
      this.engineGain.gain.setTargetAtTime(volume, now, 0.08);
    }
  }

  stopEngine() {
    if (this.isPlaying) {
      if (this.engineSource) {
        try {
          this.engineSource.stop();
        } catch (_) {
          /* already stopped */
        }
        this.engineSource = null;
        this.engineGain = null;
      }
      this.isPlaying = false;
    }
  }

  playCollision() {
    const ctx = this.getCtx();
    const master = this.getMasterGain();
    const now = ctx.currentTime;

    const impactOscillator = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impactOscillator.type = "square";
    impactOscillator.frequency.value = 150;
    impactOscillator.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    impactGain.gain.value = 0.2;
    impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    impactOscillator.connect(impactGain);
    impactGain.connect(master);
    impactOscillator.start();
    impactOscillator.stop(now + 0.4);

    const crunchOscillator = ctx.createOscillator();
    const crunchGain = ctx.createGain();
    crunchOscillator.type = "sawtooth";
    crunchOscillator.frequency.value = 800;
    crunchOscillator.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    crunchGain.gain.value = 0.1;
    crunchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    crunchOscillator.connect(crunchGain);
    crunchGain.connect(master);
    crunchOscillator.start();
    crunchOscillator.stop(now + 0.3);
  }

  playCountdownBeep(final: boolean = false) {
    const ctx = this.getCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = final ? 1000 : 600;
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + (final ? 0.8 : 0.3),
    );

    oscillator.connect(gain);
    gain.connect(this.getMasterGain());
    oscillator.start();
    oscillator.stop(ctx.currentTime + (final ? 0.8 : 0.3));
  }

  playDestroy() {
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const master = this.getMasterGain();

    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 200 - i * 50;
      oscillator.frequency.exponentialRampToValueAtTime(20, now + 0.8);
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + i * 0.05);
      oscillator.stop(now + 1);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  dispose() {
    this.stopEngine();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch (_) {
        /* already closed */
      }
      this.ctx = null;
      this.masterGain = null;
    }
  }
}

export const soundEngine = new SoundEngine();
