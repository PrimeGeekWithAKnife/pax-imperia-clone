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
 *
 * Planet surface ambients (for planet management screen):
 *   • Terran  — gentle wind + distant bird-like filtered noise
 *   • Desert  — dry wind gusts (bandpass sweeps)
 *   • Ice     — crystalline tinkling + howling high-frequency wind
 *   • Volcanic — deep rumble + crackle
 *   • Ocean   — underwater pressure hum + bubble pops
 *   • Industrial (many buildings) — machinery hum + hydraulic hisses
 *
 * Shipyard ambient:
 *   • Metallic rhythmic clicks + welding sparks + machinery drone
 *
 * Fleet ambient:
 *   • Engine rumble that varies with fleet size
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

  // Management-screen ambients
  private surfaceHandle: StopHandle | null = null;
  private shipyardHandle: StopHandle | null = null;
  private fleetHandle: StopHandle | null = null;

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

  // ── Planet surface ambients (management screen) ─────────────────────────────

  /**
   * Start a planet surface ambient for the management screen.
   * Pass the planet type and optionally how many buildings the planet has
   * (used to trigger the industrial variant when heavily developed).
   */
  startSurfaceAmbient(type: PlanetType, buildingCount = 0): void {
    this.stopSurfaceAmbient();
    const handle = this._createSurfaceAmbient(type, buildingCount);
    if (handle) this.surfaceHandle = handle;
  }

  stopSurfaceAmbient(): void {
    if (this.surfaceHandle) {
      try { this.surfaceHandle.stop(); } catch { /* already stopped */ }
      this.surfaceHandle = null;
    }
  }

  // ── Shipyard ambient ────────────────────────────────────────────────────────

  startShipyardAmbient(): void {
    this.stopShipyardAmbient();
    this.shipyardHandle = this._createShipyardAmbient();
  }

  stopShipyardAmbient(): void {
    if (this.shipyardHandle) {
      try { this.shipyardHandle.stop(); } catch { /* already stopped */ }
      this.shipyardHandle = null;
    }
  }

  // ── Fleet ambient ────────────────────────────────────────────────────────────

  startFleetAmbient(shipCount: number): void {
    this.stopFleetAmbient();
    this.fleetHandle = this._createFleetAmbient(shipCount);
  }

  stopFleetAmbient(): void {
    if (this.fleetHandle) {
      try { this.fleetHandle.stop(); } catch { /* already stopped */ }
      this.fleetHandle = null;
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
    this.stopSurfaceAmbient();
    this.stopShipyardAmbient();
    this.stopFleetAmbient();
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

    const noiseBuffer = makeNoiseBuffer(ctx, 4);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 80;
    bp.Q.value = 0.5;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 30;

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
   * Interval: 15–30 seconds.
   */
  private _schedulePing(): void {
    const delay = (15 + Math.random() * 15) * 1000;
    this.pingTimer = setTimeout(() => {
      this._playPing();
      this._schedulePing();
    }, delay);
  }

  /**
   * One distant ping: a high sine tone (1000–3000 Hz) that fades in and out
   * over 3–5 seconds.
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

    osc.onended = () => masterGain.disconnect();
  }

  // ── System ambient builders ─────────────────────────────────────────────────

  /**
   * Star hum: a drone tuned to the star type.
   * Neutron stars pulse at 2–5 Hz; others have a slow LFO sweep.
   */
  private _createStarHum(starType: StarType): StopHandle {
    const ctx = this.ctx;
    const params = STAR_HUM[starType];
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.22;
    masterGain.connect(this.bus);

    if (params.pulse !== null) {
      return this._createNeutronPulse(params.baseFreq, params.pulse, masterGain);
    }

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = params.baseFreq;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = params.baseFreq * 1.005;

    const stopHandles: Array<() => void> = [];

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

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = params.baseFreq * 3;

    osc1.connect(lp);
    osc2.connect(lp);
    lp.connect(masterGain);

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

    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = pulseRate;

    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.45;
    const dcOffset = ctx.createGain();
    dcOffset.gain.value = 0.55;

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

  // ── Planet ambient builders (hover in system view) ──────────────────────────

  private _createPlanetAmbient(type: PlanetType): StopHandle | null {
    switch (type) {
      case 'terran':
        return this._createTerranAmbient(false);
      case 'ocean':
        return this._createOceanAmbient(false);
      case 'volcanic':
        return this._createVolcanicAmbient(false);
      case 'gas_giant':
        return this._createGasGiantAmbient();
      case 'ice':
        return this._createIceAmbient(false);
      case 'desert':
        return this._createDesertAmbient(false);
      case 'toxic':
        return this._createWindAmbient(150, 400, 0.08, 'toxic wind');
      case 'barren':
      default:
        return null;
    }
  }

  // ── Planet surface ambient builders (management screen) ─────────────────────

  private _createSurfaceAmbient(type: PlanetType, buildingCount: number): StopHandle | null {
    // Industrial variant when the planet is heavily developed
    if (buildingCount >= 4) {
      return this._createIndustrialAmbient();
    }

    switch (type) {
      case 'terran':
        return this._createTerranAmbient(true);
      case 'ocean':
        return this._createOceanAmbient(true);
      case 'desert':
        return this._createDesertAmbient(true);
      case 'ice':
        return this._createIceAmbient(true);
      case 'volcanic':
        return this._createVolcanicAmbient(true);
      case 'gas_giant':
        return this._createGasGiantAmbient();
      case 'toxic':
        return this._createWindAmbient(150, 400, 0.09, 'toxic');
      case 'barren':
      default:
        return null;
    }
  }

  // ── Specific planet builders ─────────────────────────────────────────────────

  /**
   * Terran: gentle wind + bird-like filtered noise at higher frequency bands.
   */
  private _createTerranAmbient(louder: boolean): StopHandle {
    const ctx = this.ctx;
    const vol = louder ? 0.12 : 0.08;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(this.bus);

    // Wind layer
    const noiseBuffer = makeNoiseBuffer(ctx, 4);
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;

    const windBp = ctx.createBiquadFilter();
    windBp.type = 'bandpass';
    windBp.frequency.value = 180;
    windBp.Q.value = 0.5;

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 1 / 9;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 0.28;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(masterGain.gain);

    wind.connect(windBp);
    windBp.connect(masterGain);
    wind.start();
    windLfo.start();

    // Bird-like layer: bandpass noise at 1200–2000 Hz, very quiet
    const birdNoise = ctx.createBufferSource();
    birdNoise.buffer = makeNoiseBuffer(ctx, 2);
    birdNoise.loop = true;

    const birdBp = ctx.createBiquadFilter();
    birdBp.type = 'bandpass';
    birdBp.frequency.value = 1600;
    birdBp.Q.value = 3.5; // narrow band for chirp-like character

    const birdAmpLfo = ctx.createOscillator();
    birdAmpLfo.type = 'sine';
    birdAmpLfo.frequency.value = 1 / 7; // slow warble
    const birdLfoGain = ctx.createGain();
    birdLfoGain.gain.value = 0.022;
    const birdOffset = ctx.createGain();
    birdOffset.gain.value = 0.018;

    birdAmpLfo.connect(birdLfoGain);
    birdLfoGain.connect(birdOffset.gain);
    birdNoise.connect(birdBp);
    birdBp.connect(birdOffset);
    birdOffset.connect(masterGain);
    birdNoise.start();
    birdAmpLfo.start();

    masterGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.0);

    return {
      stop: () => {
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.8);
        setTimeout(() => {
          try { wind.stop(); } catch { /* */ }
          try { windLfo.stop(); } catch { /* */ }
          try { birdNoise.stop(); } catch { /* */ }
          try { birdAmpLfo.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 900);
      },
    };
  }

  /**
   * Desert: dry wind gusts — bandpass sweeps from low to high frequency
   * suggesting gusts of hot, dry air.
   */
  private _createDesertAmbient(louder: boolean): StopHandle {
    const ctx = this.ctx;
    const vol = louder ? 0.10 : 0.07;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(this.bus);

    const noiseBuffer = makeNoiseBuffer(ctx, 4);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 0.8;

    // Gust LFO — sweeps bandpass centre between 200 and 800 Hz
    const gustLfo = ctx.createOscillator();
    gustLfo.type = 'sine';
    gustLfo.frequency.value = 1 / 5; // 5-second gust cycle
    const gustLfoGain = ctx.createGain();
    gustLfoGain.gain.value = 300; // ±300 Hz around 400
    gustLfo.connect(gustLfoGain);
    gustLfoGain.connect(bp.frequency);

    // Amplitude modulation for gust swell
    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = 1 / 6;
    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.35;
    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(masterGain.gain);

    noise.connect(bp);
    bp.connect(masterGain);
    noise.start();
    gustLfo.start();
    ampLfo.start();

    masterGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.0);

    return {
      stop: () => {
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.6);
        setTimeout(() => {
          try { noise.stop(); } catch { /* */ }
          try { gustLfo.stop(); } catch { /* */ }
          try { ampLfo.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 700);
      },
    };
  }

  /**
   * Ice world: crystalline tinkling (sparse high sine notes) + howling wind.
   */
  private _createIceAmbient(louder: boolean): StopHandle {
    const ctx = this.ctx;
    const vol = louder ? 0.09 : 0.07;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(this.bus);

    // Howling wind: highpass noise with a sweeping bandpass
    const windNoise = makeNoiseBuffer(ctx, 4);
    const wind = ctx.createBufferSource();
    wind.buffer = windNoise;
    wind.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    hp.Q.value = 1.5;

    const howlLfo = ctx.createOscillator();
    howlLfo.type = 'sine';
    howlLfo.frequency.value = 1 / 8;
    const howlLfoGain = ctx.createGain();
    howlLfoGain.gain.value = 600;
    howlLfo.connect(howlLfoGain);
    howlLfoGain.connect(hp.frequency);

    const windGain = ctx.createGain();
    windGain.gain.value = 0.4;
    wind.connect(hp);
    hp.connect(windGain);
    windGain.connect(masterGain);
    wind.start();
    howlLfo.start();

    // Crystalline tinkling: sparse high sine impulses
    let stopped = false;
    const tinkleMidi = [84, 86, 88, 91, 93]; // high notes

    const scheduleTinkle = (): void => {
      if (stopped) return;
      const midi = tinkleMidi[Math.floor(Math.random() * tinkleMidi.length)]!;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.4, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + 2.0);

      osc.connect(env);
      env.connect(masterGain);
      osc.start(t);
      osc.stop(t + 2.2);

      // Gaps of 2–5 s
      setTimeout(scheduleTinkle, 2000 + Math.random() * 3000);
    };

    setTimeout(scheduleTinkle, 1000 + Math.random() * 2000);

    masterGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.2);

    return {
      stop: () => {
        stopped = true;
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.6);
        setTimeout(() => {
          try { wind.stop(); } catch { /* */ }
          try { howlLfo.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 700);
      },
    };
  }

  /**
   * Volcanic: deep rumble + crackle impulses.
   */
  private _createVolcanicAmbient(louder: boolean): StopHandle {
    const ctx = this.ctx;
    const vol = louder ? 0.14 : 0.10;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
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

    // Random crackle impulses
    let stopped = false;
    const schedCrackle = (): void => {
      if (stopped) return;
      const delay = 1.5 + Math.random() * 3;
      setTimeout(() => {
        if (stopped) return;
        const impLen = Math.floor(ctx.sampleRate * 0.06);
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

    masterGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.0);

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

  /**
   * Ocean world: underwater pressure hum + periodic bubble pops.
   */
  private _createOceanAmbient(louder: boolean): StopHandle {
    const ctx = this.ctx;
    const vol = louder ? 0.11 : 0.08;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(this.bus);

    // Underwater pressure hum: low drone + filtered noise swell
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55; // low pressure hum

    // Slow amplitude modulation — like deep ocean pressure variation
    const humLfo = ctx.createOscillator();
    humLfo.type = 'sine';
    humLfo.frequency.value = 1 / 14;
    const humLfoGain = ctx.createGain();
    humLfoGain.gain.value = 0.25;
    const humOffset = ctx.createGain();
    humOffset.gain.value = 0.7;
    humLfo.connect(humLfoGain);
    humLfoGain.connect(humOffset.gain);
    osc.connect(humOffset);
    humOffset.connect(masterGain);
    osc.start();
    humLfo.start();

    // Low filtered noise — water movement
    const waterNoise = ctx.createBufferSource();
    waterNoise.buffer = makeNoiseBuffer(ctx, 4);
    waterNoise.loop = true;

    const waterBp = ctx.createBiquadFilter();
    waterBp.type = 'bandpass';
    waterBp.frequency.value = 300;
    waterBp.Q.value = 0.6;

    const waterGain = ctx.createGain();
    waterGain.gain.value = 0.25;
    waterNoise.connect(waterBp);
    waterBp.connect(waterGain);
    waterGain.connect(masterGain);
    waterNoise.start();

    // Bubble pops: short bandpass noise bursts
    let stopped = false;
    const scheduleBubble = (): void => {
      if (stopped) return;
      const t = ctx.currentTime;
      const popLen = Math.floor(ctx.sampleRate * 0.04);
      const popBuf = ctx.createBuffer(1, popLen, ctx.sampleRate);
      const data = popBuf.getChannelData(0);
      for (let i = 0; i < popLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / popLen, 3);
      }
      const src = ctx.createBufferSource();
      src.buffer = popBuf;

      const popBp = ctx.createBiquadFilter();
      popBp.type = 'bandpass';
      popBp.frequency.value = 400 + Math.random() * 400;
      popBp.Q.value = 2;

      const popGain = ctx.createGain();
      popGain.gain.value = 0.18 + Math.random() * 0.15;

      src.connect(popBp);
      popBp.connect(popGain);
      popGain.connect(masterGain);
      src.start(t);

      // Bubbles every 1–4 s
      setTimeout(scheduleBubble, 1000 + Math.random() * 3000);
    };

    setTimeout(scheduleBubble, 500 + Math.random() * 1500);

    masterGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.2);

    return {
      stop: () => {
        stopped = true;
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.8);
        setTimeout(() => {
          try { osc.stop(); } catch { /* */ }
          try { humLfo.stop(); } catch { /* */ }
          try { waterNoise.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 900);
      },
    };
  }

  /**
   * Industrial planet (heavily built): machinery hum + occasional hydraulic hisses.
   */
  private _createIndustrialAmbient(): StopHandle {
    const ctx = this.ctx;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(this.bus);

    // Machinery drone: sawtooth through a lowpass
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 80; // industrial hum

    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 200;
    droneLp.Q.value = 1.5;

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.08;

    droneOsc.connect(droneLp);
    droneLp.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();

    // Background noise layer — factory floor
    const factoryNoise = ctx.createBufferSource();
    factoryNoise.buffer = makeNoiseBuffer(ctx, 4);
    factoryNoise.loop = true;
    const factoryBp = ctx.createBiquadFilter();
    factoryBp.type = 'bandpass';
    factoryBp.frequency.value = 250;
    factoryBp.Q.value = 0.7;
    const factoryGain = ctx.createGain();
    factoryGain.gain.value = 0.12;
    factoryNoise.connect(factoryBp);
    factoryBp.connect(factoryGain);
    factoryGain.connect(masterGain);
    factoryNoise.start();

    // Hydraulic hiss: periodic short bandpass noise bursts at higher frequency
    let stopped = false;
    const scheduleHiss = (): void => {
      if (stopped) return;
      const t = ctx.currentTime;
      const hissLen = Math.floor(ctx.sampleRate * (0.08 + Math.random() * 0.12));
      const hissBuf = ctx.createBuffer(1, hissLen, ctx.sampleRate);
      const data = hissBuf.getChannelData(0);
      for (let i = 0; i < hissLen; i++) {
        const env = Math.min(i / (hissLen * 0.1), 1) * Math.pow(1 - i / hissLen, 2);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = hissBuf;

      const hissBp = ctx.createBiquadFilter();
      hissBp.type = 'bandpass';
      hissBp.frequency.value = 2000 + Math.random() * 1500;
      hissBp.Q.value = 1.5;

      const hissGain = ctx.createGain();
      hissGain.gain.value = 0.15 + Math.random() * 0.1;

      src.connect(hissBp);
      hissBp.connect(hissGain);
      hissGain.connect(masterGain);
      src.start(t);

      setTimeout(scheduleHiss, 3000 + Math.random() * 8000);
    };
    setTimeout(scheduleHiss, 1000 + Math.random() * 2000);

    masterGain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 1.0);

    return {
      stop: () => {
        stopped = true;
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.6);
        setTimeout(() => {
          try { droneOsc.stop(); } catch { /* */ }
          try { factoryNoise.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 700);
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

  // ── Shipyard ambient ─────────────────────────────────────────────────────────

  /**
   * Shipyard: metallic hammering rhythm + welding sparks + machinery drone.
   */
  private _createShipyardAmbient(): StopHandle {
    const ctx = this.ctx;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(this.bus);

    // Machinery drone: low filtered sawtooth
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sawtooth';
    droneOsc.frequency.value = 60;
    const droneLp = ctx.createBiquadFilter();
    droneLp.type = 'lowpass';
    droneLp.frequency.value = 180;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.07;
    droneOsc.connect(droneLp);
    droneLp.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();

    let stopped = false;

    // Metallic hammering: periodic filtered click every ~800 ms ± some variation
    const scheduleHammer = (): void => {
      if (stopped) return;
      const t = ctx.currentTime;
      const clickLen = Math.floor(ctx.sampleRate * 0.025);
      const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
      const data = clickBuf.getChannelData(0);
      for (let i = 0; i < clickLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / clickLen, 5);
      }
      const src = ctx.createBufferSource();
      src.buffer = clickBuf;

      const clickBp = ctx.createBiquadFilter();
      clickBp.type = 'bandpass';
      clickBp.frequency.value = 1200 + Math.random() * 500;
      clickBp.Q.value = 3;

      const clickGain = ctx.createGain();
      clickGain.gain.value = 0.25 + Math.random() * 0.2;

      src.connect(clickBp);
      clickBp.connect(clickGain);
      clickGain.connect(masterGain);
      src.start(t);

      setTimeout(scheduleHammer, 700 + Math.random() * 400);
    };
    setTimeout(scheduleHammer, 200);

    // Welding sparks: short bursts of highpass noise at irregular intervals
    const scheduleWeld = (): void => {
      if (stopped) return;
      const t = ctx.currentTime;
      const weldLen = Math.floor(ctx.sampleRate * (0.03 + Math.random() * 0.05));
      const weldBuf = ctx.createBuffer(1, weldLen, ctx.sampleRate);
      const wdata = weldBuf.getChannelData(0);
      for (let i = 0; i < weldLen; i++) {
        wdata[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / weldLen, 2);
      }
      const wsrc = ctx.createBufferSource();
      wsrc.buffer = weldBuf;

      const wHp = ctx.createBiquadFilter();
      wHp.type = 'highpass';
      wHp.frequency.value = 3000;

      const wGain = ctx.createGain();
      wGain.gain.value = 0.12 + Math.random() * 0.08;

      wsrc.connect(wHp);
      wHp.connect(wGain);
      wGain.connect(masterGain);
      wsrc.start(t);

      setTimeout(scheduleWeld, 2000 + Math.random() * 5000);
    };
    setTimeout(scheduleWeld, 1000 + Math.random() * 2000);

    masterGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 1.0);

    return {
      stop: () => {
        stopped = true;
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.8);
        setTimeout(() => {
          try { droneOsc.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 900);
      },
    };
  }

  // ── Fleet ambient ────────────────────────────────────────────────────────────

  /**
   * Fleet engine rumble: low sine drone whose intensity scales with fleet size.
   */
  private _createFleetAmbient(shipCount: number): StopHandle {
    const ctx = this.ctx;
    const baseVol = Math.min(0.22, 0.06 + shipCount * 0.025);
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(this.bus);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 45;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 45.6;

    // Rumble LFO — engine throb
    const throb = ctx.createOscillator();
    throb.type = 'sine';
    throb.frequency.value = 0.8; // ~1 Hz throb
    const throbGain = ctx.createGain();
    throbGain.gain.value = 0.2;
    const throbOffset = ctx.createGain();
    throbOffset.gain.value = 0.8;
    throb.connect(throbGain);
    throbGain.connect(throbOffset.gain);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120;

    osc1.connect(throbOffset);
    osc2.connect(throbOffset);
    throbOffset.connect(lp);
    lp.connect(masterGain);

    osc1.start();
    osc2.start();
    throb.start();

    masterGain.gain.linearRampToValueAtTime(baseVol, ctx.currentTime + 1.0);

    return {
      stop: () => {
        const now = ctx.currentTime;
        masterGain.gain.linearRampToValueAtTime(0, now + 0.8);
        setTimeout(() => {
          try { osc1.stop(); } catch { /* */ }
          try { osc2.stop(); } catch { /* */ }
          try { throb.stop(); } catch { /* */ }
          masterGain.disconnect();
        }, 900);
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
