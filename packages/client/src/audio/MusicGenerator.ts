/**
 * MusicGenerator — procedural ambient music for Ex Nihilo.
 *
 * Layers (all very quiet, Brian Eno "Music for Airports" aesthetic):
 *
 *   1. Bass drone  — two detuned sines ~40 Hz, slow frequency sweep ±2 Hz / 45 s
 *   2. Pad layer   — sawtooth through lowpass, very slow LFO on cutoff
 *   3. Shimmer     — high sine (800-2000 Hz) with feedback delay
 *   4. Texture     — bandpass-filtered white noise (100-400 Hz)
 *   5. Motif       — (menu only) 4-note pentatonic figure, very slow
 *
 * Scene modes:
 *   'menu'   — all layers + motif
 *   'galaxy' — drone + texture + shimmer (vast, empty)
 *   'system' — drone + pad + texture (warmer)
 */

import type { AudioEngine } from './AudioEngine';

// ── Types ───────────────────────────────────────────────────────────────────

export type MusicScene = 'menu' | 'galaxy' | 'system';

interface ActiveLayer {
  nodes: AudioNode[];
  gain: GainNode;
  stop: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FADE_OUT_TIME = 2.0;   // seconds
const FADE_IN_TIME  = 3.0;   // seconds

// Pentatonic C-major scale (MIDI note numbers for the motif)
const PENTATONIC = [48, 50, 52, 55, 57]; // C3 D3 E3 G3 A3

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── MusicGenerator ────────────────────────────────────────────────────────────

export class MusicGenerator {
  private engine: AudioEngine;
  private ctx: AudioContext;
  private bus: GainNode;

  private currentScene: MusicScene | null = null;
  private activeLayers: ActiveLayer[] = [];
  private masterFade: GainNode;

  constructor(engine: AudioEngine) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.bus = engine.musicBus;

    // One fade node above all layers for crossfade transitions
    this.masterFade = this.ctx.createGain();
    this.masterFade.gain.value = 0;
    this.masterFade.connect(this.bus);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  startMusic(scene: MusicScene): void {
    if (this.currentScene === scene) return;
    this.currentScene = scene;
    this._startLayers(scene);
    this._fadeMasterIn();
  }

  stopMusic(): void {
    this.currentScene = null;
    this._fadeMasterOut(() => this._stopAllLayers());
  }

  crossfadeTo(scene: MusicScene): void {
    if (this.currentScene === scene) return;
    // Fade out old layers, then immediately start new ones and fade in
    this._fadeMasterOut(() => {
      this._stopAllLayers();
      this.currentScene = scene;
      this._startLayers(scene);
      this._fadeMasterIn();
    });
  }

  // ── Layer management ────────────────────────────────────────────────────────

  private _startLayers(scene: MusicScene): void {
    const layers: ActiveLayer[] = [];

    layers.push(this._createBassDrone());
    layers.push(this._createTexture());
    layers.push(this._createShimmer());

    if (scene === 'menu' || scene === 'system') {
      layers.push(this._createPadLayer());
    }
    if (scene === 'menu') {
      layers.push(this._createMotif());
    }

    this.activeLayers = layers;
  }

  private _stopAllLayers(): void {
    for (const layer of this.activeLayers) {
      try { layer.stop(); } catch { /* already stopped */ }
    }
    this.activeLayers = [];
  }

  // ── Master fade helpers ─────────────────────────────────────────────────────

  private _fadeMasterIn(): void {
    const now = this.ctx.currentTime;
    this.masterFade.gain.cancelScheduledValues(now);
    this.masterFade.gain.setValueAtTime(0, now);
    this.masterFade.gain.linearRampToValueAtTime(1, now + FADE_IN_TIME);
  }

  private _fadeMasterOut(callback: () => void): void {
    const now = this.ctx.currentTime;
    this.masterFade.gain.cancelScheduledValues(now);
    this.masterFade.gain.setValueAtTime(this.masterFade.gain.value, now);
    this.masterFade.gain.linearRampToValueAtTime(0, now + FADE_OUT_TIME);
    setTimeout(callback, FADE_OUT_TIME * 1000 + 50);
  }

  // ── Layer factories ─────────────────────────────────────────────────────────

  /**
   * Bass drone: two detuned sines at ~40 Hz.
   * Slowly sweeps ±2 Hz over 45-second cycles via an LFO.
   */
  private _createBassDrone(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.18;
    gain.connect(this.masterFade);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = 40.0;
    osc2.frequency.value = 40.5; // slight detune

    // LFO to slowly sweep frequency
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 45; // one cycle every 45 s
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 2; // ±2 Hz
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    // Slight soft clip via waveshaper for warmth
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSoftClipCurve(256);
    osc1.connect(shaper);
    osc2.connect(shaper);
    shaper.connect(gain);

    osc1.start();
    osc2.start();
    lfo.start();

    return {
      nodes: [osc1, osc2, lfo, lfoGain, shaper, gain],
      gain,
      stop: () => { osc1.stop(); osc2.stop(); lfo.stop(); },
    };
  }

