/**
 * MusicGenerator — procedural ambient music for Ex Nihilo.
 *
 * Scene modes (legacy — used by game scenes to set overall context):
 *   'menu'   — all layers + motif
 *   'galaxy' — drone + texture + shimmer (vast, empty)
 *   'system' — drone + pad + texture (warmer)
 *
 * Music tracks (player-selectable mood):
 *   'deep_space'  — vast and empty; very low drone, slow evolving pad chords
 *   'exploration' — warm Rhodes-like pentatonic melody with gentle bass line
 *   'tension'     — pulsing sub-bass, dissonant slides, sharp noise stabs
 *   'serenity'    — pure sine tones in C major, minimal, long reverb tails
 */

import type { AudioEngine } from './AudioEngine';

// ── Types ───────────────────────────────────────────────────────────────────

export type MusicScene = 'menu' | 'galaxy' | 'system';
export type MusicTrack = 'deep_space' | 'exploration' | 'tension' | 'serenity' | 'stellar_drift' | 'void_pulse' | 'nebula_flow';

interface ActiveLayer {
  nodes: AudioNode[];
  gain: GainNode;
  stop: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const FADE_OUT_TIME = 2.0;   // seconds
const FADE_IN_TIME  = 3.0;   // seconds

/** Auto-rotate to a different track every 5–10 minutes */
const TRACK_ROTATE_MIN_MS = 5 * 60 * 1000;
const TRACK_ROTATE_MAX_MS = 10 * 60 * 1000;
const ALL_TRACKS: MusicTrack[] = ['deep_space', 'exploration', 'tension', 'serenity', 'stellar_drift', 'void_pulse', 'nebula_flow'];

// Pentatonic C-major scale (MIDI note numbers for the motif)
const PENTATONIC = [48, 50, 52, 55, 57]; // C3 D3 E3 G3 A3

// Exploration arpeggio — used only as a fallback; melody now uses a Rhodes tone
const EXPLORATION_ARPEGGIO = [60, 64, 67, 69, 72]; // C4 E4 G4 A4 C5

// Deep Space chord progression: Cm → Fm → Ab → Eb (each held for 30 s)
// Represented as root MIDI notes; chords are built in the pad layer.
const DS_CHORD_ROOTS = [48, 53, 56, 51]; // C3 F3 Ab3 Eb3
const DS_CHORD_TYPE  = ['minor', 'minor', 'major', 'major'] as const; // chord quality
const DS_CHORD_DURATION = 30; // seconds per chord

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
  private rotationTimer: ReturnType<typeof setTimeout> | null = null;

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
    this._scheduleRotation();
  }

  stopMusic(): void {
    this.currentScene = null;
    this._clearRotation();
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
      this._scheduleRotation();
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

  // ── Auto-rotation ─────────────────────────────────────────────────────────

  private _scheduleRotation(): void {
    this._clearRotation();
    const delay = TRACK_ROTATE_MIN_MS + Math.random() * (TRACK_ROTATE_MAX_MS - TRACK_ROTATE_MIN_MS);
    this.rotationTimer = setTimeout(() => this._rotateTrack(), delay);
  }

  private _clearRotation(): void {
    if (this.rotationTimer !== null) {
      clearTimeout(this.rotationTimer);
      this.rotationTimer = null;
    }
  }

  private _rotateTrack(): void {
    if (!this.currentScene) return;
    // Pick a different track at random
    const others = ALL_TRACKS.filter(t => t !== this.currentTrack);
    const next = others[Math.floor(Math.random() * others.length)]!;
    this.setTrack(next);
    // Persist so scene transitions keep the new track
    (window as unknown as Record<string, unknown>).__EX_NIHILO_MUSIC_TRACK__ = next;
    this._scheduleRotation();
  }

  // ── Layer management ────────────────────────────────────────────────────────

  private _startLayers(scene: MusicScene, track: MusicTrack): void {
    const layers: ActiveLayer[] = [];

    switch (track) {
      case 'deep_space':
        layers.push(this._createBassDrone());
        layers.push(this._createDeepSpacePadChords());
        layers.push(this._createTexture());
        if (scene === 'menu') {
          layers.push(this._createMotif());
        }
        break;

      case 'exploration':
        layers.push(this._createExplorationBassLine());
        layers.push(this._createExplorationRhodesMelody());
        layers.push(this._createExplorationPad());
        break;

      case 'tension':
        layers.push(this._createTensionSubBass());
        layers.push(this._createTensionDissonanceSlide());
        layers.push(this._createTensionNoiseStabs());
        break;

      case 'serenity':
        layers.push(this._createSerenityChimes());
        layers.push(this._createSerenityDrone());
        break;

      case 'stellar_drift':
        layers.push(this._createStellarDriftKick());
        layers.push(this._createStellarDriftArpeggio());
        layers.push(this._createStellarDriftPad());
        break;

      case 'void_pulse':
        layers.push(this._createVoidPulseKick());
        layers.push(this._createVoidPulseBassLine());
        layers.push(this._createVoidPulseSynth());
        break;

      case 'nebula_flow':
        layers.push(this._createNebulaFlowKick());
        layers.push(this._createNebulaFlowSequence());
        layers.push(this._createNebulaFlowPad());
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
   * Bass drone: two detuned sines at 28–32 Hz — lower than before, more vast.
   * Very slow LFO sweep.
   */
  private _createBassDrone(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.20;
    gain.connect(this.masterFade);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';
    // Base in the 25-35 Hz range — deeper than the old 40 Hz
    osc1.frequency.value = 30.0;
    osc2.frequency.value = 30.4;

    // Very slow LFO (one cycle every 60 s) — ±2 Hz
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 60;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 2;
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);
    lfoGain.connect(osc2.frequency);

    // Lowpass to strip any overtone content above ~80 Hz — no whistly tone
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 80;
    lp.Q.value = 0.5;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSoftClipCurve(256);
    osc1.connect(shaper);
    osc2.connect(shaper);
    shaper.connect(lp);
    lp.connect(gain);

    osc1.start();
    osc2.start();
    lfo.start();

    return {
      nodes: [osc1, osc2, lfo, lfoGain, shaper, lp, gain],
      gain,
      stop: () => { osc1.stop(); osc2.stop(); lfo.stop(); },
    };
  }

  /**
   * Deep Space pad chords: slow chord progression Cm → Fm → Ab → Eb.
   * Each chord is held for 30 seconds, cross-fading smoothly.
   * Uses filtered sawtooth oscillators to build warm, low-frequency pads.
   * No high-frequency content — all shimmer removed.
   */
  private _createDeepSpacePadChords(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.055;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(10, 5);
    reverb.connect(gain);

    let stopped = false;
    let chordIndex = 0;
    let currentOscs: OscillatorNode[] = [];
    let currentEnvGain: GainNode | null = null;

    const CHORD_INTERVALS = {
      minor: [0, 3, 7],
      major: [0, 4, 7],
    };

    const buildChord = (): void => {
      if (stopped) return;
      const root = DS_CHORD_ROOTS[chordIndex % DS_CHORD_ROOTS.length]!;
      const quality = DS_CHORD_TYPE[chordIndex % DS_CHORD_TYPE.length]!;
      const intervals = CHORD_INTERVALS[quality];
      const t = ctx.currentTime;

      // Fade out old chord
      if (currentEnvGain) {
        const old = currentEnvGain;
        old.gain.linearRampToValueAtTime(0, t + 4);
        // Disconnect old oscs after fade
        setTimeout(() => {
          for (const o of currentOscs) {
            try { o.stop(); } catch { /* */ }
          }
        }, 5000);
      }

      const envGain = ctx.createGain();
      envGain.gain.setValueAtTime(0, t);
      envGain.gain.linearRampToValueAtTime(0.9, t + 4); // fade in over 4 s
      envGain.connect(reverb);

      const oscs: OscillatorNode[] = [];
      for (const interval of intervals) {
        const midi = root + interval;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiToHz(midi);
        osc.detune.value = (Math.random() - 0.5) * 3; // tiny detune for warmth

        // Lowpass to remove high harmonics — keep it warm and low
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 350;
        lp.Q.value = 0.7;

        osc.connect(lp);
        lp.connect(envGain);
        osc.start(t);
        oscs.push(osc);
      }

      currentOscs = oscs;
      currentEnvGain = envGain;
      chordIndex++;

      // Schedule next chord change
      setTimeout(buildChord, DS_CHORD_DURATION * 1000);
    };

    buildChord();

    return {
      nodes: [reverb, gain],
      gain,
      stop: () => {
        stopped = true;
        for (const o of currentOscs) {
          try { o.stop(); } catch { /* */ }
        }
      },
    };
  }

  /**
   * Texture: bandpass-filtered white noise at barely audible volume.
   * Sounds like distant cosmic static / radiation.
   */
  private _createTexture(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.025;
    gain.connect(this.masterFade);

    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;

    // Low bandpass — keep below 200 Hz to avoid any whistly presence
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 100;
    bp.Q.value = 0.5;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 70;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 60;
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

      const gap = 5 + Math.random() * 4;
      setTimeout(() => scheduleNote(noteIndex + 1, 0), (delay + gap) * 1000);
    };

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
   * Exploration bass line: a gentle walking bass that moves under the melody.
   * Warm sine tone with subtle movement — one note every 4–6 s.
   */
  private _createExplorationBassLine(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.10;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(5, 3);
    reverb.connect(gain);

    // Bass line notes: C2, G2, F2, E2, G2, Ab2, G2 — gentle movement
    const bassMidi = [36, 43, 41, 40, 43, 44, 43];
    let stopped = false;
    let noteIdx = 0;

    const scheduleNote = (): void => {
      if (stopped) return;
      const midi = bassMidi[noteIdx % bassMidi.length]!;
      const freq = midiToHz(midi);
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.8, t + 0.08);
      env.gain.exponentialRampToValueAtTime(0.001, t + 4.0);

      // Very light lowpass to keep the bass warm
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;

      osc.connect(lp);
      lp.connect(env);
      env.connect(reverb);
      osc.start(t);
      osc.stop(t + 5);

      noteIdx++;
      const gap = 4000 + Math.random() * 2000;
      setTimeout(scheduleNote, gap);
    };

    setTimeout(scheduleNote, 500 + Math.random() * 1000);

    return {
      nodes: [reverb, gain],
      gain,
      stop: () => { stopped = true; },
    };
  }

  /**
   * Rhodes-like melody: sine tone + slight detuned harmonic above.
   * Plays notes from the pentatonic scale every 2–3 s. Warm and hopeful.
   */
  private _createExplorationRhodesMelody(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.12;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(8, 4.5);
    reverb.connect(gain);

    // Feedback delay for a gentle echo
    const delay = ctx.createDelay(3.0);
    delay.delayTime.value = 0.40;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.35;
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

      // Primary sine — fundamental (Rhodes-like body)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq;

      // Second sine at slightly detuned upper partial — gives a Rhodes-like bell quality
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2.05; // slightly sharp octave above
      osc2.detune.value = 8;

      const env1 = ctx.createGain();
      env1.gain.setValueAtTime(0, t);
      env1.gain.linearRampToValueAtTime(0.85, t + 0.01); // fast attack like Rhodes
      env1.gain.exponentialRampToValueAtTime(0.001, t + 3.0);

      const env2 = ctx.createGain();
      env2.gain.setValueAtTime(0, t);
      env2.gain.linearRampToValueAtTime(0.18, t + 0.005); // upper partial decays faster
      env2.gain.exponentialRampToValueAtTime(0.001, t + 1.0);

      osc1.connect(env1);
      osc2.connect(env2);
      env1.connect(delay);
      env2.connect(delay);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 4);
      osc2.stop(t + 2);

      noteIndex++;
      // One note every 2–3 seconds
      const gap = 2000 + Math.random() * 1000;
      setTimeout(scheduleNote, gap);
    };

    setTimeout(scheduleNote, 1200 + Math.random() * 800);

    return {
      nodes: [reverb, delay, fbGain, gain],
      gain,
      stop: () => { stopped = true; },
    };
  }

  /**
   * Exploration pad: a sustained C-major chord with very slow swell.
   * Warm, open. No shimmer overtones.
   */
  private _createExplorationPad(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
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
      osc.detune.value = (Math.random() - 0.5) * 4;

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
    lfo.frequency.value = 1 / 20;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();

    return {
      nodes: [...oscs, lfo, lfoGain, reverb, gain],
      gain,
      stop: () => { oscs.forEach((o) => o.stop()); lfo.stop(); },
    };
  }

  // ── Tension track layer factories ─────────────────────────────────────────

  /**
   * Tension sub-bass: 30 Hz sine with 0.5 Hz amplitude modulation.
   * Pulsing, dangerous, visceral.
   */
  private _createTensionSubBass(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.25;
    gain.connect(this.masterFade);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 30;

    // 0.5 Hz AM — slow dread pulse
    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = 0.5;

    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.45;
    const dcOffset = ctx.createGain();
    dcOffset.gain.value = 0.55; // so gain never goes below 0.1

    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(dcOffset.gain);
    osc.connect(dcOffset);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 90;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSoftClipCurve(256);
    dcOffset.connect(shaper);
    shaper.connect(lp);
    lp.connect(gain);

    osc.start();
    ampLfo.start();

    return {
      nodes: [osc, ampLfo, ampLfoGain, dcOffset, shaper, lp, gain],
      gain,
      stop: () => { osc.stop(); ampLfo.stop(); },
    };
  }

  /**
   * Tension dissonance: two close-together sines that slide.
   * Minor seconds that drift upward over time — unsettling, dangerous.
   */
  private _createTensionDissonanceSlide(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(5, 3);
    reverb.connect(gain);

    // Start at B3/C4 minor 2nd, slowly glide upward over ~40 s then back
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'sine';

    const now = ctx.currentTime;
    osc1.frequency.setValueAtTime(midiToHz(59), now); // B3
    osc2.frequency.setValueAtTime(midiToHz(60), now); // C4

    // Slow upward slide: both oscillators glide ±6 semitones over 40 s
    const slideLfo = ctx.createOscillator();
    slideLfo.type = 'sine';
    slideLfo.frequency.value = 1 / 40;
    const slideLfoGain = ctx.createGain();
    // 6 semitones ≈ ratio 1.5, centred on base freq; use detune in cents
    slideLfoGain.gain.value = 200; // ±200 cents
    slideLfo.connect(slideLfoGain);
    slideLfoGain.connect(osc1.detune);
    slideLfoGain.connect(osc2.detune);

    // Pulsing amplitude — slower than before for added dread
    const ampLfo = ctx.createOscillator();
    ampLfo.type = 'sine';
    ampLfo.frequency.value = 1 / 6; // 6-second pulse
    const ampLfoGain = ctx.createGain();
    ampLfoGain.gain.value = 0.4;
    const ampOffset = ctx.createGain();
    ampOffset.gain.value = 0.5;
    ampLfo.connect(ampLfoGain);
    ampLfoGain.connect(ampOffset.gain);

    osc1.connect(ampOffset);
    osc2.connect(ampOffset);
    ampOffset.connect(reverb);

    osc1.start();
    osc2.start();
    slideLfo.start();
    ampLfo.start();

    return {
      nodes: [osc1, osc2, slideLfo, slideLfoGain, ampLfo, ampLfoGain, ampOffset, reverb, gain],
      gain,
      stop: () => { osc1.stop(); osc2.stop(); slideLfo.stop(); ampLfo.stop(); },
    };
  }

  /**
   * Tension noise stabs: short bursts of white noise (50 ms each) at
   * irregular intervals — sharp transient impacts. Dangerous.
   */
  private _createTensionNoiseStabs(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.18;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(2, 2.5);
    reverb.connect(gain);

    let stopped = false;

    const scheduleStab = (): void => {
      if (stopped) return;
      const t = ctx.currentTime;

      // 50 ms white noise burst
      const stabLen = Math.floor(ctx.sampleRate * 0.05);
      const stabBuf = ctx.createBuffer(1, stabLen, ctx.sampleRate);
      const stabData = stabBuf.getChannelData(0);
      for (let i = 0; i < stabLen; i++) {
        stabData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / stabLen, 2);
      }

      const src = ctx.createBufferSource();
      src.buffer = stabBuf;

      // High-pass to give a crisp "snap"
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1500;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.9, t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      src.connect(hp);
      hp.connect(env);
      env.connect(reverb);
      src.start(t);

      // Irregular gaps: 6–18 s
      setTimeout(scheduleStab, 6000 + Math.random() * 12000);
    };

    setTimeout(scheduleStab, 2000 + Math.random() * 4000);

    return {
      nodes: [reverb, gain],
      gain,
      stop: () => { stopped = true; },
    };
  }

  // ── Serenity track layer factories ───────────────────────────────────────

  /**
   * Serenity chimes: pure sine tones in C major with very long reverb tails.
   * Wind chimes in space. Notes from C major: C5, E5, G5, A5, C6.
   */
  private _createSerenityChimes(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.028;
    gain.connect(this.masterFade);

    // Long cathedral reverb
    const reverb = this._createReverb(16, 7.5);
    reverb.connect(gain);

    let stopped = false;

    // Pure C major: C5, E5, G5, A5, C6
    const chimeMidi = [72, 76, 79, 81, 84];

    const scheduleChime = (): void => {
      if (stopped) return;
      const midi = chimeMidi[Math.floor(Math.random() * chimeMidi.length)]!;
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midiToHz(midi);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.7, t + 0.02); // fast attack
      env.gain.exponentialRampToValueAtTime(0.001, t + 8); // very long decay

      osc.connect(env);
      env.connect(reverb);
      osc.start(t);
      osc.stop(t + 9);

      // Very long gaps: 12–28 s — extremely sparse, like wind chimes
      setTimeout(scheduleChime, 12000 + Math.random() * 16000);
    };

    // First chime after a brief wait
    setTimeout(scheduleChime, 4000 + Math.random() * 4000);

    return {
      nodes: [reverb, gain],
      gain,
      stop: () => { stopped = true; },
    };
  }

  /**
   * Serenity drone: a pair of pure sine tones (C3 + G3) at very low volume.
   * Near-silence — just enough to fill the room. Very slow filter.
   */
  private _createSerenityDrone(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.022; // quietest of all tracks
    gain.connect(this.masterFade);

    const reverb = this._createReverb(14, 7);
    reverb.connect(gain);

    // C major perfect fifth: C3 + G3
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = midiToHz(48); // C3

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = midiToHz(55); // G3
    osc2.detune.value = 2; // tiny detune for gentle beating

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 250;

    osc1.connect(lp);
    osc2.connect(lp);
    lp.connect(reverb);

    osc1.start();
    osc2.start();

    return {
      nodes: [osc1, osc2, lp, reverb, gain],
      gain,
      stop: () => { osc1.stop(); osc2.stop(); },
    };
  }

  // ── Stellar Drift — dreamy upbeat trance with slow arpeggiated synth ──────

  private _createStellarDriftKick(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.06;
    gain.connect(this.masterFade);

    // Soft four-on-the-floor kick at ~120 BPM (500ms interval)
    let stopped = false;
    const scheduleKick = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.5, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(env);
      env.connect(gain);
      osc.start(now);
      osc.stop(now + 0.3);
      setTimeout(scheduleKick, 500);
    };
    scheduleKick();

    return { nodes: [gain], gain, stop: () => { stopped = true; } };
  }

  private _createStellarDriftArpeggio(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(6, 4);
    reverb.connect(gain);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2500;
    lp.Q.value = 2;
    lp.connect(reverb);

    // Am7 arpeggio: A3 C4 E4 G4 — one note per 250ms (16th notes at 120BPM)
    const notes = [57, 60, 64, 67, 72, 67, 64, 60]; // A3 C4 E4 G4 C5 G4 E4 C4
    let noteIdx = 0;
    let stopped = false;

    const scheduleNote = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToHz(notes[noteIdx % notes.length]!);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.4, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(env);
      env.connect(lp);
      osc.start(now);
      osc.stop(now + 0.25);
      noteIdx++;
      setTimeout(scheduleNote, 250);
    };
    scheduleNote();

    return { nodes: [lp, reverb, gain], gain, stop: () => { stopped = true; } };
  }

  private _createStellarDriftPad(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.025;
    gain.connect(this.masterFade);

    // Slow Am chord pad
    const freqs = [midiToHz(57), midiToHz(60), midiToHz(64)]; // A3 C4 E4
    const oscs: OscillatorNode[] = [];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 8;
      osc.connect(gain);
      osc.start();
      oscs.push(osc);
    }

    return { nodes: [...oscs, gain], gain, stop: () => oscs.forEach(o => o.stop()) };
  }

  // ── Void Pulse — darker minimal trance with pulsing bass ────────────────

  private _createVoidPulseKick(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.065;
    gain.connect(this.masterFade);

    // Harder kick at ~130 BPM (461ms)
    let stopped = false;
    const scheduleKick = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 0.15);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.6, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(env);
      env.connect(gain);
      osc.start(now);
      osc.stop(now + 0.35);
      setTimeout(scheduleKick, 461);
    };
    scheduleKick();

    return { nodes: [gain], gain, stop: () => { stopped = true; } };
  }

  private _createVoidPulseBassLine(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    gain.connect(this.masterFade);

    // Pulsing E minor bass: E2 → B1 → C2 → D2, one note per 2 beats
    const bassNotes = [40, 35, 36, 38]; // E2 B1 C2 D2
    let noteIdx = 0;
    let stopped = false;

    const scheduleNote = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = midiToHz(bassNotes[noteIdx % bassNotes.length]!);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(400, now);
      lp.frequency.linearRampToValueAtTime(120, now + 0.8);
      lp.Q.value = 5;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.6, now);
      env.gain.exponentialRampToValueAtTime(0.01, now + 0.85);
      osc.connect(lp);
      lp.connect(env);
      env.connect(gain);
      osc.start(now);
      osc.stop(now + 0.9);
      noteIdx++;
      setTimeout(scheduleNote, 922); // 2 beats at 130BPM
    };
    scheduleNote();

    return { nodes: [gain], gain, stop: () => { stopped = true; } };
  }

  private _createVoidPulseSynth(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.02;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(8, 5);
    reverb.connect(gain);

    // Sparse high stabs — E minor pentatonic
    const stabs = [64, 67, 71, 72, 76]; // E4 G4 B4 C5 E5
    let stopped = false;

    const scheduleStab = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      const note = stabs[Math.floor(Math.random() * stabs.length)]!;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = midiToHz(note);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.3, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(env);
      env.connect(reverb);
      osc.start(now);
      osc.stop(now + 0.5);
      // Random interval: every 2-6 beats
      setTimeout(scheduleStab, 922 + Math.random() * 1844);
    };
    setTimeout(scheduleStab, 1500);

    return { nodes: [reverb, gain], gain, stop: () => { stopped = true; } };
  }

  // ── Nebula Flow — warm progressive trance with flowing melody ───────────

  private _createNebulaFlowKick(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.055;
    gain.connect(this.masterFade);

    // Gentle kick at ~125 BPM (480ms)
    let stopped = false;
    const scheduleKick = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(70, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.1);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.4, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(env);
      env.connect(gain);
      osc.start(now);
      osc.stop(now + 0.25);
      setTimeout(scheduleKick, 480);
    };
    scheduleKick();

    return { nodes: [gain], gain, stop: () => { stopped = true; } };
  }

  private _createNebulaFlowSequence(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    gain.connect(this.masterFade);

    const reverb = this._createReverb(5, 3);
    reverb.connect(gain);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    lp.Q.value = 1.5;
    lp.connect(reverb);

    // Flowing D minor melody: D4 F4 A4 C5 D5 — 8th notes
    const melody = [62, 65, 69, 72, 74, 72, 69, 65, 62, 60, 62, 65];
    let noteIdx = 0;
    let stopped = false;

    const scheduleNote = () => {
      if (stopped) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = midiToHz(melody[noteIdx % melody.length]!);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.35, now);
      env.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(env);
      env.connect(lp);
      osc.start(now);
      osc.stop(now + 0.25);
      noteIdx++;
      setTimeout(scheduleNote, 240); // 8th notes at 125BPM
    };
    scheduleNote();

    return { nodes: [lp, reverb, gain], gain, stop: () => { stopped = true; } };
  }

  private _createNebulaFlowPad(): ActiveLayer {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.02;
    gain.connect(this.masterFade);

    // Dm7 chord: D3 F3 A3 C4
    const freqs = [midiToHz(50), midiToHz(53), midiToHz(57), midiToHz(60)];
    const oscs: OscillatorNode[] = [];
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = (Math.random() - 0.5) * 6;
      osc.connect(gain);
      osc.start();
      oscs.push(osc);
    }

    return { nodes: [...oscs, gain], gain, stop: () => oscs.forEach(o => o.stop()) };
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
