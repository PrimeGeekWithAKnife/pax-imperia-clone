/**
 * render3DShipSprite — Renders a 3D ship model to a 2D PNG data URL.
 *
 * Uses an offscreen Three.js renderer to produce a top-down 3/4 view
 * of each species' procedural ship geometry. The resulting image can be
 * used as a Phaser sprite texture, giving combat ships their full 3D
 * appearance while keeping the existing 2D combat engine intact.
 *
 * Ships are rendered nose-right (matching combat scene orientation) so
 * Phaser's container.setRotation(facing) handles the rest.
 *
 * Visual enhancements:
 * - Engine glow spheres at the aft (species emissive colour)
 * - Crew/window lights along the hull midline (warm white)
 * - Running lights — red port, green starboard near the bow
 * - Species-coloured point light for strong faction tinting
 * - Boosted emissive intensity and tone-mapping exposure
 */
import * as THREE from 'three';
import { generateShipGeometry, getShipMaterial } from '../../game/rendering/ShipModels3D';
import type { HullClass } from '@nova-imperia/shared';

// ── Shared offscreen renderer (created once, reused) ───────────────────────

let _renderer: THREE.WebGLRenderer | null = null;
let _scene: THREE.Scene | null = null;
let _camera: THREE.OrthographicCamera | null = null;
let _lastSize = 0;

/** Sprite render cache — avoids re-rendering the same ship repeatedly. */
const _cache = new Map<string, string>();

function cacheKey(speciesId: string, hullClass: HullClass, size: number): string {
  return `${speciesId}:${hullClass}:${size}`;
}

/** Internal render resolution multiplier — render at higher res for crisp detail. */
const SUPERSAMPLE = 2;

function ensureRenderer(size: number): void {
  const renderSize = size * SUPERSAMPLE;
  if (!_renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = renderSize;
    canvas.height = renderSize;
    _renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    _renderer.setClearColor(0x000000, 0);
    _renderer.setPixelRatio(1);
    // Tone mapping tuned for emissive glow — higher exposure makes
    // engine lights and crew windows bloom against dark space.
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.8;

    _scene = new THREE.Scene();

    // Orthographic camera — frustum set per-render based on bounding box.
    _camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
    // Shallow 3/4 view (30° from horizontal) to show hull profile, not just the top.
    // Camera positioned to the upper-right so detail (turrets, engines, nacelles) is visible.
    _camera.position.set(4, 6, 10);
    _camera.lookAt(0, 0, 0);

    // ── Lighting — strong contrast to reveal 3D detail ────────────────
    // Key light — bright from upper-right-front, casting strong shadows
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(6, 8, 10);
    _scene.add(key);

    // Fill light — cool blue from lower-left (space ambient)
    const fill = new THREE.DirectionalLight(0x4466aa, 1.0);
    fill.position.set(-8, -2, -4);
    _scene.add(fill);

    // Rim/back light — highlights silhouette edges against dark space
    const rim = new THREE.DirectionalLight(0x6688cc, 0.8);
    rim.position.set(-2, 4, -10);
    _scene.add(rim);

    // Ambient — raised slightly so hull details remain readable
    const ambient = new THREE.AmbientLight(0x303050, 0.6);
    _scene.add(ambient);
  }

  if (_lastSize !== renderSize) {
    _renderer.setSize(renderSize, renderSize);
    _lastSize = renderSize;
  }
}

// ── Light geometry helpers ─────────────────────────────────────────────────

/** Reusable low-poly sphere geometry for tiny light dots. */
const _lightSphereGeo = new THREE.SphereGeometry(1, 6, 4);

/**
 * Create a small emissive sphere (light dot) added to `parent`.
 * Uses MeshBasicMaterial so it glows regardless of scene lighting.
 */