  /**
   * Pad layer: sawtooth through a lowpass filter, LFO on cutoff.
   * Warmer, slightly fuller texture for menu and system view.
   */
  private _createPadLayer(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.055;
    gain.connect(this.masterFade);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55; // A1 — low pad root

    // Lowpass filter — cutoff sweeps via slow LFO
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;
    filter.Q.value = 1.2;

    // LFO on filter cutoff (0.02 Hz = one sweep every 50 s)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.02;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 80; // sweeps cutoff ±80 Hz around 200
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    // Convolver for reverb
    const reverb = this._createReverb(6, 3.5);

    osc.connect(filter);
    filter.connect(reverb);
    reverb.connect(gain);

    osc.start();
    lfo.start();

    return {
      nodes: [osc, filter, lfo, lfoGain, reverb, gain],
      gain,
      stop: () => { osc.stop(); lfo.stop(); },
    };
  }

  /**
   * Shimmer: high-frequency sine with a feedback delay line, creating
   * ethereal, drifting high tones.
   */
  private _createShimmer(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    gain.connect(this.masterFade);

    // Slowly modulate between 800 and 2000 Hz over a long period
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;

    const freqLfo = ctx.createOscillator();
    freqLfo.type = 'sine';
    freqLfo.frequency.value = 1 / 37; // 37-second cycle
    const freqLfoGain = ctx.createGain();
    freqLfoGain.gain.value = 600; // ±600 Hz around 1200
    freqLfo.connect(freqLfoGain);
    freqLfoGain.connect(osc.frequency);

    // Amplitude envelope: slow swell via AM LFO
    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = 1 / 23; // 23-second swell
    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.5;
    const ampOffset = ctx.createGain();
    ampOffset.gain.value = 0.5; // DC offset so AM goes 0→1
    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(ampOffset.gain);

    // Feedback delay
    const delay = ctx.createDelay(4.0);
    delay.delayTime.value = 0.7;
    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = 0.55;
    const reverb = this._createReverb(8, 5);

    osc.connect(ampOffset);
    ampOffset.connect(delay);
    delay.connect(feedbackGain);
    feedbackGain.connect(delay);
    delay.connect(reverb);
    reverb.connect(gain);

    osc.start();
    freqLfo.start();
    ampLfo.start();

    return {
      nodes: [osc, freqLfo, freqLfoGain, ampLfo, ampLfoGain, ampOffset, delay, feedbackGain, reverb, gain],
      gain,
      stop: () => { osc.stop(); freqLfo.stop(); ampLfo.stop(); },
    };
  }

  /**
   * Texture: bandpass-filtered white noise at barely audible volume.
   * Sounds like distant cosmic static / radiation.
   */
  private _createTexture(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    gain.connect(this.masterFade);

    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    // Bandpass centred at ~200 Hz, width covers 100-400 Hz
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 200;
    bp.Q.value = 0.7; // fairly wide

    // Slow LFO on bandpass centre
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 60; // 60-second sweep
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 100; // ±100 Hz
    lfo.connect(lfoGain);
    lfoGain.connect(bp.frequency);

    source.connect(bp);
    bp.connect(gain);

    source.start();
    lfo.start();

    return {
      nodes: [source, bp, lfo, lfoGain, gain],
      gain,
      stop: () => { source.stop(); lfo.stop(); },
    };
  }

  /**
   * Motif: a 4-note pentatonic figure played very slowly (once per 20-30 s),
   * using a soft sine tone with long reverb.  Menu scene only.
   */
  private _createMotif(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.09;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(10, 6);
    reverb.connect(gain);

    let stopped = false;
    const notes = [
      PENTATONIC[0]!, PENTATONIC[2]!, PENTATONIC[4]!, PENTATONIC[3]!,
    ];

    const scheduleNote = (noteIndex: number, delay: number): void => {
      if (stopped) return;
      const freq = midiToHz(notes[noteIndex % notes.length]!);
      const t = ctx.currentTime + delay;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.9, t + 0.3);
      env.gain.exponentialRampToValueAtTime(0.001, t + 4.5);

      osc.connect(env);
      env.connect(reverb);

      osc.start(t);
      osc.stop(t + 5);

      // Schedule next note: gap of 5-9 seconds between notes
      const gap = 5 + Math.random() * 4;
      setTimeout(() => scheduleNote(noteIndex + 1, 0), (delay + gap) * 1000);
    };

    // Start the motif sequence with a small initial delay
    const initialDelay = 3 + Math.random() * 4;
    setTimeout(() => scheduleNote(0, 0), initialDelay * 1000);

    return {
      nodes: [reverb, gain],
      gain,
      stop: () => { stopped = true; },
    };
  }

  // ── Reverb helper ───────────────────────────────────────────────────────────

  /**
   * Procedurally generate a reverb impulse response and return a ConvolverNode.
   *
   * @param duration  IR length in seconds
   * @param decay     Exponential decay constant (higher = longer tail)
   */
  private _createReverb(duration: number, decay: number): ConvolverNode {
    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const ir = ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Exponential decay noise
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }

    const conv = ctx.createConvolver();
    conv.buffer = ir;
    return conv;
  }
}

// ── Utility: soft clip waveshaper ────────────────────────────────────────────

function makeSoftClipCurve(samples: number): Float32Array<ArrayBuffer> {
  const buf = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buf);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = (3 / 2) * x - (1 / 2) * x * x * x; // cubic soft clip
  }
  return curve;
}
