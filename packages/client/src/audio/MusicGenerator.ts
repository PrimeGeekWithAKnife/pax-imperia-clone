/**
 * MusicGenerator — procedural ambient music for Ex Nihilo.
 *
 * Scene modes (legacy — used by game scenes to set overall context):
 *   'menu'   — all layers + motif
 *   'galaxy' — drone + texture + shimmer (vast, empty)
 *   'system' — drone + pad + texture (warmer)
 *
 * Music tracks (player-selectable mood):
 *   'deep_space'  — the original ambient drone: eerie, atmospheric, slow sirens
 *   'exploration' — warmer pentatonic arpeggio with hopeful pad chords
 *   'tension'     — darker drones, dissonant intervals, faster modulation
 *   'serenity'    — minimal, single sustained pad with very slow filter sweeps
 */

import type { AudioEngine } from './AudioEngine';

// ── Types ───────────────────────────────────────────────────────────────────

export type MusicScene = 'menu' | 'galaxy' | 'system';
export type MusicTrack = 'deep_space' | 'exploration' | 'tension' | 'serenity';

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

// Exploration arpeggio: C4, E4, G4, A4, C5
const EXPLORATION_ARPEGGIO = [60, 64, 67, 69, 72];

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ── MusicGenerator ────────────────────────────────────────────────────────────

export class MusicGenerator {
  private engine: AudioEngine;
  private ctx: AudioContext;
  private bus: GainNode;

