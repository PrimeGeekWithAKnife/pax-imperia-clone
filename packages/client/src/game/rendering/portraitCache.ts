// ── Portrait Cache ─────────────────────────────────────────────────────────────
//
// Singleton cache that stores rendered portrait data URLs keyed by
// `${speciesId}:${size}`. Avoids re-rendering identical portraits on every
// React render cycle.

import { PortraitRenderer } from './PortraitRenderer';
import type { PortraitOptions } from './PortraitRenderer';

class PortraitCache {
  private cache = new Map<string, string>();
  private renderer = new PortraitRenderer();

  /**
   * Return a cached data URL for the given pre-built species.
   * Renders and caches on first call for each speciesId/size combination.
   */
  getPortrait(speciesId: string, size: number): string {
    const key = `${speciesId}:${size}`;
    let url = this.cache.get(key);
    if (!url) {
      url = this.renderer.renderPortrait(speciesId, size);
      this.cache.set(key, url);
    }
    return url;
  }

  /**
   * Return a cached data URL for a custom PortraitOptions.
   * The cache key is built from the options values + size.
   */
  getCustomPortrait(options: PortraitOptions, size: number): string {
    const key = `custom:${options.baseShape}:${options.primaryColor}:${options.secondaryColor}:${options.accentColor}:${options.features.join(',')}:${size}`;
    let url = this.cache.get(key);
    if (!url) {
      url = this.renderer.renderCustomPortrait(options, size);
      this.cache.set(key, url);
    }
    return url;
  }

  /**
   * Discard all cached entries — call when the game is reset or settings change.
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton export
export const portraitCache = new PortraitCache();
