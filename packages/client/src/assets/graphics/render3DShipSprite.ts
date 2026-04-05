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
    // Better colour output for ship materials
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.4;

    _scene = new THREE.Scene();

    // Orthographic camera — frustum set per-render based on bounding box.
    _camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
    // Shallow 3/4 view (30° from horizontal) to show hull profile, not just the top.
    // Camera positioned to the upper-right so detail (turrets, engines, nacelles) is visible.
    _camera.position.set(4, 6, 10);
    _camera.lookAt(0, 0, 0);

    // ── Lighting — strong contrast to reveal 3D detail ────────────────
    // Key light — bright from upper-right-front, casting strong shadows
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(6, 8, 10);
    _scene.add(key);

    // Fill light — cool blue from lower-left (space ambient)
    const fill = new THREE.DirectionalLight(0x4466aa, 0.8);
    fill.position.set(-8, -2, -4);
    _scene.add(fill);

    // Rim/back light — highlights silhouette edges against dark space
    const rim = new THREE.DirectionalLight(0x6688cc, 0.6);
    rim.position.set(-2, 4, -10);
    _scene.add(rim);

    // Ambient — low so shadows have contrast
    const ambient = new THREE.AmbientLight(0x202040, 0.4);
    _scene.add(ambient);
  }

  if (_lastSize !== renderSize) {
    _renderer.setSize(renderSize, renderSize);
    _lastSize = renderSize;
  }
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
  const existing = _scene!.getObjectByName('__ship');
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

  // Generate ship mesh
  const geometry = generateShipGeometry(speciesId, hullClass);
  const material = getShipMaterial(speciesId);

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

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = '__ship';

  // Rotate so +Z (bow) faces right in the rendered image.
  // Camera looks down from above, so we rotate around Y axis.
  mesh.rotation.y = -Math.PI / 2;

  // After Y rotation, Z becomes X and X becomes Z in screen space.
  const screenW = sizeZ; // length becomes horizontal
  const screenH = Math.max(sizeX, sizeY); // width/height become vertical
  const maxSpan = Math.max(screenW, screenH) * 1.3; // padding

  _scene!.add(mesh);

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

  // Clean up geometry and material
  _scene!.remove(mesh);
  geometry.dispose();
  (material as THREE.Material).dispose();

  return dataUrl;
}

/**
 * Clear the sprite cache. Call if species or models change at runtime.
 */
export function clear3DSpriteCache(): void {
  _cache.clear();
}
