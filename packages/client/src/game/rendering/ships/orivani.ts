import * as THREE from 'three';
import { place, merge, mirrorX, PI, HALF_PI } from '../shipModelHelpers';
import type { EngineHardpoint, WeaponHardpoint } from '../shipHardpoints';
import { registerHardpointProvider } from '../shipHardpoints';

/**
 * ════════════════════════════════════════════════════════════════════════════
 * ORIVANI SHIP DESIGNS — "Cathedrals of the Coming"
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The Orivani have spent twelve thousand years preparing for the Coming.
 * Every ship is an act of devotion — a flying Gothic cathedral. Vessels
 * built on a cruciform hull plan: a central nave stretching bow to stern,
 * crossed by a transept amidships. Pointed spire prows cleave the void
 * like steeple tips. Flying buttress arcs sweep from nave to flanking
 * aisle-nacelles. Rose window torus-spheres glow with sanctified warmth
 * at the transept crossing. Bell tower spires rise from every junction.
 *
 * Material: ivory stone and sanctified gold, warm emissive glow.
 *
 * DISTINCTIVENESS: SPIRES + BUTTRESS ARCS + CRUCIFORM PLAN.
 * No other species uses any of these. The silhouette is unmistakable:
 * a forest of vertical spires atop a cross-shaped hull with sweeping
 * arcs connecting the central mass to outboard structures.
 */