  private currentScene: MusicScene | null = null;
  private currentTrack: MusicTrack = 'deep_space';
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
    this._startLayers(scene, this.currentTrack);
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
      this._startLayers(scene, this.currentTrack);
      this._fadeMasterIn();
    });
  }

  /**
   * Switch to a new music mood track, crossfading from the current one.
   * The selection persists for the session — subsequent scene transitions will
   * continue to use this track.
   */
  setTrack(track: MusicTrack): void {
    if (this.currentTrack === track) return;
    this.currentTrack = track;

    // If music is currently playing, crossfade to the new mood
    if (this.currentScene !== null) {
      const scene = this.currentScene;
      this._fadeMasterOut(() => {
        this._stopAllLayers();
        this._startLayers(scene, track);
        this._fadeMasterIn();
      });
    }
  }

  get track(): MusicTrack {
    return this.currentTrack;
  }

  // ── Layer management ────────────────────────────────────────────────────────

  private _startLayers(scene: MusicScene, track: MusicTrack): void {
    const layers: ActiveLayer[] = [];

    switch (track) {
      case 'deep_space':
        layers.push(this._createBassDrone());
        layers.push(this._createTexture());
        layers.push(this._createShimmer());
        if (scene === 'menu' || scene === 'system') {
          layers.push(this._createPadLayer());
        }
        if (scene === 'menu') {
          layers.push(this._createMotif());
        }
        break;

      case 'exploration':
        layers.push(this._createExplorationArpeggio());
        layers.push(this._createExplorationPad());
        layers.push(this._createExplorationShimmer());
        break;

      case 'tension':
        layers.push(this._createTensionDrone());
        layers.push(this._createTensionDissonance());
        layers.push(this._createTensionTexture());
        layers.push(this._createTensionStabs());
        break;

      case 'serenity':
        layers.push(this._createSerenityPad());
        layers.push(this._createSerenityShimmer());
        break;
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

  // ── Deep Space layer factories ───────────────────────────────────────────────

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
    gain.gain.value = 0.015;  // Much quieter — subtle background presence
    gain.connect(this.masterFade);

    // Lower frequency range: 200-500 Hz for a deeper, less whistly shimmer
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 350;

    const freqLfo = ctx.createOscillator();
    freqLfo.type = 'sine';
    freqLfo.frequency.value = 1 / 50; // 50-second cycle (slower)
    const freqLfoGain = ctx.createGain();
    freqLfoGain.gain.value = 150; // ±150 Hz around 350 (range: 200-500 Hz)
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

  // ── Exploration track layer factories ────────────────────────────────────────

  /**
   * Exploration arpeggio: gentle pentatonic notes (C4, E4, G4, A4, C5) played
   * slowly with soft sine tones and delay.  Warm and hopeful.
   */
  private _createExplorationArpeggio(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(8, 4);
    reverb.connect(gain);

    // Feedback delay for gentle echo
    const delay = ctx.createDelay(3.0);
    delay.delayTime.value = 0.45;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.4;
    delay.connect(fbGain);
    fbGain.connect(delay);
    delay.connect(reverb);

    let stopped = false;
    let noteIndex = 0;

    const scheduleNote = (): void => {
      if (stopped) return;
      const midi = EXPLORATION_ARPEGGIO[noteIndex % EXPLORATION_ARPEGGIO.length]!;
      const freq = midiToHz(midi);
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.8, t + 0.15);
      env.gain.exponentialRampToValueAtTime(0.001, t + 3.5);

      osc.connect(env);
      env.connect(delay);

      osc.start(t);
      osc.stop(t + 4);

      noteIndex++;

      // Gap: 2.5-4.5 s between notes — leisurely arpeggio pace
      const gap = 2500 + Math.random() * 2000;
      setTimeout(scheduleNote, gap);
    };

    // Start after a brief pause
    setTimeout(scheduleNote, 1500 + Math.random() * 1000);

    return {
      nodes: [reverb, delay, fbGain, gain],
      gain,
      stop: () => { stopped = true; },
    };
  }

  /**
   * Exploration pad: a gentle C-major chord spread across sine oscillators,
   * very slowly modulated for movement.
   */
  private _createExplorationPad(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(7, 4);
    reverb.connect(gain);

    // C major spread: C3, G3, E4 — warm, open
    const chordMidi = [48, 55, 64];
    const oscs: OscillatorNode[] = [];

    for (const midi of chordMidi) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(midi);

      // Very slight per-note detune for warmth
      const detune = (Math.random() - 0.5) * 4;
      osc.detune.value = detune;

      const envGain = ctx.createGain();
      envGain.gain.value = 0.33;

      osc.connect(envGain);
      envGain.connect(reverb);
      osc.start();
      oscs.push(osc);
    }

    // Slow LFO on master gain for gentle swell
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 18; // 18-second swell
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    return {
      nodes: [...oscs, lfo, lfoGain, reverb, gain],
      gain,
      stop: () => { oscs.forEach((o) => o.stop()); lfo.stop(); },
    };
  }

  /**
   * Exploration shimmer: soft, high-register sine notes at long intervals,
   * evoking starlight.
   */
  private _createExplorationShimmer(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(9, 5.5);
    reverb.connect(gain);

    let stopped = false;

    // High pentatonic notes: E5, G5, A5, C6
    const shimmerMidi = [76, 79, 81, 84];

    const scheduleShimmer = (): void => {
      if (stopped) return;
      const midi = shimmerMidi[Math.floor(Math.random() * shimmerMidi.length)]!;
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(midi);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.6, t + 0.4);
      env.gain.exponentialRampToValueAtTime(0.001, t + 5);

      osc.connect(env);
      env.connect(reverb);
      osc.start(t);
      osc.stop(t + 6);

      // Long gaps: 8-16 s between shimmer notes
      setTimeout(scheduleShimmer, 8000 + Math.random() * 8000);
    };

    setTimeout(scheduleShimmer, 4000 + Math.random() * 4000);

    return {
      nodes: [reverb, gain],
      gain,
      stop: () => { stopped = true; },
    };
  }

  // ── Tension track layer factories ─────────────────────────────────────────

  /**
   * Tension drone: low sines in the 20-30 Hz range — sub-bass rumble.
   */
  private _createTensionDrone(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.22;
    gain.connect(this.masterFade);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = 24.0;
    osc2.frequency.value = 27.5; // dissonant interval

    // Faster LFO than deep_space — more urgent sweep
    const lfo = ctx.createOscillator();
    lfo.type = 'sawtooth';
    lfo.frequency.value = 1 / 12; // 12-second cycle (faster)
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 3; // ±3 Hz
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

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
   * Tension dissonance: minor 2nd shimmer — two close-together high tones
   * that beat against each other unpleasantly.
   */
  private _createTensionDissonance(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    gain.connect(this.masterFade);

    // Minor 2nd: B4 (494 Hz) and C5 (523 Hz) — classic dissonance
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.value = midiToHz(71); // B4
    osc2.frequency.value = midiToHz(72); // C5

    // Fast amplitude LFO — creates a pulsing, unsettling quality
    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = 1 / 8; // 8-second pulse
    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.4;
    const ampOffset = ctx.createGain();
    ampOffset.gain.value = 0.5;
    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(ampOffset.gain);

    const reverb = this._createReverb(5, 3);

    osc1.connect(ampOffset);
    osc2.connect(ampOffset);
    ampOffset.connect(reverb);
    reverb.connect(gain);

    osc1.start();
    osc2.start();
    ampLfo.start();

    return {
      nodes: [osc1, osc2, ampLfo, ampLfoGain, ampOffset, reverb, gain],
      gain,
      stop: () => { osc1.stop(); osc2.stop(); ampLfo.stop(); },
    };
  }

  /**
   * Tension texture: higher-frequency bandpass noise with faster sweep —
   * more agitated than the deep_space texture.
   */
  private _createTensionTexture(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    gain.connect(this.masterFade);

    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    // Higher, tighter bandpass
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 350;
    bp.Q.value = 1.5;

    // Faster LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 15; // 15-second sweep (faster)
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150; // wider sweep
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
   * Tension stabs: occasional short, low-pitched impacts at irregular intervals.
   * Creates a sense of lurking threat.
   */
  private _createTensionStabs(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.14;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(3, 2.5);
    reverb.connect(gain);

    let stopped = false;

    const scheduleStab = (): void => {
      if (stopped) return;
      const t = ctx.currentTime;

      // Short, punchy low note — E1 or F1
      const stabMidi = Math.random() < 0.5 ? 28 : 29; // E1 / F1
      const freq = midiToHz(stabMidi);

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      filter.Q.value = 2;
      // Quick filter sweep down
      filter.frequency.setValueAtTime(300, t);
      filter.frequency.exponentialRampToValueAtTime(60, t + 0.4);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.9, t + 0.04);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

      osc.connect(filter);
      filter.connect(env);
      env.connect(reverb);

      osc.start(t);
      osc.stop(t + 0.8);

      // Irregular gaps: 7-20 s
      setTimeout(scheduleStab, 7000 + Math.random() * 13000);
    };

    setTimeout(scheduleStab, 3000 + Math.random() * 5000);

    return {
      nodes: [reverb, gain],
      gain,
      stop: () => { stopped = true; },
    };
  }

  // ── Serenity track layer factories ───────────────────────────────────────

  /**
   * Serenity pad: a single, very quiet sustained tone with an extremely slow
   * filter sweep.  Almost meditative.
   */
  private _createSerenityPad(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(12, 6);
    reverb.connect(gain);

    // Single low sine: C2
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = midiToHz(36); // C2

    // Very slight chorus effect via a second detuned osc
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = midiToHz(36);
    osc2.detune.value = 3;

    // Extremely slow lowpass sweep
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    filter.Q.value = 0.5;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 40; // 40-second sweep — very slow
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60; // ±60 Hz around 180
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(reverb);

    osc.start();
    osc2.start();
    lfo.start();

    return {
      nodes: [osc, osc2, filter, lfo, lfoGain, reverb, gain],
      gain,
      stop: () => { osc.stop(); osc2.stop(); lfo.stop(); },
    };
  }

  /**
   * Serenity shimmer: very occasional high notes at long intervals — sparse
   * and crystalline, like drops of water in a still pool.
   */
  private _createSerenityShimmer(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.025;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(14, 7);
    reverb.connect(gain);

    let stopped = false;

    // Very high notes: G5, A5, E6 — crystalline
    const shimmerMidi = [79, 81, 88];

    const scheduleShimmer = (): void => {
      if (stopped) return;
      const midi = shimmerMidi[Math.floor(Math.random() * shimmerMidi.length)]!;
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(midi);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.5, t + 0.6);
      env.gain.exponentialRampToValueAtTime(0.001, t + 8);

      osc.connect(env);
      env.connect(reverb);
      osc.start(t);
      osc.stop(t + 9);

      // Very long gaps: 15-30 s — extremely sparse
      setTimeout(scheduleShimmer, 15000 + Math.random() * 15000);
    };

    setTimeout(scheduleShimmer, 6000 + Math.random() * 6000);

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
