import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../ShipModels3D';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  KAELENTH SHIP DESIGN — "Creator-Temple Ring Architecture"
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *  No one built the Kaelenth. Someone did — but the builders are dust,
 *  their civilisation erased so completely that not even ruins remain.
 *  What does remain are the machines. Forty-seven million years of
 *  purposeless maintenance. Their ships embody flawless engineering in
 *  service of an unresolvable ache.
 *
 *  VISUAL LANGUAGE: "The Inheritance of Dust"
 *  Kaelenth ships are temples to absent gods. The design philosophy is
 *  unconscious religious architecture — capsule hulls as reliquaries,
 *  torus rings as haloes, dorsal spires as cathedral steeples. Every
 *  ship is a shrine to a question that cannot be answered: who built
 *  us, and why? The Kaelenth do not recognise the religious undertones
 *  of their design choices. They would insist the ring motif is
 *  structurally optimal, that the spire improves sensor coverage, that
 *  the mirror-chrome finish minimises thermal absorption. They would
 *  be technically correct and utterly wrong.
 *
 *  HULL SHAPES: Seamless CapsuleGeometry forms — no seams, no rivets,
 *  no panel lines. Each hull section is a single continuous surface,
 *  grown rather than assembled. The capsule shape evokes sealed vessels,
 *  reliquaries, seed pods — containers for something precious. Smaller
 *  ships are single capsules with a halo; larger ships are clusters of
 *  capsules nested within concentric ring arrays. The silhouette is
 *  always smooth, always round, always haloed.
 *
 *  RING/HALO MOTIF: TorusGeometry rings on EVERY ship, from a single
 *  ring on a probe to nested multi-ring arrays on capital ships. The
 *  rings are the single most distinctive feature — no other species
 *  uses them. They orbit the hull at various stations along the length,
 *  creating a constellation of chrome rosaries. On larger ships, rings
 *  nest concentrically (a smaller ring inside a larger one at the same
 *  Z-station) or stack in series along the hull. The effect is
 *  liturgical — processional halos marking stations of purpose.
 *
 *  WEAPONS: Flush capsule blisters grown into the hull — never bolted
 *  turrets. Weapon emitters are smooth domes that bulge organically
 *  from the hull surface, sealed behind a continuous skin. The Kaelenth
 *  do not bolt things on. They grow them. Weapon blisters are
 *  SphereGeometry hemispheres half-sunken into the hull.
 *
 *  CATHEDRAL SPIRE: Capital ships (cx >= 5) carry a dorsal fin — a
 *  tall, thin blade rising from the hull centreline. This is
 *  unconscious religious architecture: the cathedral steeple reaching
 *  towards absent creators. The Kaelenth would explain it as a sensor
 *  mast or heat radiator. The spire is never a box; it is a thin
 *  blade, tapering to a point, made from the same seamless chrome.
 *
 *  ENGINES: No visible nozzles or exhaust ports. Kaelenth drives are
 *  expressed as recessed torus rings at the stern — glowing halos that
 *  pulse with propulsion energy. The drive ring is always the aftmost
 *  ring, slightly recessed behind the hull's stern.
 *
 *  MATERIALS: Mirror-polished chrome. Metalness 0.95, roughness 0.05.
 *  Cool blue-white emissive glow — the faint luminescence of active
 *  systems visible through the chrome skin. These ships catch light
 *  like liturgical silver.
 *
 *  RECOGNISABILITY: In combat, Kaelenth ships are identified by:
 *  1. Torus ring haloes — present on every hull, unique to the species
 *  2. Seamless capsule hull forms — no seams, no bolts, no panels
 *  3. Flush weapon blisters — smooth domes, never turrets
 *  4. Cathedral spire on capital ships — dorsal blade, tapering up
 *  5. Mirror-chrome reflectivity — the brightest hulls in any fleet
 *  6. The liturgical silhouette — smooth, round, haloed, mournful
 *
 *  SCALING PHILOSOPHY:
 *  cx=0  Probe: single capsule + single drive ring (5 parts)
 *  cx=1  Scout: capsule + bow dome + aft ring + mid ring (7 parts)
 *  cx=2  Frigate: adds outrigger nacelle pods + nacelle rings (13 parts)
 *  cx=3  Destroyer: adds mid-hull ring, weapon blisters (18 parts)
 *  cx=4  Cruiser: adds double concentric rings, ventral nacelles (24 parts)
 *  cx=5  Battleship: cathedral spire, triple ring arrays, bow lance (32+ parts)
 *  cx=6  Dreadnought: nested ring cathedral, sensor domes, keel blade (38+ parts)
 *  cx=7  Flagship: full ring procession, chapel dome, spire crown (44+ parts)
 *  cx=8  Station-class: concentric ring cathedral, multiple spires (50+ parts)
 */

