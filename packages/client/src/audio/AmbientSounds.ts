/**
 * AmbientSounds — scene-specific procedural atmospheric sound effects.
 *
 * Galaxy map:
 *   • "Space wind"  — very low filtered noise that slowly rises and falls
 *   • Distant pings — occasional high-frequency sine tones (pulsars)
 *
 * System view:
 *   • Star hum    — drone tuned to star type
 *   • Planet proximity ambients — triggered by hover events
 */

import type { AudioEngine } from './AudioEngine';
import type { StarType, PlanetType } from '@nova-imperia/shared';

// ── Types ────────────────────────────────────────────────────────────────────

interface StopHandle {
  stop: () => void;
}

// ── Star hum parameters per star type ────────────────────────────────────────

interface StarHumParams {
  baseFreq: number;
  freqVariance: number;  // ± Hz sweep range
  sweepPeriod: number;   // LFO period in seconds
  shimmer: boolean;      // add high-freq overtone?
  pulse: number | null;  // if set: pulse rate in Hz (neutron star)
}

const STAR_HUM: Record<StarType, StarHumParams> = {
  yellow:     { baseFreq: 95,  freqVariance: 8,  sweepPeriod: 30, shimmer: false, pulse: null },
  orange:     { baseFreq: 80,  freqVariance: 10, sweepPeriod: 35, shimmer: false, pulse: null },
  red_dwarf:  { baseFreq: 70,  freqVariance: 6,  sweepPeriod: 40, shimmer: false, pulse: null },
  red_giant:  { baseFreq: 45,  freqVariance: 5,  sweepPeriod: 50, shimmer: false, pulse: null },
  blue_giant: { baseFreq: 160, freqVariance: 15, sweepPeriod: 25, shimmer: true,  pulse: null },
  white:      { baseFreq: 120, freqVariance: 10, sweepPeriod: 28, shimmer: true,  pulse: null },
  neutron:    { baseFreq: 90,  freqVariance: 0,  sweepPeriod: 0,  shimmer: false, pulse: 3.5  },
  binary:     { baseFreq: 75,  freqVariance: 12, sweepPeriod: 32, shimmer: true,  pulse: null },
};

// ── AmbientSounds ─────────────────────────────────────────────────────────────

export class AmbientSounds {
  private engine: AudioEngine;
  private ctx: AudioContext;
  private bus: GainNode;

  // Active ambient handle collections
  private galaxyHandles: StopHandle[] = [];
  private systemHandles: StopHandle[] = [];
  private planetHandle: StopHandle | null = null;

