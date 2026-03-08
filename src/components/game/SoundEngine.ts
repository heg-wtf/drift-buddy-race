// Web Audio API sound engine for the racing game
class SoundEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;

  private getMasterGain(): GainNode {
    const ctx = this.getCtx();
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0; // default OFF
      this.masterGain.connect(ctx.destination);
    }
    return this.masterGain;
  }

  setMasterVolume(vol: number) {
    const gain = this.getMasterGain();
    gain.gain.setValueAtTime(vol, this.getCtx().currentTime);
  }

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  startEngine() {
    if (this.isPlaying) return;
    const ctx = this.getCtx();
    
    this.engineOsc = ctx.createOscillator();
    this.engineGain = ctx.createGain();
    
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;
    this.engineGain.gain.value = 0.06;
    
    this.engineOsc.connect(this.engineGain);
    this.engineGain.connect(this.getMasterGain());
    this.engineOsc.start();
    this.isPlaying = true;
  }

  updateEngine(speed: number) {
    if (!this.engineOsc || !this.engineGain) return;
    // Map speed (0-250) to frequency (80-400)
    const freq = 80 + (speed / 250) * 320;
    this.engineOsc.frequency.setTargetAtTime(freq, this.getCtx().currentTime, 0.1);
    // Volume based on speed
    const vol = 0.03 + (speed / 250) * 0.08;
    this.engineGain.gain.setTargetAtTime(vol, this.getCtx().currentTime, 0.1);
  }

  stopEngine() {
    if (this.engineOsc && this.isPlaying) {
      try { this.engineOsc.stop(); } catch (_) {}
      this.engineOsc = null;
      this.engineGain = null;
      this.isPlaying = false;
    }
  }

  playCollision() {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const noise = ctx.createOscillator();
    const noiseGain = ctx.createGain();
    
    // Impact sound
    osc.type = 'square';
    osc.frequency.value = 150;
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.getMasterGain());
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    
    // Crunch noise
    noise.type = 'sawtooth';
    noise.frequency.value = 800;
    noise.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
    noiseGain.gain.value = 0.1;
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    noise.connect(noiseGain);
    noiseGain.connect(this.getMasterGain());
    noise.start();
    noise.stop(ctx.currentTime + 0.3);
  }

  playCountdownBeep(final: boolean = false) {
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = final ? 1000 : 600;
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (final ? 0.8 : 0.3));
    
    osc.connect(gain);
    gain.connect(this.getMasterGain());
  }

  playDestroy() {
    const ctx = this.getCtx();
    // Explosion-like sound
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 200 - i * 50;
      osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.8);
      gain.gain.value = 0.15;
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
      osc.connect(gain);
      gain.connect(this.getMasterGain());
      osc.start(ctx.currentTime + i * 0.05);
      osc.stop(ctx.currentTime + 1);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  dispose() {
    this.stopEngine();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const soundEngine = new SoundEngine();
