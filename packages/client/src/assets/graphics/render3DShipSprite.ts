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

function ensureRenderer(size: number): void {
  if (!_renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    _renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    _renderer.setClearColor(0x000000, 0);
    _renderer.setPixelRatio(1);

    _scene = new THREE.Scene();

    // Orthographic camera for consistent scale across hull classes.
    // Frustum is set per-render based on the ship's bounding box.
    _camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 200);
    // 3/4 top-down view — slightly from above and behind
    _camera.position.set(0, 12, 6);
    _camera.lookAt(0, 0, 0);

    // ── Lighting ───────────────────────────────────────────────────────
    // Key light — warm white from upper-right
    const key = new THREE.DirectionalLight(0xfff8f0, 1.4);
    key.position.set(8, 12, 6);
    _scene.add(key);

    // Fill light — cool blue from left (simulates ambient space light)
    const fill = new THREE.DirectionalLight(0x6688cc, 0.5);
    fill.position.set(-6, 4, -2);
    _scene.add(fill);

    // Rim light — highlights the silhouette edge
    const rim = new THREE.DirectionalLight(0x88aaff, 0.3);
    rim.position.set(0, -4, -8);
    _scene.add(rim);

    // Ambient — keeps shadow areas from going fully black
    const ambient = new THREE.AmbientLight(0x303050, 0.6);
    _scene.add(ambient);
  }

  if (_lastSize !== size) {
    _renderer.setSize(size, size);
    _lastSize = size;
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

  // Remove previous ship mesh
  const existing = _scene!.getObjectByName('__ship');
  if (existing) {
    _scene!.remove(existing);
    if ((existing as THREE.Mesh).geometry) (existing as THREE.Mesh).geometry.dispose();
    if ((existing as THREE.Mesh).material) {
      const mat = (existing as THREE.Mesh).material;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else (mat as THREE.Material).dispose();
    }
  }

  // Generate ship mesh
  const geometry = generateShipGeometry(speciesId, hullClass);
  const material = getShipMaterial(speciesId);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = '__ship';

  // Rotate so +Z (bow) faces right in the rendered image.
  // Camera looks down from above, so we rotate around Y axis.
  mesh.rotation.y = -Math.PI / 2;

  // Auto-fit: scale the ship to fill the camera frustum.
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  const sizeX = box.max.x - box.min.x;
  const sizeY = box.max.y - box.min.y;
  const sizeZ = box.max.z - box.min.z;
  // After Y rotation, Z becomes X and X becomes Z in screen space.
  const screenW = sizeZ; // length becomes horizontal
  const screenH = Math.max(sizeX, sizeY); // width/height become vertical
  const maxSpan = Math.max(screenW, screenH) * 1.3; // padding

  // Centre the mesh
  const centreX = (box.max.x + box.min.x) / 2;
  const centreY = (box.max.y + box.min.y) / 2;
  const centreZ = (box.max.z + box.min.z) / 2;
  mesh.position.set(-centreX, -centreY, -centreZ);

  // Wrap in a group so rotation applies after centring
  const group = new THREE.Group();
  group.name = '__ship';
  group.add(mesh);

  _scene!.add(group);

  // Set orthographic frustum to fit the ship
  const half = maxSpan / 2;
  _camera!.left = -half;
  _camera!.right = half;
  _camera!.top = half;
  _camera!.bottom = -half;
  _camera!.updateProjectionMatrix();

  // Render
  _renderer!.render(_scene!, _camera!);

  const dataUrl = _renderer!.domElement.toDataURL('image/png');
  _cache.set(key, dataUrl);

  // Clean up geometry (material is reusable)
  _scene!.remove(group);
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