function addLightDot(
  parent: THREE.Group,
  colour: THREE.ColorRepresentation,
  radius: number,
  x: number, y: number, z: number,
): void {
  const mat = new THREE.MeshBasicMaterial({ color: colour });
  const dot = new THREE.Mesh(_lightSphereGeo, mat);
  dot.scale.setScalar(radius);
  dot.position.set(x, y, z);
  parent.add(dot);
}

/**
 * Add engine glow spheres at the aft (negative Z) end of the ship.
 * 2-4 spheres depending on hull width, using the species emissive colour.
 */
function addEngineGlows(
  group: THREE.Group,
  emissiveColour: THREE.Color,
  shipLength: number,
  shipWidth: number,
): void {
  const aftZ = -shipLength * 0.45;
  const radius = shipLength * 0.04;
  // Brighter, saturated version of the emissive colour for engines
  const bright = emissiveColour.clone().lerp(new THREE.Color(0xffffff), 0.3);

  // Central pair
  const spread = shipWidth * 0.15;
  addLightDot(group, bright, radius, -spread, 0, aftZ);
  addLightDot(group, bright, radius,  spread, 0, aftZ);

  // Outer pair for wider ships
  if (shipWidth > shipLength * 0.3) {
    const outerSpread = shipWidth * 0.35;
    addLightDot(group, bright, radius * 0.8, -outerSpread, 0, aftZ);
    addLightDot(group, bright, radius * 0.8,  outerSpread, 0, aftZ);
  }
}

/**
 * Add crew/window lights — tiny warm-white dots scattered along the hull.
 * 3-8 dots placed at varying Z positions along the midline.
 */
function addCrewLights(
  group: THREE.Group,
  shipLength: number,
  shipWidth: number,
): void {
  const crewColour = 0xffffdd; // warm white
  const radius = shipLength * 0.012;
  // Deterministic placement along hull — no randomness so cache is stable.
  const positions = [
    { xFrac:  0.00, zFrac:  0.10 },
    { xFrac:  0.08, zFrac: -0.05 },
    { xFrac: -0.10, zFrac: -0.20 },
    { xFrac:  0.06, zFrac:  0.25 },
    { xFrac: -0.05, zFrac: -0.30 },
    { xFrac:  0.12, zFrac:  0.00 },
  ];
  for (const p of positions) {
    addLightDot(
      group,
      crewColour,
      radius,
      p.xFrac * shipWidth,
      shipLength * 0.02, // slightly above hull surface
      p.zFrac * shipLength,
    );
  }
}

/**
 * Add running lights — red port (negative X), green starboard (positive X)
 * near the bow of the ship.
 */
