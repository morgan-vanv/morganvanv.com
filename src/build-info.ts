import { BuildInfo } from './build-info.model';

/**
 * Development placeholder. Production builds replace this file with the
 * generated, gitignored src/build-info.prod.ts (see scripts/write-build-info.mjs
 * and fileReplacements in angular.json), so `ng serve` and tests work from a
 * fresh checkout.
 */
export const BUILD_INFO: BuildInfo = {
  sha: '0000000000000000000000000000000000000000',
  date: '2026-01-01T00:00:00Z',
  message: 'local development build',
};
