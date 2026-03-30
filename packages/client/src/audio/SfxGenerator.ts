/**
 * SfxGenerator — UI and game-event sound effects for Ex Nihilo.
 *
 * All sounds are procedurally synthesised.
 *
 * UI effects:
 *   click         — short soft blip  (sine 800 Hz, 50 ms)
 *   selectSystem  — soft ascending two-tone chime
 *   hover         — barely audible tick (1 ms noise burst)
 *   menuOpen      — low rising tone sweep (200→400 Hz, 200 ms)
 *   menuClose     — reverse of open (400→200 Hz)
 *   speedUp       — quick ascending blip
 *   speedDown     — quick descending blip
 *   error         — short buzz (sawtooth 150 Hz, bandpass filtered, 120 ms)
 *
 * Game event effects:
 *   buildComplete    — rising chime (C5→E5→G5, 200 ms)
 *   coloniseStart    — hopeful ascending tones (C4→E4→G4, 300 ms, soft attack)
 *   coloniseComplete — triumphant chord (C4+E4+G4, 500 ms, with reverb)
 *   shipLaunch       — noise sweep low→high + engine ignition (400 ms)
 *   researchComplete — sparkle discovery sound (high randomised tones, 250 ms)
 *   warDeclared      — ominous brass-like hit (50 Hz sawtooth, 800 ms, distortion)
 *   treatySign       — gentle bell (sine 880 Hz, long exponential decay, 600 ms)
 *   migrationWave    — soft departure sound (descending tone, 200 ms)
 *   fleetMove        — engine engage (filtered noise burst + rising sine, 300 ms)
 *   battleStart      — alarm klaxon (alternating 400/600 Hz, 500 ms)
 *   battleResult     — victory fanfare (ascending phrase + chord) or defeat sting (descending smear + thud)
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

  // ── UI effects ──────────────────────────────────────────────────────────────

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

  /**
   * Error: short buzz — sawtooth filtered to midrange, brief and recognisable
   * without being harsh.
   */
  playError(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 150;

    // Bandpass to soften the harshness
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 300;
    bp.Q.value = 1.5;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.055, now + 0.008);
    env.gain.setValueAtTime(0.055, now + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(bp);
    bp.connect(env);
    env.connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.14);
    osc.onended = () => env.disconnect();
  }

  // ── Game event effects ──────────────────────────────────────────────────────

  /**
   * Build complete: satisfying rising chime.
   * C5 (523 Hz) → E5 (659 Hz) → G5 (784 Hz), 200 ms total.
   */
  playBuildComplete(): void {
    const now = this.ctx.currentTime;
    // C5
    this._playToneAt(523.25, 0.09, now, 0.05, 0.08);
    // E5 — starts 65 ms after C5
    this._playToneAt(659.25, 0.08, now + 0.065, 0.06, 0.09);
    // G5 — starts 130 ms after C5
    this._playToneAt(783.99, 0.075, now + 0.13, 0.07, 0.10);
  }

  /**
   * Colonise start: hopeful ascending tones.
   * C4 → E4 → G4 over 300 ms, with a soft attack (slow fade-in per note).
   */
  playColoniseStart(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.00]; // C4 E4 G4
    const gap = 0.1; // 100 ms between notes

    notes.forEach((freq, i) => {
      const t = now + i * gap;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      // Soft attack: 30 ms fade-in instead of 5 ms
      env.gain.linearRampToValueAtTime(0.07, t + 0.03);
      env.gain.setValueAtTime(0.07, t + 0.07);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

      osc.connect(env);
      env.connect(this.bus);
      osc.start(t);
      osc.stop(t + 0.18);
      osc.onended = () => env.disconnect();
    });
  }

  /**
   * Colonise complete: triumphant C major chord with reverb.
   * C4 + E4 + G4 sounding together, 500 ms with reverb tail.
   */
  playColoniseComplete(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Build a small reverb IR
    const reverb = this._createQuickReverb(2.5, 3.0);
    reverb.connect(this.bus);

    const chord = [261.63, 329.63, 392.00]; // C4 E4 G4
    for (const freq of chord) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.07, now + 0.01);
      env.gain.setValueAtTime(0.07, now + 0.35);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc.connect(env);
      env.connect(reverb);
      osc.start(now);
      osc.stop(now + 0.52);
    }

    // Disconnect reverb after tail
    setTimeout(() => reverb.disconnect(), 3500);
  }

  /**
   * Ship launch: noise sweep low→high followed by engine ignition drone.
   * Total duration ~400 ms.
   */
  playShipLaunch(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Whoosh: noise with a highpass sweep from 100→4000 Hz over 250 ms
    const bufLen = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(i / bufLen, 0.5) * Math.pow(1 - i / bufLen, 2);
    }
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(80, now);
    hp.frequency.exponentialRampToValueAtTime(3500, now + 0.25);

    const whooshEnv = ctx.createGain();
    whooshEnv.gain.setValueAtTime(0.09, now);
    whooshEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    whoosh.connect(hp);
    hp.connect(whooshEnv);
    whooshEnv.connect(this.bus);
    whoosh.start(now);
    whoosh.onended = () => whooshEnv.disconnect();

    // Engine ignition: short sawtooth burst with fast decay
    const engOsc = ctx.createOscillator();
    engOsc.type = 'sawtooth';
    engOsc.frequency.setValueAtTime(60, now + 0.18);
    engOsc.frequency.exponentialRampToValueAtTime(120, now + 0.4);

    const engLp = ctx.createBiquadFilter();
    engLp.type = 'lowpass';
    engLp.frequency.value = 350;

    const engEnv = ctx.createGain();
    engEnv.gain.setValueAtTime(0, now + 0.18);
    engEnv.gain.linearRampToValueAtTime(0.07, now + 0.22);
    engEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    engOsc.connect(engLp);
    engLp.connect(engEnv);
    engEnv.connect(this.bus);
    engOsc.start(now + 0.18);
    engOsc.stop(now + 0.42);
    engOsc.onended = () => engEnv.disconnect();
  }

  /**
   * Research complete: sparkle/discovery sound.
   * 5–7 randomised high sine tones in quick succession (200 ms).
   */
  playResearchComplete(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // High notes in C major pentatonic above C5
    const sparkMidi = [72, 74, 76, 79, 81, 84, 86];
    const count = 5 + Math.floor(Math.random() * 3);
    const stepMs = 35;

    for (let i = 0; i < count; i++) {
      const midi = sparkMidi[Math.floor(Math.random() * sparkMidi.length)]!;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      const t = now + i * stepMs / 1000;

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.065, t + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

      osc.connect(env);
      env.connect(this.bus);
      osc.start(t);
      osc.stop(t + 0.20);
      osc.onended = () => env.disconnect();
    }
  }

  /**
   * War declared: ominous brass-like hit with soft distortion.
   * 800 ms, 50 Hz sawtooth hit then descending sweep, dark and menacing.
   */
  playWarDeclared(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    // Start at 50 Hz for ominous impact, then descend to 40 Hz
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);

    // Soft distortion via waveshaper
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(200, 8);

    // Lowpass to remove harsh high harmonics
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 0.8;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.07, now + 0.06);
    env.gain.setValueAtTime(0.07, now + 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

    osc.connect(shaper);
    shaper.connect(lp);
    lp.connect(env);
    env.connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.82);
    osc.onended = () => env.disconnect();
  }

  /**
   * Battle result: victory fanfare or defeat sting.
   *
   * Victory (won = true):
   *   Ascending perfect-fourth + major-third phrase (C4→F4→A4) with reverb
   *   tail, followed by a sustaining chord.  Triumphant but measured — not as
   *   elaborate as coloniseComplete so it doesn't overstay its welcome.
   *
   * Defeat (won = false):
   *   Descending chromatic smear from G3 to D3 over 600 ms on a sawtooth with
   *   lowpass, plus a low resonant thud — ominous and final.
   */
  playBattleResult(won: boolean): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    if (won) {
      // ── Victory fanfare ──────────────────────────────────────────────────────
      const reverb = this._createQuickReverb(1.8, 2.5);
      reverb.connect(this.bus);

      // Three ascending tones: C4 (261.63) → F4 (349.23) → A4 (440)
      const fanfare: Array<[number, number]> = [
        [261.63, 0.00],
        [349.23, 0.12],
        [440.00, 0.24],
      ];
      for (const [freq, delay] of fanfare) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const env = ctx.createGain();
        const t = now + delay;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.09, t + 0.01);
        env.gain.setValueAtTime(0.09, t + 0.10);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);

        osc.connect(env);
        env.connect(reverb);
        osc.start(t);
        osc.stop(t + 0.57);
        osc.onended = () => env.disconnect();
      }

      // Sustained chord: C4 + E4 + G4 starting at 0.36 s
      const chord = [261.63, 329.63, 392.00];
      for (const freq of chord) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const env = ctx.createGain();
        const t = now + 0.36;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.065, t + 0.02);
        env.gain.setValueAtTime(0.065, t + 0.30);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.70);

        osc.connect(env);
        env.connect(reverb);
        osc.start(t);
        osc.stop(t + 0.72);
        osc.onended = () => env.disconnect();
      }

      // Disconnect reverb after tail
      setTimeout(() => reverb.disconnect(), 2800);

    } else {
      // ── Defeat sting ─────────────────────────────────────────────────────────
      // Descending smear: G3 (196) → D3 (146.83) over 600 ms, sawtooth + lowpass
      const oscSmear = ctx.createOscillator();
      oscSmear.type = 'sawtooth';
      oscSmear.frequency.setValueAtTime(196, now);
      oscSmear.frequency.exponentialRampToValueAtTime(146.83, now + 0.6);

      const defeatLp = ctx.createBiquadFilter();
      defeatLp.type = 'lowpass';
      defeatLp.frequency.setValueAtTime(600, now);
      defeatLp.frequency.exponentialRampToValueAtTime(200, now + 0.6);
      defeatLp.Q.value = 1.0;

      const envSmear = ctx.createGain();
      envSmear.gain.setValueAtTime(0, now);
      envSmear.gain.linearRampToValueAtTime(0.07, now + 0.04);
      envSmear.gain.setValueAtTime(0.07, now + 0.40);
      envSmear.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      oscSmear.connect(defeatLp);
      defeatLp.connect(envSmear);
      envSmear.connect(this.bus);
      oscSmear.start(now);
      oscSmear.stop(now + 0.67);
      oscSmear.onended = () => envSmear.disconnect();

      // Low thud: very short sine at A1 (55 Hz) → 30 Hz
      const thudOsc = ctx.createOscillator();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(55, now + 0.50);
      thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.90);

      const thudEnv = ctx.createGain();
      thudEnv.gain.setValueAtTime(0, now + 0.50);
      thudEnv.gain.linearRampToValueAtTime(0.10, now + 0.52);
      thudEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.92);

      thudOsc.connect(thudEnv);
      thudEnv.connect(this.bus);
      thudOsc.start(now + 0.50);
      thudOsc.stop(now + 0.94);
      thudOsc.onended = () => thudEnv.disconnect();
    }
  }

  /**
   * Treaty sign: gentle bell tone.
   * Pure sine at 880 Hz (A5) with a long exponential decay — 600 ms.
   */
  playTreatySign(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;

    // Second partial (slightly detuned) for bell character
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 880 * 2.75; // inharmonic partial — bell-like
    osc2.detune.value = 15;

    // Long exponential decay out to 600 ms
    const env1 = ctx.createGain();
    env1.gain.setValueAtTime(0, now);
    env1.gain.linearRampToValueAtTime(0.08, now + 0.005);
    env1.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    const env2 = ctx.createGain();
    env2.gain.setValueAtTime(0, now);
    env2.gain.linearRampToValueAtTime(0.025, now + 0.005);
    env2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(env1);
    osc2.connect(env2);
    env1.connect(this.bus);
    env2.connect(this.bus);
    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.62);
    osc2.stop(now + 0.24);
    osc.onended = () => env1.disconnect();
    osc2.onended = () => env2.disconnect();
  }

  /**
   * Migration wave: soft departure sound.
   * Descending tone from G4 (392 Hz) to D4 (294 Hz), 200 ms.
   */
  playMigrationWave(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(392, now);
    osc.frequency.linearRampToValueAtTime(294, now + 0.16);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.055, now + 0.02);
    env.gain.setValueAtTime(0.055, now + 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(env);
    env.connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.22);
    osc.onended = () => env.disconnect();
  }

  /**
   * Fleet move: engine engage sound.
   * Short filtered noise burst followed by a rising sine, 300 ms total.
   */
  playFleetMove(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Filtered noise burst — engine ignition
    const bufLen = Math.floor(ctx.sampleRate * 0.15);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.5);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;

    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 600;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.07, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noiseSrc.connect(noiseLp);
    noiseLp.connect(noiseEnv);
    noiseEnv.connect(this.bus);
    noiseSrc.start(now);
    noiseSrc.onended = () => noiseEnv.disconnect();

    // Rising sine — engine spooling up
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now + 0.08);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.30);

    const oscEnv = ctx.createGain();
    oscEnv.gain.setValueAtTime(0, now + 0.08);
    oscEnv.gain.linearRampToValueAtTime(0.06, now + 0.14);
    oscEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);

    osc.connect(oscEnv);
    oscEnv.connect(this.bus);
    osc.start(now + 0.08);
    osc.stop(now + 0.32);
    osc.onended = () => oscEnv.disconnect();
  }

  /**
   * Battle start: alarm klaxon.
   * Alternating 400 Hz / 600 Hz tones, three pulses, 500 ms total.
   */
  playBattleStart(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Three alternating klaxon pulses: low–high–low
    const pulses = [
      { freq: 400, t: 0 },
      { freq: 600, t: 0.17 },
      { freq: 400, t: 0.34 },
    ];

    for (const p of pulses) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = p.freq;

      // Bandpass to give it a klaxon character
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = p.freq * 1.5;
      bp.Q.value = 1.2;

      const env = ctx.createGain();
      const t = now + p.t;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.065, t + 0.01);
      env.gain.setValueAtTime(0.065, t + 0.10);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

      osc.connect(bp);
      bp.connect(env);
      env.connect(this.bus);
      osc.start(t);
      osc.stop(t + 0.18);
      osc.onended = () => env.disconnect();
    }
  }

  // ── Tactical combat weapon effects ─────────────────────────────────────────

  /**
   * Beam pulse: short zappy burst.
   * High-frequency sine (2000 Hz) swept down to 800 Hz in 60 ms, lowpass filtered.
   * Classic laser-pew sound.
   */
  playBeamPulse(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.06);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3000;
    lp.Q.value = 1.0;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.05, now + 0.003);
    env.gain.setValueAtTime(0.05, now + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(lp);
    lp.connect(env);
    env.connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.08);
    osc.onended = () => env.disconnect();
  }

  /**
   * Beam particle: sustained hum.
   * Lower frequency (400 Hz) with slight vibrato, 150 ms.
   * Heavier, more powerful sound for particle beams.
   */
  playBeamParticle(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);

    // Slight vibrato via LFO
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 30;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 15; // ±15 Hz wobble
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.06, now + 0.01);
    env.gain.setValueAtTime(0.06, now + 0.10);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(env);
    env.connect(this.bus);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.17);
    lfo.stop(now + 0.17);
    osc.onended = () => { env.disconnect(); lfoGain.disconnect(); };
  }

  /**
   * Beam disruptor: crackling electric.
   * White noise filtered through bandpass at 1500 Hz + sine wobble, 100 ms.
   * Lightning-like disruption effect.
   */
  playBeamDisruptor(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // White noise source
    const bufLen = Math.floor(ctx.sampleRate * 0.1);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 2.0;

    // Sine wobble layered on top
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.linearRampToValueAtTime(1800, now + 0.05);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.10);

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0, now);
    noiseEnv.gain.linearRampToValueAtTime(0.06, now + 0.005);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);

    const oscEnv = ctx.createGain();
    oscEnv.gain.setValueAtTime(0, now);
    oscEnv.gain.linearRampToValueAtTime(0.03, now + 0.005);
    oscEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);

    noiseSrc.connect(bp);
    bp.connect(noiseEnv);
    noiseEnv.connect(this.bus);

    osc.connect(oscEnv);
    oscEnv.connect(this.bus);

    noiseSrc.start(now);
    osc.start(now);
    osc.stop(now + 0.12);
    osc.onended = () => oscEnv.disconnect();
    noiseSrc.onended = () => noiseEnv.disconnect();
  }

  /**
   * Beam plasma: deep whoosh.
   * Low sine (200 Hz) swept up to 600 Hz with soft distortion, 200 ms.
   * Heavy, devastating plasma lance sound.
   */
  playBeamPlasma(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);

    // Soft distortion for grit
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(200, 6);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.8;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.06, now + 0.01);
    env.gain.setValueAtTime(0.06, now + 0.12);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.20);

    osc.connect(shaper);
    shaper.connect(lp);
    lp.connect(env);
    env.connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.22);
    osc.onended = () => env.disconnect();
  }

  /**
   * Projectile kinetic: sharp crack.
   * Very short noise burst (10 ms) with high-pass filter. Gunshot-like.
   */
  playProjectileKinetic(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufLen = Math.floor(ctx.sampleRate * 0.01);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.05, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

    src.connect(hp);
    hp.connect(env);
    env.connect(this.bus);
    src.start(now);
    src.onended = () => env.disconnect();
  }

  /**
   * Projectile gauss: electromagnetic whine.
   * Ascending sine from 1000→3000 Hz in 40 ms then cut. Railgun sound.
   */
  playProjectileGauss(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(3000, now + 0.04);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.05, now + 0.003);
    env.gain.setValueAtTime(0.05, now + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

    osc.connect(env);
    env.connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.06);
    osc.onended = () => env.disconnect();
  }

  /**
   * Projectile mass driver: thump + whizz.
   * Low noise thump (30 ms) followed by descending sine (2000→500 Hz, 80 ms).
   */
  playProjectileMassDriver(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low thump: short noise burst
    const bufLen = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
    }
    const thump = ctx.createBufferSource();
    thump.buffer = buf;

    const thumpLp = ctx.createBiquadFilter();
    thumpLp.type = 'lowpass';
    thumpLp.frequency.value = 400;

    const thumpEnv = ctx.createGain();
    thumpEnv.gain.setValueAtTime(0.06, now);
    thumpEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    thump.connect(thumpLp);
    thumpLp.connect(thumpEnv);
    thumpEnv.connect(this.bus);
    thump.start(now);
    thump.onended = () => thumpEnv.disconnect();

    // Descending whizz
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, now + 0.02);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.10);

    const whizzEnv = ctx.createGain();
    whizzEnv.gain.setValueAtTime(0, now + 0.02);
    whizzEnv.gain.linearRampToValueAtTime(0.04, now + 0.025);
    whizzEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);

    osc.connect(whizzEnv);
    whizzEnv.connect(this.bus);
    osc.start(now + 0.02);
    osc.stop(now + 0.12);
    osc.onended = () => whizzEnv.disconnect();
  }

  /**
   * Missile launch: whoosh + ignition.
   * Noise sweep low→high (200 ms) with a rising sine undertone. Rocket launch.
   */
  playMissileLaunch(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Whoosh: noise with rising highpass
    const bufLen = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(i / bufLen, 0.4) * Math.pow(1 - i / bufLen, 1.5);
    }
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(100, now);
    hp.frequency.exponentialRampToValueAtTime(3000, now + 0.2);

    const whooshEnv = ctx.createGain();
    whooshEnv.gain.setValueAtTime(0.06, now);
    whooshEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    whoosh.connect(hp);
    hp.connect(whooshEnv);
    whooshEnv.connect(this.bus);
    whoosh.start(now);
    whoosh.onended = () => whooshEnv.disconnect();

    // Rising sine undertone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.18);

    const oscEnv = ctx.createGain();
    oscEnv.gain.setValueAtTime(0, now);
    oscEnv.gain.linearRampToValueAtTime(0.04, now + 0.03);
    oscEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(oscEnv);
    oscEnv.connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.22);
    osc.onended = () => oscEnv.disconnect();
  }

  /**
   * Missile impact: explosion.
   * Low sine (80 Hz, 50 ms) + noise burst (100 ms) with quick decay. Boom.
   */
  playMissileImpact(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Low thud
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);

    const thudEnv = ctx.createGain();
    thudEnv.gain.setValueAtTime(0, now);
    thudEnv.gain.linearRampToValueAtTime(0.07, now + 0.003);
    thudEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(thudEnv);
    thudEnv.connect(this.bus);
    osc.start(now);
    osc.stop(now + 0.07);
    osc.onended = () => thudEnv.disconnect();

    // Noise burst
    const bufLen = Math.floor(ctx.sampleRate * 0.1);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2.5);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;

    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 1200;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.05, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.10);

    noiseSrc.connect(noiseLp);
    noiseLp.connect(noiseEnv);
    noiseEnv.connect(this.bus);
    noiseSrc.start(now);
    noiseSrc.onended = () => noiseEnv.disconnect();
  }

  /**
   * Point defence: rapid staccato.
   * 3 very quick high-pitched clicks (3000 Hz, 5 ms each, 15 ms apart). PD burst.
   */
  playPointDefence(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.015;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 3000;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.04, t + 0.001);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.005);

      osc.connect(env);
      env.connect(this.bus);
      osc.start(t);
      osc.stop(t + 0.007);
      osc.onended = () => env.disconnect();
    }
  }

  /**
   * Fighter buzz: tiny engine.
   * Very quiet high sine (4000 Hz) with rapid amplitude modulation, 50 ms.
   * Mosquito-like buzz.
   */
  playFighterBuzz(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 4000;

    // Rapid AM via LFO for buzz character
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 120;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.03, now + 0.005);
    env.gain.setValueAtTime(0.03, now + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    // Connect LFO to envelope gain for AM effect
    lfoGain.connect(env.gain);

    osc.connect(env);
    env.connect(this.bus);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.06);
    lfo.stop(now + 0.06);
    osc.onended = () => { env.disconnect(); lfoGain.disconnect(); };
  }

  /**
   * Shield hit: electrical shimmer.
   * Sine (1200 Hz) with quick tremolo + white noise, 80 ms.
   * Shield absorption/deflection sound.
   */
  playShieldHit(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Shimmer sine with tremolo
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 1200;

    const tremolo = ctx.createOscillator();
    tremolo.type = 'sine';
    tremolo.frequency.value = 60;
    const tremoloGain = ctx.createGain();
    tremoloGain.gain.value = 0.02;
    tremolo.connect(tremoloGain);

    const oscEnv = ctx.createGain();
    oscEnv.gain.setValueAtTime(0, now);
    oscEnv.gain.linearRampToValueAtTime(0.04, now + 0.005);
    oscEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    tremoloGain.connect(oscEnv.gain);

    osc.connect(oscEnv);
    oscEnv.connect(this.bus);
    osc.start(now);
    tremolo.start(now);
    osc.stop(now + 0.10);
    tremolo.stop(now + 0.10);

    // White noise layer
    const bufLen = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;

    const noiseBp = ctx.createBiquadFilter();
    noiseBp.type = 'bandpass';
    noiseBp.frequency.value = 2000;
    noiseBp.Q.value = 1.5;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.03, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    noiseSrc.connect(noiseBp);
    noiseBp.connect(noiseEnv);
    noiseEnv.connect(this.bus);
    noiseSrc.start(now);
    noiseSrc.onended = () => noiseEnv.disconnect();
    osc.onended = () => { oscEnv.disconnect(); tremoloGain.disconnect(); };
  }

  /**
   * Explosion: ship destruction.
   * Heavy low boom (50 Hz, 200 ms) + noise burst + descending sweep. Big kaboom.
   */
  playCombatExplosion(): void {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Heavy low boom
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(50, now);
    boom.frequency.exponentialRampToValueAtTime(25, now + 0.2);

    const boomEnv = ctx.createGain();
    boomEnv.gain.setValueAtTime(0, now);
    boomEnv.gain.linearRampToValueAtTime(0.08, now + 0.01);
    boomEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    boom.connect(boomEnv);
    boomEnv.connect(this.bus);
    boom.start(now);
    boom.stop(now + 0.22);
    boom.onended = () => boomEnv.disconnect();

    // Noise burst
    const bufLen = Math.floor(ctx.sampleRate * 0.15);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;

    const noiseLp = ctx.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 800;

    const noiseEnv = ctx.createGain();
    noiseEnv.gain.setValueAtTime(0.06, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    noiseSrc.connect(noiseLp);
    noiseLp.connect(noiseEnv);
    noiseEnv.connect(this.bus);
    noiseSrc.start(now);
    noiseSrc.onended = () => noiseEnv.disconnect();

    // Descending sweep
    const sweep = ctx.createOscillator();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(300, now + 0.02);
    sweep.frequency.exponentialRampToValueAtTime(60, now + 0.25);

    const sweepLp = ctx.createBiquadFilter();
    sweepLp.type = 'lowpass';
    sweepLp.frequency.value = 500;

    const sweepEnv = ctx.createGain();
    sweepEnv.gain.setValueAtTime(0, now + 0.02);
    sweepEnv.gain.linearRampToValueAtTime(0.04, now + 0.04);
    sweepEnv.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    sweep.connect(sweepLp);
    sweepLp.connect(sweepEnv);
    sweepEnv.connect(this.bus);
    sweep.start(now + 0.02);
    sweep.stop(now + 0.27);
    sweep.onended = () => sweepEnv.disconnect();
  }

  // ── Internal builders ───────────────────────────────────────────────────────

  /**
   * Play a single sine burst:
   *   freq     — frequency in Hz
   *   vol      — peak gain
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

  /**
   * Create a lightweight impulse-response reverb for one-shot effects.
   * Shorter than the music reverbs since SFX should be snappier.
   */
  private _createQuickReverb(duration: number, decay: number): ConvolverNode {
    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const ir = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    return conv;
  }
}

// ── Utility: distortion waveshaper ───────────────────────────────────────────

/**
 * Create a waveshaper curve for soft/hard distortion.
 * @param samples  Number of curve samples
 * @param amount   Distortion amount (higher = more distorted)
 */
function makeDistortionCurve(samples: number, amount: number): Float32Array<ArrayBuffer> {
  const buf = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buf);
  const k = amount;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