function addRunningLights(
  group: THREE.Group,
  shipLength: number,
  shipWidth: number,
): void {
  const radius = shipLength * 0.018;
  const bowZ = shipLength * 0.40;
  const sideOffset = shipWidth * 0.35;
  // Red = port (negative X), green = starboard (positive X)
  addLightDot(group, 0xff0000, radius, -sideOffset, 0, bowZ);
  addLightDot(group, 0x00ff00, radius,  sideOffset, 0, bowZ);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Render a species' ship 3D model to a PNG data URL.
 *
 * The resulting image has the ship nose pointing RIGHT (matching combat
 * scene orientation where ships face +X). The background is transparent.
 *
 * Results are cached — subsequent calls with the same parameters return
 * the cached data URL instantly.
 */
export function render3DShipSprite(
  speciesId: string,
  hullClass: HullClass,
  size: number,
): string {
  const key = cacheKey(speciesId, hullClass, size);
  const cached = _cache.get(key);
  if (cached) return cached;

  ensureRenderer(size);

  // Remove previous ship group — traverse to dispose child mesh resources
  const existing = _scene!.getObjectByName('__shipGroup');
  if (existing) {
    _scene!.remove(existing);
    existing.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      }
    });
  }
  // Also remove the per-render species point light
  const existingLight = _scene!.getObjectByName('__speciesLight');
  if (existingLight) _scene!.remove(existingLight);

  // Generate ship mesh
  const geometry = generateShipGeometry(speciesId, hullClass);
  const material = getShipMaterial(speciesId);

  // ── Boost species emissive intensity ────────────────────────────────
  // Ensure the faction glow is clearly visible against dark space.
  const stdMat = material as THREE.MeshStandardMaterial;
  stdMat.emissiveIntensity = Math.max(stdMat.emissiveIntensity, 0.4);
  const emissiveColour = stdMat.emissive.clone();

  // Centre the geometry at origin BEFORE any mesh transforms, so that
  // the subsequent Y rotation pivots around the ship's visual centre.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const centreX = (box.max.x + box.min.x) / 2;
  const centreY = (box.max.y + box.min.y) / 2;
  const centreZ = (box.max.z + box.min.z) / 2;
  geometry.translate(-centreX, -centreY, -centreZ);

  // Recompute bounding box after centring (now symmetric around origin)
  geometry.computeBoundingBox();
  const centredBox = geometry.boundingBox!;
  const sizeX = centredBox.max.x - centredBox.min.x;
  const sizeY = centredBox.max.y - centredBox.min.y;
  const sizeZ = centredBox.max.z - centredBox.min.z;

  // ── Assemble ship group (hull + lights) ─────────────────────────────
  const shipGroup = new THREE.Group();
  shipGroup.name = '__shipGroup';

  const mesh = new THREE.Mesh(geometry, material);
  shipGroup.add(mesh);

  // Add engine glow spheres at the aft
  addEngineGlows(shipGroup, emissiveColour, sizeZ, sizeX);

  // Add crew/window lights along the hull
  addCrewLights(shipGroup, sizeZ, sizeX);

  // Add running lights (red port, green starboard)
  addRunningLights(shipGroup, sizeZ, sizeX);

  // Rotate so +Z (bow) faces right in the rendered image.
  // Camera looks down from above, so we rotate around Y axis.
  shipGroup.rotation.y = -Math.PI / 2;

  // After Y rotation, Z becomes X and X becomes Z in screen space.
  const screenW = sizeZ; // length becomes horizontal
  const screenH = Math.max(sizeX, sizeY); // width/height become vertical
  const maxSpan = Math.max(screenW, screenH) * 1.3; // padding

  _scene!.add(shipGroup);

  // ── Species-coloured point light ────────────────────────────────────
  // Positioned near the ship to tint hull with strong faction colour.
  const speciesLight = new THREE.PointLight(emissiveColour, 2.5, maxSpan * 3);
  speciesLight.name = '__speciesLight';
  speciesLight.position.set(0, sizeY * 2, 0);
  _scene!.add(speciesLight);

  // Set orthographic frustum to fit the ship
  const half = maxSpan / 2;
  _camera!.left = -half;
  _camera!.right = half;
  _camera!.top = half;
  _camera!.bottom = -half;
  _camera!.updateProjectionMatrix();

  // Render at supersample resolution
  _renderer!.render(_scene!, _camera!);

  // Downsample to requested size for crisp anti-aliased result
  let dataUrl: string;
  if (SUPERSAMPLE > 1) {
    const downCanvas = document.createElement('canvas');
    downCanvas.width = size;
    downCanvas.height = size;
    const ctx = downCanvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(_renderer!.domElement, 0, 0, size, size);
      dataUrl = downCanvas.toDataURL('image/png');
    } else {
      dataUrl = _renderer!.domElement.toDataURL('image/png');
    }
  } else {
    dataUrl = _renderer!.domElement.toDataURL('image/png');
  }
  _cache.set(key, dataUrl);

  // Clean up — remove group and species light, dispose all resources
  _scene!.remove(shipGroup);
  _scene!.remove(speciesLight);
  shipGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Don't dispose _lightSphereGeo — it's shared/reused
      if (child.geometry !== _lightSphereGeo) child.geometry?.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    }
  });

  return dataUrl;
}

/**
 * Clear the sprite cache. Call if species or models change at runtime.
 */
export function clear3DSpriteCache(): void {
  _cache.clear();
}