export function buildOrivani(len: number, cx: number): THREE.BufferGeometry {
  const w = len * 0.30;
  const h = len * 0.28;
  const parts: THREE.BufferGeometry[] = [];

  // ══════════════════════════════════════════════════════════════════════
  // 1. NAVE — the central longitudinal hull, tall and narrow like a
  //    cathedral's central aisle. Slightly tapered at both ends.
  // ══════════════════════════════════════════════════════════════════════
  parts.push(place(
    new THREE.BoxGeometry(w * 0.5, h * 1.0, len * 0.65),
    0, 0, 0,
  ));

  // Nave clerestory — raised upper section with narrower width
  parts.push(place(
    new THREE.BoxGeometry(w * 0.35, h * 0.25, len * 0.55),
    0, h * 0.6, 0,
  ));

  // Nave floor/keel — the structural spine beneath
  parts.push(place(
    new THREE.BoxGeometry(w * 0.15, h * 0.12, len * 0.7),
    0, -h * 0.58, 0,
  ));

  // ══════════════════════════════════════════════════════════════════════
  // 2. SPIRE PROW — the pointed bow, a steeple tip that leads the ship.
  //    Four-sided cone rotated forward, tapering to a sacred point.
  // ══════════════════════════════════════════════════════════════════════
  parts.push(place(
    new THREE.ConeGeometry(w * 0.32, len * 0.3, 4),
    0, 0, len * 0.47,
    HALF_PI, PI / 4, 0,
  ));

  // Prow ridge — the sharp dorsal edge of the spire
  parts.push(place(
    new THREE.BoxGeometry(w * 0.06, h * 0.3, len * 0.2),
    0, h * 0.35, len * 0.4,
  ));

  // ══════════════════════════════════════════════════════════════════════
  // 3. CENTRAL SPIRE — the great steeple rising above the crossing.
  //    Present on all ships; the defining vertical accent.
  // ══════════════════════════════════════════════════════════════════════
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.06, w * 0.1, h * 0.5, 4),
    0, h * 0.95, len * 0.02,
  ));
  parts.push(place(
    new THREE.ConeGeometry(w * 0.08, h * 0.55, 4),
    0, h * 1.45, len * 0.02,
  ));

  // ══════════════════════════════════════════════════════════════════════
  // 4. TRANSEPT — the cross-bar that makes the cruciform plan.
  //    Wider than the nave, shorter fore-aft.
  // ══════════════════════════════════════════════════════════════════════
  parts.push(place(
    new THREE.BoxGeometry(w * 0.95, h * 0.55, len * 0.15),
    0, h * 0.05, len * 0.02,
  ));

  // Transept end-caps — slightly thickened outboard
  parts.push(...mirrorX(s => place(
    new THREE.BoxGeometry(w * 0.12, h * 0.65, len * 0.12),
    s * w * 0.47, h * 0.05, len * 0.02,
  )));

  // ══════════════════════════════════════════════════════════════════════
  // 5. APSE — the rounded stern sanctuary where the sacred flame burns.
  //    Half-cylinder closing the aft end of the nave.
  // ══════════════════════════════════════════════════════════════════════
  parts.push(place(
    new THREE.CylinderGeometry(w * 0.28, w * 0.28, h * 0.7, 8, 1, false, 0, PI),
    0, -h * 0.05, -len * 0.34,
    0, PI, 0,
  ));

  // ══════════════════════════════════════════════════════════════════════
  // cx >= 1: SIDE AISLE WALLS + NAVE DETAILING
  // Even patrol craft gain the characteristic ribbed look.
  // ══════════════════════════════════════════════════════════════════════
  if (cx >= 1) {
    // Side aisle walls — lower flanking sections along the nave
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.2, h * 0.6, len * 0.45),
      s * w * 0.38, -h * 0.15, 0,
    )));

    // Buttress pillar stubs — hint at the full arcs to come
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.08, h * 0.5, len * 0.06),
      s * w * 0.32, h * 0.15, len * 0.15,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.08, h * 0.5, len * 0.06),
      s * w * 0.32, h * 0.15, -len * 0.1,
    )));
  }

  // ══════════════════════════════════════════════════════════════════════
  // cx >= 2: BELL TOWER SPIRES + ROSE WINDOW
  // Destroyers gain the twin bell towers flanking the transept and
  // the first rose window torus at the crossing.
  // ══════════════════════════════════════════════════════════════════════
  if (cx >= 2) {
    // Twin bell tower bases at transept ends
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.08, w * 0.11, h * 0.85, 6),
      s * w * 0.44, h * 0.25, len * 0.02,
    )));
    // Bell tower spire caps
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.1, h * 0.4, 6),
      s * w * 0.44, h * 0.78, len * 0.02,
    )));

    // Rose window — torus at transept crossing (prow-facing)
    parts.push(place(
      new THREE.TorusGeometry(w * 0.2, w * 0.04, 6, 8),
      0, h * 0.15, len * 0.35,
      HALF_PI, 0, 0,
    ));

    // Small forward finials on prow ridge
    parts.push(place(
      new THREE.ConeGeometry(w * 0.04, h * 0.25, 4),
      0, h * 0.6, len * 0.32,
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // cx >= 3: FLYING BUTTRESS ARCS + ENGINE GLOW
  // Cruisers gain the signature sweeping arcs from nave to aisle walls,
  // and the sanctified flame exhausts at the apse.
  // ══════════════════════════════════════════════════════════════════════
  if (cx >= 3) {
    // Primary flying buttress arcs — forward pair
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.55, w * 0.03, 5, 8, PI * 0.45),
      s * w * 0.5, h * 0.2, len * 0.1,
      0, s * HALF_PI, HALF_PI,
    )));

    // Secondary flying buttress arcs — aft pair
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.48, w * 0.025, 5, 8, PI * 0.4),
      s * w * 0.46, h * 0.18, -len * 0.15,
      0, s * HALF_PI, HALF_PI,
    )));

    // Sanctified flame exhausts — triple cones at apse
    for (let i = -1; i <= 1; i++) {
      parts.push(place(
        new THREE.ConeGeometry(w * 0.07, len * 0.1, 6),
        i * w * 0.14, -h * 0.05, -len * 0.5,
        -HALF_PI, 0, 0,
      ));
    }

    // Exhaust shroud — the arch framing the sacred flames
    parts.push(place(
      new THREE.TorusGeometry(w * 0.22, w * 0.025, 5, 6, PI),
      0, h * 0.1, -len * 0.42,
      0, 0, 0,
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // cx >= 4: WEAPON BUTTRESS PLATFORMS + ROOF TURRETS
  // Heavy cruisers mount weapon platforms atop the buttress arcs and
  // dorsal turrets integrated into the cathedral roof line.
  // ══════════════════════════════════════════════════════════════════════
  if (cx >= 4) {
    // Weapon platforms atop buttress arc ends
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.14, h * 0.1, len * 0.1),
      s * w * 0.58, h * 0.55, len * 0.1,
    )));
    // Weapon barrel stubs on buttress platforms
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.025, w * 0.025, len * 0.12, 4),
      s * w * 0.58, h * 0.58, len * 0.18,
      HALF_PI, 0, 0,
    )));

    // Aft buttress weapon mounts
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.12, h * 0.08, len * 0.08),
      s * w * 0.54, h * 0.48, -len * 0.15,
    )));

    // Dorsal roof turrets — two pairs integrated into clerestory
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.06, w * 0.08, h * 0.15, 6),
      s * w * 0.12, h * 0.78, len * 0.15,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.05, w * 0.07, h * 0.12, 6),
      s * w * 0.12, h * 0.78, -len * 0.1,
    )));

    // Additional transept detailing — pointed arch windows (small boxes)
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.03, h * 0.35, len * 0.04),
      s * w * 0.54, h * 0.2, len * 0.08,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.03, h * 0.35, len * 0.04),
      s * w * 0.54, h * 0.2, -len * 0.04,
    )));

    // Second rose window at apse (stern-facing)
    parts.push(place(
      new THREE.TorusGeometry(w * 0.16, w * 0.03, 6, 8),
      0, h * 0.05, -len * 0.42,
      HALF_PI, 0, 0,
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // cx >= 5: CAPITAL SHIP — FULL SPIRE FOREST + CHOIR GALLERY
  // Battlecruisers gain a forest of secondary spires, choir loft gallery,
  // reinforced aisle structures, and additional buttress tiers.
  // ══════════════════════════════════════════════════════════════════════
  if (cx >= 5) {
    // Secondary spires — flanking the central steeple
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.05, w * 0.08, h * 0.7, 6),
      s * w * 0.15, h * 0.7, len * 0.02,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.07, h * 0.35, 6),
      s * w * 0.15, h * 1.2, len * 0.02,
    )));

    // Apse spires — smaller towers flanking the stern sanctuary
    parts.push(...mirrorX(s => place(
      new THREE.CylinderGeometry(w * 0.04, w * 0.065, h * 0.55, 6),
      s * w * 0.2, h * 0.22, -len * 0.28,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.06, h * 0.3, 6),
      s * w * 0.2, h * 0.6, -len * 0.28,
    )));

    // Prow spire — smaller steeple at the bow
    parts.push(place(
      new THREE.ConeGeometry(w * 0.045, h * 0.5, 4),
      0, h * 0.65, len * 0.25,
    ));

    // Choir gallery — elevated platform behind the crossing
    parts.push(place(
      new THREE.BoxGeometry(w * 0.6, h * 0.1, len * 0.15),
      0, h * 0.55, -len * 0.12,
    ));
    // Choir gallery railing columns
    for (let i = -2; i <= 2; i++) {
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.015, h * 0.2, 4),
        i * w * 0.12, h * 0.7, -len * 0.12,
      ));
    }

    // Reinforced aisle buttresses — heavier supports for the capital hull
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.06, h * 0.7, len * 0.08),
      s * w * 0.35, h * 0.05, len * 0.22,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.06, h * 0.7, len * 0.08),
      s * w * 0.35, h * 0.05, -len * 0.22,
    )));

    // Additional engine exhausts — five-flame apse
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.055, len * 0.08, 6),
      s * w * 0.28, -h * 0.05, -len * 0.52,
      -HALF_PI, 0, 0,
    )));

    // Nave pinnacles — small decorative spire tips along the roof ridge
    for (let i = 0; i < 4; i++) {
      const zPos = len * (0.2 - i * 0.12);
      parts.push(place(
        new THREE.ConeGeometry(w * 0.03, h * 0.22, 4),
        0, h * 0.82, zPos,
      ));
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // cx >= 6: GRAND CATHEDRAL — AMBULATORY + THIRD BUTTRESS TIER
  // Battleships gain the ambulatory walkway around the apse, a third
  // tier of flying buttresses, and weapon galleries along the nave.
  // ══════════════════════════════════════════════════════════════════════
  if (cx >= 6) {
    // Ambulatory — curved walkway around the apse
    parts.push(place(
      new THREE.TorusGeometry(w * 0.35, w * 0.06, 6, 8, PI),
      0, -h * 0.1, -len * 0.34,
      HALF_PI, PI, 0,
    ));

    // Third tier buttress arcs — highest, outermost
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.35, w * 0.02, 5, 6, PI * 0.4),
      s * w * 0.35, h * 0.55, len * 0.05,
      0, s * HALF_PI, HALF_PI,
    )));

    // Nave weapon galleries — long platforms along the upper nave
    parts.push(place(
      new THREE.BoxGeometry(w * 0.4, h * 0.06, len * 0.45),
      0, h * 0.58, len * 0.05,
    ));

    // Gallery weapon mounts
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.04, h * 0.2, 4),
      s * w * 0.18, h * 0.7, len * 0.18,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.035, h * 0.18, 4),
      s * w * 0.18, h * 0.68, len * 0.0,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.035, h * 0.18, 4),
      s * w * 0.18, h * 0.68, -len * 0.12,
    )));

    // Corner pinnacles on transept ends
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.04, h * 0.3, 4),
      s * w * 0.5, h * 0.48, len * 0.08,
    )));
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.04, h * 0.3, 4),
      s * w * 0.5, h * 0.48, -len * 0.04,
    )));

    // Prow lance — forward-facing heavy weapon integrated into spire
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.02, w * 0.035, len * 0.15, 4),
      0, 0, len * 0.58,
      HALF_PI, 0, 0,
    ));
  }

  // ══════════════════════════════════════════════════════════════════════
  // cx >= 7: DREADNOUGHT BASILICA — TWIN WESTERN TOWERS + NARTHEX
  // The grandest warships gain a full western facade: twin towers at the
  // prow, a narthex entrance bay, and a massive dorsal reliquary vault.
  // ══════════════════════════════════════════════════════════════════════
  if (cx >= 7) {
    // Western towers — tall square towers flanking the prow
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.14, h * 1.2, len * 0.12),
      s * w * 0.28, h * 0.35, len * 0.3,
    )));
    // Tower spire caps
    parts.push(...mirrorX(s => place(
      new THREE.ConeGeometry(w * 0.1, h * 0.5, 4),
      s * w * 0.28, h * 1.2, len * 0.3,
    )));

    // Narthex — entrance bay between western towers
    parts.push(place(
      new THREE.BoxGeometry(w * 0.4, h * 0.45, len * 0.08),
      0, h * 0.05, len * 0.34,
    ));

    // Grand rose window between towers
    parts.push(place(
      new THREE.TorusGeometry(w * 0.15, w * 0.035, 6, 10),
      0, h * 0.45, len * 0.36,
      HALF_PI, 0, 0,
    ));

    // Reliquary vault — raised dorsal structure amidships
    parts.push(place(
      new THREE.BoxGeometry(w * 0.3, h * 0.2, len * 0.2),
      0, h * 0.85, -len * 0.05,
    ));

    // Vault spire
    parts.push(place(
      new THREE.ConeGeometry(w * 0.06, h * 0.35, 4),
      0, h * 1.12, -len * 0.05,
    ));

    // Additional buttress forest — outboard struts
    parts.push(...mirrorX(s => place(
      new THREE.TorusGeometry(h * 0.4, w * 0.02, 5, 6, PI * 0.35),
      s * w * 0.55, h * 0.35, len * 0.2,
      0, s * HALF_PI, HALF_PI,
    )));

    // Heavy broadside weapon bays in aisle walls
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.08, h * 0.2, len * 0.3),
      s * w * 0.52, -h * 0.05, len * 0.05,
    )));
    // Broadside weapon ports
    for (let i = -1; i <= 1; i++) {
      parts.push(...mirrorX(s => place(
        new THREE.CylinderGeometry(w * 0.02, w * 0.02, w * 0.1, 4),
        s * w * 0.57, -h * 0.05, len * (0.05 + i * 0.1),
        0, 0, s * HALF_PI,
      )));
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // cx >= 8: ARK CATHEDRAL — THE TEMPLE-SHIP
  // The ultimate expression of Orivani devotion: a vessel so vast it
  // carries an entire congregation. The spire forest becomes a skyline.
  // ══════════════════════════════════════════════════════════════════════
  if (cx >= 8) {
    // Expanded apse — doubled sanctuary with radiating chapels
    parts.push(place(
      new THREE.CylinderGeometry(w * 0.4, w * 0.4, h * 0.8, 10, 1, false, 0, PI),
      0, -h * 0.05, -len * 0.38,
      0, PI, 0,
    ));

    // Radiating chapel spires around the apse
    for (let i = 0; i < 5; i++) {
      const angle = (PI / 6) + (i / 4) * (PI * 2 / 3);
      const cx8 = Math.sin(angle) * w * 0.42;
      const cz = -len * 0.38 + Math.cos(angle) * w * 0.42;
      parts.push(place(
        new THREE.ConeGeometry(w * 0.035, h * 0.35, 4),
        cx8, h * 0.45, cz,
      ));
    }

    // Triforium gallery — second-storey arcade along the nave
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.06, h * 0.15, len * 0.5),
      s * w * 0.3, h * 0.48, 0,
    )));

    // Grand organ pipes — vertical cylinders at apse interior
    for (let i = -2; i <= 2; i++) {
      const pipeH = h * (0.6 + Math.abs(i) * 0.15);
      parts.push(place(
        new THREE.CylinderGeometry(w * 0.015, w * 0.015, pipeH, 4),
        i * w * 0.06, pipeH / 2, -len * 0.3,
      ));
    }

    // Dorsal observation dome — the chapter house
    parts.push(place(
      new THREE.SphereGeometry(w * 0.15, 8, 6, 0, PI * 2, 0, HALF_PI),
      0, h * 0.95, len * 0.12,
    ));

    // Outermost weapon ring — broadside casemates
    parts.push(...mirrorX(s => place(
      new THREE.BoxGeometry(w * 0.1, h * 0.15, len * 0.4),
      s * w * 0.6, -h * 0.2, 0,
    )));

    // Ventral bombardment bay
    parts.push(place(
      new THREE.BoxGeometry(w * 0.25, h * 0.12, len * 0.25),
      0, -h * 0.65, len * 0.05,
    ));
  }

  return merge(parts);
}

