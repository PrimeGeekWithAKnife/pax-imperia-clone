/**
 * AudioEngine — central Web Audio API manager for Ex Nihilo.
 *
 * All audio is procedurally synthesised; no external files are loaded.
 * Stored on window.__EX_NIHILO_AUDIO__ so React and Phaser scenes can share
 * a single instance.
 *
 * Volume defaults:
 *   master  0.3  (space is quiet)
 *   music   0.4
 *   sfx     0.5
 *   ambient 0.3
 */

export class AudioEngine {
  readonly ctx: AudioContext;

  private masterGain: GainNode;
  private _musicGain: GainNode;
  private _sfxGain: GainNode;
  private _ambientGain: GainNode;

  /** Whether the AudioContext has been successfully resumed after a user gesture. */
  private _resumed = false;

  constructor() {
    this.ctx = new AudioContext();

    // Master bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);

    // Sub-buses
    this._musicGain = this.ctx.createGain();
    this._musicGain.gain.value = 0.4;
    this._musicGain.connect(this.masterGain);

    this._sfxGain = this.ctx.createGain();
    this._sfxGain.gain.value = 0.5;
    this._sfxGain.connect(this.masterGain);

    this._ambientGain = this.ctx.createGain();
    this._ambientGain.gain.value = 0.3;
    this._ambientGain.connect(this.masterGain);

    // If the context starts suspended (very common), it will be resumed on the
    // first user interaction via resume().
  }

  // ── Public accessors ────────────────────────────────────────────────────────

  get musicBus(): GainNode {
    return this._musicGain;
  }

  get sfxBus(): GainNode {
    return this._sfxGain;
  }

  get ambientBus(): GainNode {
    return this._ambientGain;
  }

  // ── Volume controls ─────────────────────────────────────────────────────────

  setMasterVolume(v: number): void {
    this.masterGain.gain.setTargetAtTime(clamp01(v), this.ctx.currentTime, 0.05);
  }

  setMusicVolume(v: number): void {
    this._musicGain.gain.setTargetAtTime(clamp01(v), this.ctx.currentTime, 0.05);
  }

  setSfxVolume(v: number): void {
    this._sfxGain.gain.setTargetAtTime(clamp01(v), this.ctx.currentTime, 0.05);
  }

  setAmbientVolume(v: number): void {
    this._ambientGain.gain.setTargetAtTime(clamp01(v), this.ctx.currentTime, 0.05);
  }

  // ── Autoplay policy ─────────────────────────────────────────────────────────

  /**
   * Call this on the first user interaction (click / keydown) to satisfy the
   * browser autoplay policy.  Safe to call multiple times.
   */
  resume(): void {
    if (this._resumed) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this._resumed = true;
        console.debug('[AudioEngine] AudioContext resumed');
      }).catch(err => {
        console.warn('[AudioEngine] Failed to resume AudioContext:', err);
      });
    } else {
      this._resumed = true;
    }
  }

  get isResumed(): boolean {
    return this._resumed || this.ctx.state === 'running';
  }
}

// ── Singleton helpers ───────────────────────────────────────────────────────

const WIN = window as unknown as Record<string, unknown>;

/**
 * Initialise the global AudioEngine singleton and store it on
 * window.__EX_NIHILO_AUDIO__.  Safe to call multiple times — returns the
 * existing instance if already created.
 */
export function initAudioEngine(): AudioEngine {
  if (!WIN.__EX_NIHILO_AUDIO__) {
    WIN.__EX_NIHILO_AUDIO__ = new AudioEngine();
    console.debug('[AudioEngine] Singleton created');
  }
  return WIN.__EX_NIHILO_AUDIO__ as AudioEngine;
}

/**
 * Return the existing AudioEngine singleton, or null if not yet initialised.
 */
export function getAudioEngine(): AudioEngine | null {
  return (WIN.__EX_NIHILO_AUDIO__ as AudioEngine) ?? null;
}

// ── Utility ─────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