  // Ping timer for galaxy ambients
  private pingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(engine: AudioEngine) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.bus = engine.ambientBus;
  }

  // ── Galaxy ambients ─────────────────────────────────────────────────────────

  startGalaxyAmbient(): void {
    this.stopAll();
    this.galaxyHandles.push(this._createSpaceWind());
    this._schedulePing();
  }

  // ── System view ambients ────────────────────────────────────────────────────

  startSystemAmbient(starType: StarType): void {
    this.stopAll();
    this.systemHandles.push(this._createStarHum(starType));
  }

  /**
   * Play a planet proximity ambient while the player hovers over a planet.
   * Replaces any currently playing planet ambient.
   */
  playPlanetAmbient(type: PlanetType): void {
    this.stopPlanetAmbient();
    const handle = this._createPlanetAmbient(type);
    if (handle) this.planetHandle = handle;
  }

  stopPlanetAmbient(): void {
    if (this.planetHandle) {
      try { this.planetHandle.stop(); } catch { /* already stopped */ }
      this.planetHandle = null;
    }
  }

  // ── Stop all ────────────────────────────────────────────────────────────────

  stopAll(): void {
    if (this.pingTimer !== null) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    for (const h of this.galaxyHandles) {
      try { h.stop(); } catch { /* already stopped */ }
    }
    this.galaxyHandles = [];

    for (const h of this.systemHandles) {
      try { h.stop(); } catch { /* already stopped */ }
    }
    this.systemHandles = [];

    this.stopPlanetAmbient();
  }

  // ── Galaxy ambient builders ─────────────────────────────────────────────────

  /**
   * "Space wind": very low bandpass-filtered noise that slowly swells
   * using a slow AM LFO.
   */
  private _createSpaceWind(): StopHandle {
    const ctx = this.ctx;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.18;
    masterGain.connect(this.bus);

    // White noise source (looping short buffer)
    const noiseBuffer = makeNoiseBuffer(ctx, 4);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    // Very low bandpass
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 80;
    bp.Q.value = 0.5;

    // Secondary highpass to shape the sound
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 30;

    // Slow AM swell (rise and fall over 20-40 second cycles)
    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = 1 / 28;
    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.4;
    const ampOffset = ctx.createConstantSource();
    ampOffset.offset.value = 0.6;

    noise.connect(bp);
    bp.connect(hp);
    hp.connect(masterGain);

    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(masterGain.gain);

    noise.start();
    ampLfo.start();
    ampOffset.start();

    return {
      stop: () => {
        try { noise.stop(); } catch { /* */ }
        try { ampLfo.stop(); } catch { /* */ }
        try { ampOffset.stop(); } catch { /* */ }
        masterGain.disconnect();
      },
    };
  }

  /**
   * Schedule the next distant "ping" (pulsar-like high sine tone).
   * Interval: 15-30 seconds.
   */
  private _schedulePing(): void {
    const delay = (15 + Math.random() * 15) * 1000;
    this.pingTimer = setTimeout(() => {
      this._playPing();
      this._schedulePing();
    }, delay);
  }

  /**
   * One distant ping: a high sine tone (1000-3000 Hz) that fades in and out
   * over 3-5 seconds.
   */
  private _playPing(): void {
    const ctx = this.ctx;
    const freq = 1000 + Math.random() * 2000;
    const duration = 3 + Math.random() * 2;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.08, now + duration * 0.35);
    env.gain.linearRampToValueAtTime(0, now + duration);

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.12;
    masterGain.connect(this.bus);

    osc.connect(env);
    env.connect(masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.1);

    // Auto-cleanup
    osc.onended = () => masterGain.disconnect();
  }

  // ── System ambient builders ─────────────────────────────────────────────────

  /**
   * Star hum: a drone tuned to the star type.
   * Neutron stars pulse at 2-5 Hz; others have a slow LFO sweep.
   */
  private _createStarHum(starType: StarType): StopHandle {
    const ctx = this.ctx;
    const params = STAR_HUM[starType];
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(this.bus);

    if (params.pulse !== null) {
      // Neutron star: AM-pulsed tone
      return this._createNeutronPulse(params.baseFreq, params.pulse, masterGain);
    }

    // Regular star hum
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = params.baseFreq;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = params.baseFreq * 1.005; // slight detune

    const stopHandles: Array<() => void> = [];

    // Frequency sweep LFO
    if (params.freqVariance > 0) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 1 / params.sweepPeriod;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = params.freqVariance;
      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);
      lfo.start();
      stopHandles.push(() => lfo.stop());
    }

    // Lowpass to keep it dull
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = params.baseFreq * 3;

    osc1.connect(lp);
    osc2.connect(lp);
    lp.connect(masterGain);

    // Optional shimmer overtone
    if (params.shimmer) {
      const shimOsc = ctx.createOscillator();
      shimOsc.type = 'sine';
      shimOsc.frequency.value = params.baseFreq * 4;
      const shimGain = ctx.createGain();
      shimGain.gain.value = 0.15;
      shimOsc.connect(shimGain);
      shimGain.connect(masterGain);
      shimOsc.start();
      stopHandles.push(() => shimOsc.stop());
    }

    osc1.start();
    osc2.start();
    stopHandles.push(() => { osc1.stop(); osc2.stop(); });

    return {
      stop: () => {
        for (const fn of stopHandles) { try { fn(); } catch { /* */ } }
        masterGain.disconnect();
      },
    };
  }

  private _createNeutronPulse(freq: number, pulseRate: number, output: GainNode): StopHandle {
    const ctx = this.ctx;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    // AM oscillator for the pulse
    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = pulseRate;

    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.45;
    const dcOffset = ctx.createGain();
    dcOffset.gain.value = 0.55; // DC so envelope never goes negative

    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(dcOffset.gain);
    osc.connect(dcOffset);
    dcOffset.connect(output);

    osc.start();
    ampLfo.start();

    return {
      stop: () => {
        try { osc.stop(); } catch { /* */ }
        try { ampLfo.stop(); } catch { /* */ }
        output.disconnect();
      },
    };
  }

  // ── Planet ambient builders ─────────────────────────────────────────────────

  private _createPlanetAmbient(type: PlanetType): StopHandle | null {
    switch (type) {
      case 'terran':
      case 'ocean':
        return this._createWindAmbient(120, 350, 0.10, 'faint wind');
      case 'volcanic':
        return this._createVolcanicAmbient();
      case 'gas_giant':
        return this._createGasGiantAmbient();
      case 'ice':
        return this._createIceAmbient();
      case 'desert':
        return this._createWindAmbient(200, 600, 0.07, 'dry wind');
      case 'toxic':
        return this._createWindAmbient(150, 400, 0.08, 'toxic wind');
      case 'barren':
      default:
        return null; // silence
    }
  }

  /** Generic wind: filtered noise with a slow AM swell. */
  private _createWindAmbient(bpFreq: number, bpHigh: number, vol: number, _label: string): StopHandle {
    const ctx = this.ctx;
    const masterGain = ctx.createGain();
    masterGain.gain.value = vol;
    masterGain.connect(this.bus);

    const noiseBuffer = makeNoiseBuffer(ctx, 3);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = bpFreq;
    bp.Q.value = 0.6;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = bpHigh * 0.3;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = bpHigh;

    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = 1 / 12;
    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.3;
    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(masterGain.gain);

    noise.connect(bp);
    bp.connect(hp);
    hp.connect(lp);
    lp.connect(masterGain);
    noise.start();
    ampLfo.start();

    // Fade in over 1 second
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.0);

    return {
      stop: () => {
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
        setTimeout(() => {
          try { noise.stop(); } catch { /* */ }
          try { ampLfo.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 600);
      },
    };
  }

  /** Volcanic: low rumble + random crackle impulses. */
  private _createVolcanicAmbient(): StopHandle {
    const ctx = this.ctx;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.12;
    masterGain.connect(this.bus);

    // Low rumble
    const noiseBuffer = makeNoiseBuffer(ctx, 3);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120;

    noise.connect(lp);
    lp.connect(masterGain);
    noise.start();

    // Random crackle: schedule impulses
    let stopped = false;
    const schedCrackle = () => {
      if (stopped) return;
      const delay = 1.5 + Math.random() * 3;
      setTimeout(() => {
        if (stopped) return;
        const impLen = Math.floor(ctx.sampleRate * 0.05);
        const impBuf = ctx.createBuffer(1, impLen, ctx.sampleRate);
        const data = impBuf.getChannelData(0);
        for (let i = 0; i < impLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impLen, 4);
        }
        const src = ctx.createBufferSource();
        src.buffer = impBuf;
        const env = ctx.createGain();
        env.gain.value = 0.3 + Math.random() * 0.4;
        src.connect(env);
        env.connect(masterGain);
        src.start();
        schedCrackle();
      }, delay * 1000);
    };
    schedCrackle();

    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.0);

    return {
      stop: () => {
        stopped = true;
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
        setTimeout(() => {
          try { noise.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 600);
      },
    };
  }

  /** Gas giant: deep sub-bass whoosh. */
  private _createGasGiantAmbient(): StopHandle {
    const ctx = this.ctx;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.14;
    masterGain.connect(this.bus);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 35;

    const noiseBuffer = makeNoiseBuffer(ctx, 4);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 90;

    // Slow LFO on osc frequency — sounds like a huge atmosphere
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 8;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    noise.connect(lp);
    lp.connect(masterGain);
    osc.connect(masterGain);
    osc.start();
    noise.start();
    lfo.start();

    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 1.0);

    return {
      stop: () => {
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
        setTimeout(() => {
          try { osc.stop(); } catch { /* */ }
          try { noise.stop(); } catch { /* */ }
          try { lfo.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 600);
      },
    };
  }

  /** Ice world: high crystalline tones — filtered noise + high sine shimmer. */
  private _createIceAmbient(): StopHandle {
    const ctx = this.ctx;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.08;
    masterGain.connect(this.bus);

    const noiseBuffer = makeNoiseBuffer(ctx, 3);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    hp.Q.value = 2;

    // Crystalline pings via a detuned pair of high sines
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 3400;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 3407;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.08;

    noise.connect(hp);
    hp.connect(masterGain);
    osc1.connect(oscGain);
    osc2.connect(oscGain);
    oscGain.connect(masterGain);

    noise.start();
    osc1.start();
    osc2.start();

    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.0);

    return {
      stop: () => {
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
        setTimeout(() => {
          try { noise.stop(); } catch { /* */ }
          try { osc1.stop(); } catch { /* */ }
          try { osc2.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 600);
      },
    };
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function makeNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const bufferSize = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