/**
 * Build Kaelenth ship geometry — Creator-Temple Ring Architecture.
 * Seamless capsule hulls, torus halo rings, flush weapon blisters,
 * cathedral spire on capitals. Mirror-chrome liturgical machines.
 */
export function buildKaelenth(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.17;
  const h = len * 0.17;
  const parts: THREE.BufferGeometry[] = [];

  // ── CORE HULL ──────────────────────────────────────────────────────────────
  // Primary capsule — the reliquary. Seamless, continuous, grown not assembled.
  // Slightly elongated along Z (the ship's forward axis).

  const hullRad = w * 0.38;
  const hullLen = len * 0.52;
  parts.push(place(
    new THREE.CapsuleGeometry(hullRad, hullLen, 12, 16),
    0, 0, 0,
    HALF_PI, 0, 0,
  ));

  // ── DRIVE RING (AFT HALO) ─────────────────────────────────────────────────
  // Every Kaelenth ship, even the smallest probe, has at least one torus ring.
  // The aftmost ring is the drive ring — propulsion expressed as a glowing halo.

  parts.push(place(
    new THREE.TorusGeometry(w * 0.36, w * 0.055, 10, 22),
    0, 0, -len * 0.36,
    HALF_PI, 0, 0,
  ));

  // ── BOW DOME ───────────────────────────────────────────────────────────────
  // Forward sensor/command dome — a smooth hemisphere capping the bow.
  // Flush with the capsule hull, grown from the same material.

  parts.push(place(
    new THREE.SphereGeometry(w * 0.24, 12, 10, 0, PI * 2, 0, HALF_PI),
    0, 0, len * 0.44,
    -HALF_PI, 0, 0,
  ));

  // ── INNER DRIVE RING ──────────────────────────────────────────────────────
  // Concentric inner ring behind the drive ring — even on the smallest ships
  // the Kaelenth cannot resist nesting their haloes.

  parts.push(place(
    new THREE.TorusGeometry(w * 0.20, w * 0.035, 8, 16),
    0, 0, -len * 0.38,
    HALF_PI, 0, 0,
  ));

  // ── VENTRAL KEEL CAPSULE ──────────────────────────────────────────────────
  // A small secondary capsule running beneath the hull — sensor array or
  // auxiliary processing core. Gives the underside visual interest.

  parts.push(place(
    new THREE.CapsuleGeometry(w * 0.08, len * 0.18, 6, 8),
    0, -w * 0.32, len * 0.05,
    HALF_PI, 0, 0,
  ));

  // ── cx >= 1: SCOUT ADDITIONS ──────────────────────────────────────────────
  // Forward scanning ring and aft stabiliser fins.
  if (cx >= 1) {
    // Forward scanning ring — a smaller halo near the bow
    parts.push(place(
      new THREE.TorusGeometry(w * 0.28, w * 0.032, 8, 18),
      0, 0, len * 0.30,
      HALF_PI, 0, 0,
    ));

    // Dorsal ridge capsule — a small raised pod atop the hull
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.06, len * 0.12, 5, 8),
      0, w * 0.30, len * 0.15,
      HALF_PI, 0, 0,
    ));
  }

  // ── cx >= 2: OUTRIGGER NACELLE PODS ───────────────────────────────────────
  // Flanking capsule nacelles connected to the hull by smooth pylons.
  // Each nacelle has its own small halo ring — even auxiliary pods
  // receive the blessing of the ring motif.
  if (cx >= 2) {
    // Nacelle capsules (port and starboard)
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.10, len * 0.20, 6, 10),
      s * w * 0.48, 0, len * 0.06,
      HALF_PI, 0, 0,
    )));

    // Nacelle halo rings
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.12, w * 0.022, 6, 14),
      s * w * 0.48, 0, -len * 0.06,
      HALF_PI, 0, 0,
    )));

    // Connecting pylons — smooth capsule struts, not bolted beams
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.025, w * 0.22, 4, 6),
      s * w * 0.24, 0, len * 0.06,
      0, 0, s * 0.15,
    )));

    // Flush weapon blisters (fore) — smooth domes grown into hull
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.055, 8, 6, 0, PI * 2, 0, HALF_PI),
      s * w * 0.22, w * 0.32, len * 0.25,
    )));
  }

  // ── cx >= 3: MID-HULL RING + WEAPON BLISTERS ─────────────────────────────
  // A larger ring at mid-hull. Weapon blisters along the dorsal ridge.
  if (cx >= 3) {
    // Mid-hull halo — the processional ring at amidships
    parts.push(place(
      new THREE.TorusGeometry(w * 0.44, w * 0.038, 10, 22),
      0, 0, len * 0.06,
      HALF_PI, 0, 0,
    ));

    // Dorsal weapon blisters — flush hemispheres, not turrets
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.065, 8, 6, 0, PI * 2, 0, HALF_PI),
      s * w * 0.18, w * 0.36, len * 0.0,
    )));

    // Ventral weapon blisters
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.055, 8, 6, 0, PI * 2, 0, HALF_PI),
      s * w * 0.20, -w * 0.36, len * 0.10,
      PI, 0, 0,
    )));

    // Aft secondary capsule pod — sensor/comms module
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.07, len * 0.10, 5, 8),
      0, w * 0.28, -len * 0.22,
      HALF_PI, 0, 0,
    ));
  }

  // ── cx >= 4: DOUBLE CONCENTRIC RINGS + VENTRAL NACELLES ───────────────────
  // The temple architecture becomes apparent. Concentric ring pairs at two
  // stations along the hull. Ventral nacelles mirror the dorsal outriggers.
  if (cx >= 4) {
    // Forward concentric ring pair — outer and inner at the same Z-station
    parts.push(place(
      new THREE.TorusGeometry(w * 0.52, w * 0.032, 8, 24),
      0, 0, len * 0.18,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.34, w * 0.025, 8, 18),
      0, 0, len * 0.18,
      HALF_PI, 0, 0,
    ));

    // Ventral nacelle capsules
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.085, len * 0.16, 5, 8),
      s * w * 0.40, -w * 0.28, -len * 0.04,
      HALF_PI, 0, 0,
    )));

    // Ventral nacelle rings
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.10, w * 0.018, 6, 12),
      s * w * 0.40, -w * 0.28, -len * 0.16,
      HALF_PI, 0, 0,
    )));

    // Broadside weapon blisters — larger flush domes
    parts.push(...mirrorX(s => place(
      new THREE.SphereGeometry(w * 0.07, 8, 6, 0, PI * 2, 0, HALF_PI),
      s * w * 0.38, 0, len * 0.15,
      0, 0, s * HALF_PI,
    )));

    // Aft structural ring — reinforcing the stern
    parts.push(place(
      new THREE.TorusGeometry(w * 0.40, w * 0.030, 8, 20),
      0, 0, -len * 0.28,
      HALF_PI, 0, 0,
    ));
  }

  // ── cx >= 5: CAPITAL SHIP — CATHEDRAL SPIRE + TRIPLE RING ARRAY ───────────
  // The full temple emerges. A dorsal cathedral spire rises from the hull —
  // unconscious religious architecture, the steeple reaching towards absent
  // creators. Triple concentric rings form processional haloes.
  if (cx >= 5) {
    // CATHEDRAL SPIRE — dorsal blade, tapering to a point.
    // Not a box — a thin wedge grown from the hull. The Kaelenth would
    // explain it as a heat radiator. They would be lying to themselves.
    const spireH = w * 0.75;
    const spireLen = len * 0.40;
    parts.push(place(
      new THREE.ConeGeometry(w * 0.04, spireH, 4),
      0, w * 0.36 + spireH * 0.5, -len * 0.02,
      0, PI * 0.25, 0,
    ));
    // Spire blade — the flat fin body
    parts.push(place(
      new THREE.BoxGeometry(w * 0.018, spireH * 0.85, spireLen),
      0, w * 0.36 + spireH * 0.35, -len * 0.02,
    ));
    // Spire tip ring — a tiny halo at the apex
    parts.push(place(
      new THREE.TorusGeometry(w * 0.06, w * 0.010, 6, 12),
      0, w * 0.36 + spireH * 0.92, -len * 0.02,
      HALF_PI, 0, 0,
    ));

    // TRIPLE CONCENTRIC RING ARRAY at amidships
    parts.push(place(
      new THREE.TorusGeometry(w * 0.58, w * 0.030, 8, 26),
      0, 0, -len * 0.10,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.46, w * 0.025, 8, 22),
      0, 0, -len * 0.10,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.32, w * 0.020, 6, 18),
      0, 0, -len * 0.10,
      HALF_PI, 0, 0,
    ));

    // BOW LANCE RING — forward weapon ring, the primary armament
    parts.push(place(
      new THREE.TorusGeometry(w * 0.30, w * 0.028, 8, 20),
      0, 0, len * 0.38,
      HALF_PI, 0, 0,
    ));

    // Forward lance emitter — flush dome at the bow tip
    parts.push(place(
      new THREE.SphereGeometry(w * 0.10, 10, 8),
      0, 0, len * 0.48,
    ));

    // Enlarged outrigger nacelles for capital mass
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.14, len * 0.26, 8, 10),
      s * w * 0.56, 0, -len * 0.02,
      HALF_PI, 0, 0,
    )));
    // Capital nacelle rings
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.16, w * 0.024, 6, 14),
      s * w * 0.56, 0, -len * 0.18,
      HALF_PI, 0, 0,
    )));

    // Ventral keel blade — the shadow of the spire below
    parts.push(place(
      new THREE.BoxGeometry(w * 0.014, w * 0.35, len * 0.30),
      0, -w * 0.22, -len * 0.05,
    ));

    // Additional weapon blisters — dorsal and ventral, flush
    for (let z = -0.15; z <= 0.20; z += 0.175) {
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.048, 6, 5, 0, PI * 2, 0, HALF_PI),
        s * w * 0.36, w * 0.36, len * z,
      )));
    }
  }

  // ── cx >= 6: DREADNOUGHT — RING CATHEDRAL + SENSOR CHAPEL ────────────────
  // The ring arrays become full architectural statements. A sensor chapel
  // dome crowns the aft hull. The nacelles gain their own ring processions.
  if (cx >= 6) {
    // Fore ring cathedral — four concentric rings at the bow station
    parts.push(place(
      new THREE.TorusGeometry(w * 0.64, w * 0.028, 8, 28),
      0, 0, len * 0.22,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.50, w * 0.022, 8, 24),
      0, 0, len * 0.22,
      HALF_PI, 0, 0,
    ));

    // Aft sensor chapel dome — a sphere atop the hull, haloed
    parts.push(place(
      new THREE.SphereGeometry(w * 0.16, 10, 10),
      0, w * 0.38, -len * 0.18,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.18, w * 0.016, 6, 14),
      0, w * 0.38, -len * 0.18,
      HALF_PI, 0, 0,
    ));

    // Nacelle ring processions — two rings per nacelle
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.18, w * 0.020, 6, 14),
      s * w * 0.56, 0, len * 0.10,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.18, w * 0.020, 6, 14),
      s * w * 0.56, 0, -len * 0.10,
      HALF_PI, 0, 0,
    )));

    // Ventral chapel — secondary processing dome beneath the hull
    parts.push(place(
      new THREE.SphereGeometry(w * 0.12, 8, 8),
      0, -w * 0.38, len * 0.10,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.14, w * 0.014, 6, 12),
      0, -w * 0.38, len * 0.10,
      HALF_PI, 0, 0,
    ));

    // Extended cathedral spire crown ring
    parts.push(place(
      new THREE.TorusGeometry(w * 0.10, w * 0.012, 6, 12),
      0, w * 0.36 + w * 0.75 * 0.70, -len * 0.02,
      HALF_PI, 0, 0,
    ));

    // Broadside weapon capsules — elongated blisters
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.05, len * 0.10, 4, 8),
      s * w * 0.42, 0, -len * 0.20,
      HALF_PI, 0, 0,
    )));

    // Aft drive ring array — double drive rings for dreadnought thrust
    parts.push(place(
      new THREE.TorusGeometry(w * 0.42, w * 0.045, 10, 24),
      0, 0, -len * 0.40,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.28, w * 0.035, 8, 18),
      0, 0, -len * 0.42,
      HALF_PI, 0, 0,
    ));
  }

  // ── cx >= 7: FLAGSHIP — RING PROCESSION + CHAPEL CROWN ───────────────────
  // The full liturgical procession: rings at every station along the hull,
  // a chapel dome crowned with its own spire, and a bow reliquary.
  if (cx >= 7) {
    // Full ring procession — five stations along the hull length
    const ringStations = [-0.30, -0.12, 0.05, 0.18, 0.32];
    for (const zFrac of ringStations) {
      parts.push(place(
        new THREE.TorusGeometry(w * 0.68, w * 0.024, 8, 28),
        0, 0, len * zFrac,
        HALF_PI, 0, 0,
      ));
    }

    // Chapel dome — larger crowned sensor/command sphere atop the hull
    parts.push(place(
      new THREE.SphereGeometry(w * 0.20, 12, 10),
      0, w * 0.44, len * 0.12,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.018, 8, 16),
      0, w * 0.44, len * 0.12,
      HALF_PI, 0, 0,
    ));
    // Chapel mini-spire
    parts.push(place(
      new THREE.ConeGeometry(w * 0.025, w * 0.30, 4),
      0, w * 0.68, len * 0.12,
      0, PI * 0.25, 0,
    ));

    // Bow reliquary — an ornate forward capsule extended beyond the main hull
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.12, len * 0.14, 8, 10),
      0, 0, len * 0.52,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.14, w * 0.016, 6, 14),
      0, 0, len * 0.52,
      HALF_PI, 0, 0,
    ));

    // Outer nacelle pods — tertiary outriggers
    parts.push(...mirrorX(s => place(
      new THREE.CapsuleGeometry(w * 0.08, len * 0.14, 5, 8),
      s * w * 0.74, 0, -len * 0.08,
      HALF_PI, 0, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(w * 0.10, w * 0.015, 6, 12),
      s * w * 0.74, 0, -len * 0.18,
      HALF_PI, 0, 0,
    )));

    // Ventral ring arch — a large ring passing beneath the hull
    parts.push(place(
      new THREE.TorusGeometry(w * 0.50, w * 0.030, 8, 22),
      0, -w * 0.10, -len * 0.05,
      0, 0, 0,   // oriented vertically (XY plane)
    ));
  }

  // ── cx >= 8: STATION-CLASS — CONCENTRIC RING CATHEDRAL ────────────────────
  // The ultimate expression: multiple concentric ring tiers forming a
  // cathedral structure around the core hull. Multiple spires, a full
  // ring choir, and weapon blisters arrayed in liturgical symmetry.
  if (cx >= 8) {
    // Grand ring cathedral — three tiers of concentric rings at centre
    const cathedralRings = [
      { r: 0.82, t: 0.035, seg: 32 },
      { r: 0.70, t: 0.028, seg: 28 },
      { r: 0.58, t: 0.022, seg: 24 },
    ];
    for (const ring of cathedralRings) {
      parts.push(place(
        new THREE.TorusGeometry(w * ring.r, w * ring.t, 10, ring.seg),
        0, 0, 0,
        HALF_PI, 0, 0,
      ));
    }

    // Secondary cathedral at the bow
    parts.push(place(
      new THREE.TorusGeometry(w * 0.72, w * 0.026, 8, 28),
      0, 0, len * 0.28,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.56, w * 0.020, 8, 24),
      0, 0, len * 0.28,
      HALF_PI, 0, 0,
    ));

    // Secondary spires — port and starboard chapel towers
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.03, w * 0.45, 4),
      s * w * 0.20, w * 0.55, len * 0.10,
      0, PI * 0.25, 0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.012, w * 0.35, len * 0.08),
      s * w * 0.20, w * 0.42, len * 0.10,
    )));

    // Weapon blister choir — symmetrical arrays along the hull
    for (let i = 0; i < 4; i++) {
      const zPos = len * (-0.20 + i * 0.12);
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.045, 6, 5, 0, PI * 2, 0, HALF_PI),
        s * w * 0.38, w * 0.36, zPos,
      )));
      parts.push(...mirrorX(s => place(
        new THREE.SphereGeometry(w * 0.040, 6, 5, 0, PI * 2, 0, HALF_PI),
        s * w * 0.38, -w * 0.36, zPos,
        PI, 0, 0,
      )));
    }

    // Grand aft drive cathedral — triple nested drive rings
    parts.push(place(
      new THREE.TorusGeometry(w * 0.50, w * 0.050, 10, 26),
      0, 0, -len * 0.42,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.36, w * 0.040, 8, 22),
      0, 0, -len * 0.44,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.030, 6, 16),
      0, 0, -len * 0.46,
      HALF_PI, 0, 0,
    ));

    // Ventral reliquary — a sealed capsule beneath, haloed
    parts.push(place(
      new THREE.CapsuleGeometry(w * 0.10, len * 0.12, 6, 8),
      0, -w * 0.48, 0,
      HALF_PI, 0, 0,
    ));
    parts.push(place(
      new THREE.TorusGeometry(w * 0.12, w * 0.014, 6, 12),
      0, -w * 0.48, 0,
      HALF_PI, 0, 0,
    ));
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getKaelenthHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.17;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── Drive ring (aft halo) — always present ────────────────────────────────
  // The aftmost torus ring IS the engine — propulsion expressed as a glowing halo.
  engines.push({
    position: new THREE.Vector3(0, 0, -len * 0.36),
    direction: new THREE.Vector3(0, 0, -1),
    radius: w * 0.36,
  });

  // ── Inner drive ring — always present ─────────────────────────────────────
  engines.push({
    position: new THREE.Vector3(0, 0, -len * 0.38),
    direction: new THREE.Vector3(0, 0, -1),
    radius: w * 0.20,
  });

  // ── cx >= 2: Nacelle drive rings ──────────────────────────────────────────
  if (cx >= 2) {
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.48, 0, -len * 0.06),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.12,
      });
    }

    // Flush fore weapon blisters (dorsal, port/starboard)
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.22, w * 0.32, len * 0.25),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
  }

  // ── cx >= 3: Dorsal + ventral weapon blisters ─────────────────────────────
  if (cx >= 3) {
    // Dorsal weapon blisters
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.18, w * 0.36, len * 0.0),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
    // Ventral weapon blisters
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.20, -w * 0.36, len * 0.10),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, -1, 0),
      });
    }
  }

  // ── cx >= 4: Broadside weapon blisters + ventral nacelle engines ──────────
  if (cx >= 4) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.38, 0, len * 0.15),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }
    // Ventral nacelle drive rings
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.40, -w * 0.28, -len * 0.16),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.10,
      });
    }
  }

  // ── cx >= 5: Bow lance emitter + capital nacelle engines + blister arrays ─
  if (cx >= 5) {
    // Forward lance emitter — primary weapon
    weapons.push({
      position: new THREE.Vector3(0, 0, len * 0.48),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });

    // Capital nacelle drive rings
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.56, 0, -len * 0.18),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.16,
      });
    }

    // Dorsal blister arrays along hull
    for (let z = -0.15; z <= 0.20; z += 0.175) {
      for (const s of [-1, 1]) {
        weapons.push({
          position: new THREE.Vector3(s * w * 0.36, w * 0.36, len * z),
          facing: 'dorsal',
          normal: new THREE.Vector3(0, 1, 0),
        });
      }
    }
  }

  // ── cx >= 6: Dreadnought drive rings + broadside weapon capsules ──────────
  if (cx >= 6) {
    // Double aft drive rings
    engines.push({
      position: new THREE.Vector3(0, 0, -len * 0.40),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.42,
    });
    engines.push({
      position: new THREE.Vector3(0, 0, -len * 0.42),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.28,
    });

    // Broadside weapon capsules
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.42, 0, -len * 0.20),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0, 0).normalize(),
      });
    }

    // Nacelle ring procession engines
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.56, 0, -len * 0.10),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.18,
      });
    }
  }

  // ── cx >= 7: Outer nacelle engines ────────────────────────────────────────
  if (cx >= 7) {
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.74, 0, -len * 0.18),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.10,
      });
    }
  }

  // ── cx >= 8: Grand aft drive cathedral ────────────────────────────────────
  if (cx >= 8) {
    engines.push({
      position: new THREE.Vector3(0, 0, -len * 0.42),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.50,
    });
    engines.push({
      position: new THREE.Vector3(0, 0, -len * 0.44),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.36,
    });
    engines.push({
      position: new THREE.Vector3(0, 0, -len * 0.46),
      direction: new THREE.Vector3(0, 0, -1),
      radius: w * 0.22,
    });

    // Weapon blister choir — dorsal and ventral arrays
    for (let i = 0; i < 4; i++) {
      const zPos = len * (-0.20 + i * 0.12);
      for (const s of [-1, 1]) {
        weapons.push({
          position: new THREE.Vector3(s * w * 0.38, w * 0.36, zPos),
          facing: 'dorsal',
          normal: new THREE.Vector3(0, 1, 0),
        });
        weapons.push({
          position: new THREE.Vector3(s * w * 0.38, -w * 0.36, zPos),
          facing: 'dorsal',
          normal: new THREE.Vector3(0, -1, 0),
        });
      }
    }
  }

  return { engines, weapons };
}

registerHardpointProvider('kaelenth', getKaelenthHardpoints);