// ─── Hardpoint Provider ─────────────────────────────────────────────────────

function getOrivaniHardpoints(len: number, cx: number): { engines: EngineHardpoint[]; weapons: WeaponHardpoint[] } {
  const w = len * 0.30;
  const h = len * 0.28;
  const engines: EngineHardpoint[] = [];
  const weapons: WeaponHardpoint[] = [];

  // ── Spire prow weapon — always present ────────────────────────────────────
  // The pointed spire prow serves as a forward weapon mount.
  weapons.push({
    position: new THREE.Vector3(0, 0, len * 0.47),
    facing: 'fore',
    normal: new THREE.Vector3(0, 0, 1),
  });

  // ── Sanctified flame exhausts (cx >= 3) ───────────────────────────────────
  // Triple cones at the apse — the Orivani's engine emitters.
  if (cx >= 3) {
    for (let i = -1; i <= 1; i++) {
      engines.push({
        position: new THREE.Vector3(i * w * 0.14, -h * 0.05, -len * 0.5),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.07,
      });
    }
  }

  // ── Bell tower spire weapons (cx >= 2) ────────────────────────────────────
  // Twin bell towers flanking the transept serve as weapon platforms.
  if (cx >= 2) {
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.44, h * 0.78, len * 0.02),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
  }

  // ── Buttress platform weapons + dorsal roof turrets (cx >= 4) ─────────────
  if (cx >= 4) {
    // Weapon platforms atop forward buttress arcs
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.58, h * 0.58, len * 0.18),
        facing: s === -1 ? 'port' : 'starboard',
        normal: new THREE.Vector3(s, 0.3, 0.5).normalize(),
      });
    }
    // Dorsal roof turrets — forward pair
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.12, h * 0.78, len * 0.15),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
  }

  // ── Additional capital engine exhausts (cx >= 5) ──────────────────────────
  // Five-flame apse — outer pair joins the original three.
  if (cx >= 5) {
    for (const s of [-1, 1]) {
      engines.push({
        position: new THREE.Vector3(s * w * 0.28, -h * 0.05, -len * 0.52),
        direction: new THREE.Vector3(0, 0, -1),
        radius: w * 0.055,
      });
    }
  }

  // ── Gallery weapon mounts + prow lance (cx >= 6) ──────────────────────────
  if (cx >= 6) {
    // Nave weapon gallery — dorsal cone turrets
    for (const s of [-1, 1]) {
      weapons.push({
        position: new THREE.Vector3(s * w * 0.18, h * 0.7, len * 0.18),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
      weapons.push({
        position: new THREE.Vector3(s * w * 0.18, h * 0.68, len * 0.0),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
      weapons.push({
        position: new THREE.Vector3(s * w * 0.18, h * 0.68, -len * 0.12),
        facing: 'dorsal',
        normal: new THREE.Vector3(0, 1, 0),
      });
    }
    // Prow lance — forward-facing heavy weapon
    weapons.push({
      position: new THREE.Vector3(0, 0, len * 0.58),
      facing: 'fore',
      normal: new THREE.Vector3(0, 0, 1),
    });
  }

  // ── Broadside weapon bays + western tower weapons (cx >= 7) ───────────────
  if (cx >= 7) {
    // Heavy broadside weapon ports
    for (let i = -1; i <= 1; i++) {
      for (const s of [-1, 1]) {
        weapons.push({
          position: new THREE.Vector3(s * w * 0.57, -h * 0.05, len * (0.05 + i * 0.1)),
          facing: s === -1 ? 'port' : 'starboard',
          normal: new THREE.Vector3(s, 0, 0).normalize(),
        });
      }
    }
  }

  return { engines, weapons };
}

registerHardpointProvider('orivani', getOrivaniHardpoints);
