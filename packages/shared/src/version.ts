/** Current game version — bump by 0.001 per feature/bug/change. */
export const VERSION = '0.2.0';

/** Auto-incrementing build counter. Bump with every commit. */
export const BUILD_NUMBER = 4;

/** Returns the formatted version string shown in the UI. */
export function getVersionString(): string {
  return `v${VERSION} Alpha \u2014 Build ${BUILD_NUMBER}`;
}
