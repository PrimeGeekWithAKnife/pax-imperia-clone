/**
 * SfxGenerator — UI sound effects for Ex Nihilo.
 *
 * All sounds are very subtle and procedurally synthesised.
 *
 * Effects:
 *   click         — short soft blip  (sine 800 Hz, 50 ms)
 *   selectSystem  — soft ascending two-tone chime
 *   hover         — barely audible tick (1 ms noise burst)
 *   menuOpen      — low rising tone sweep (200→400 Hz, 200 ms)
 *   menuClose     — reverse of open (400→200 Hz)
 *   speedUp       — quick ascending blip
 *   speedDown     — quick descending blip
 *   error         — low buzz (100 Hz, 100 ms)
 */

import type { AudioEngine } from './AudioEngine';

export class SfxGenerator {
  private engine: AudioEngine;
  private ctx: AudioContext;
  private bus: GainNode;

  constructor(engine: AudioEngine) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.bus = engine.sfxBus;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  playClick(): void {
    this._playSineBurst(800, 0.055, 0.05, 0.02);
  }

  playSelectSystem(): void {
    // Two ascending tones: root + major third
    const now = this.ctx.currentTime;
    this._playToneAt(880, 0.07, now, 0.12, 0.10);
    this._playToneAt(1109, 0.06, now + 0.10, 0.15, 0.12);
  }

  playHover(): void {
    // Barely audible 1 ms noise burst
    this._playNoiseBurst(0.008, 0.001);
  }

  playMenuOpen(): void {
    // 200 → 400 Hz sweep over 200 ms
    this._playFreqSweep(200, 400, 0.045, 0.20);
  }

  playMenuClose(): void {
    // 400 → 200 Hz sweep over 180 ms
    this._playFreqSweep(400, 200, 0.04, 0.18);
  }

  playSpeedUp(): void {
    // Short ascending pair
    const now = this.ctx.currentTime;
    this._playToneAt(600, 0.05, now, 0.06, 0.05);
    this._playToneAt(900, 0.045, now + 0.055, 0.08, 0.06);
  }

  playSpeedDown(): void {
    // Short descending pair
    const now = this.ctx.currentTime;
    this._playToneAt(900, 0.05, now, 0.06, 0.05);
    this._playToneAt(600, 0.045, now + 0.055, 0.08, 0.06);
  }

  playError(): void {
    // Low buzz: 100 Hz sine, square-ish via waveshaper, 100 ms
    this._playSineBurst(100, 0.055, 0.10, 0.04);
  }

  // ── Internal builders ───────────────────────────────────────────────────────

  /**
   * Play a single sine burst:
   *   freq     — frequency in Hz
   *   vol      — peak gain (into SFX bus, already attenuated)
   *   sustain  — seconds at full volume
   *   release  — fade-out duration in seconds
   */
  private _playSineBurst(freq: number, vol: number, sustain: number, release: number): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol, now + 0.005);
    env.gain.setValueAtTime(vol, now + sustain);
    env.gain.exponentialRampToValueAtTime(0.0001, now + sustain + release);

    osc.connect(env);
    env.connect(this.bus);
    osc.start(now);
    osc.stop(now + sustain + release + 0.02);
    osc.onended = () => env.disconnect();
  }

  /**
   * Play a tone at a specific time, with given parameters.
   */
  private _playToneAt(
    freq: number,
    vol: number,
    startTime: number,
    sustain: number,
    release: number,
  ): void {
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(vol, startTime + 0.005);
    env.gain.setValueAtTime(vol, startTime + sustain);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + sustain + release);

    osc.connect(env);
    env.connect(this.bus);
    osc.start(startTime);
    osc.stop(startTime + sustain + release + 0.02);
    osc.onended = () => env.disconnect();
  }

  /**
   * Sweep from startFreq to endFreq over duration seconds.
   */
  private _playFreqSweep(startFreq: number, endFreq: number, vol: number, duration: number): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const fadeIn = 0.008;
    const fadeOut = 0.04;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.linearRampToValueAtTime(endFreq, now + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(vol, now + fadeIn);
    env.gain.setValueAtTime(vol, now + duration - fadeOut);
    env.gain.linearRampToValueAtTime(0, now + duration);

    osc.connect(env);
    env.connect(this.bus);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    osc.onended = () => env.disconnect();
  }

  /**
   * Very short noise burst for hover tick.
   *   vol      — peak gain
   *   duration — seconds
   */
  private _playNoiseBurst(vol: number, duration: number): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufLen = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const env = ctx.createGain();
    env.gain.value = vol;

    src.connect(env);
    env.connect(this.bus);
    src.start(now);
    src.onended = () => env.disconnect();
  }
}
