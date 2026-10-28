/**
 * The site's Content Security Policy.
 *
 * GitHub Pages can't send headers, so `scripts/write-csp.mjs` (the `postbuild` hook) puts this policy in
 * a `<meta http-equiv="Content-Security-Policy">` on every built page, with the SHA-256 of that page's own
 * inline scripts (Angular's event-replay contract and bootstrap, the stylesheet swap). Nothing else may
 * run: no other inline script, no script from another origin, no eval. A meta policy can't set
 * `frame-ancestors`, `report-uri` or `sandbox`; browsers ignore those there.
 *
 * No imports, and only erasable TypeScript: the script runs it straight from Node 24.
 */

/**
 * Everything the browser fetches from (`fetch`/`HttpClient`, plus `blob:`/`data:` for the 3D model's
 * textures). Add an origin here when the site starts calling a new API; `csp.spec.ts` checks the ones in
 * `SITE_CONFIG` and the API services are listed.
 */
export const CONNECT_ORIGINS: readonly string[] = [
  'https://api.stats.fm',
  'https://api.wiseoldman.net',
  'https://api.runeprofile.com',
  'https://api.open-meteo.com',
  'https://api.github.com',
  'https://campfire.morganvanv.workers.dev',
  'https://ask.morganvanv.workers.dev',
];

/** The policy for one page, given the `'sha256-…'` sources of its inline scripts. */
export function contentSecurityPolicy(scriptHashes: readonly string[]): string {
  const directives: [string, ...string[]][] = [
    ['default-src', "'self'"],
    // 'wasm-unsafe-eval' lets WebAssembly compile (three.js's meshopt decoder, inside <model-viewer>, does
    // on load); it doesn't allow eval() or new Function().
    ['script-src', "'self'", "'wasm-unsafe-eval'", ...scriptHashes],
    // Angular's component styles and the critical CSS are inline <style>s, and bindings set style="".
    ['style-src', "'self'", "'unsafe-inline'"],
    // Album covers (stats.fm's CDNs), OSRS icons and avatars come from many hosts, always over https.
    ['img-src', "'self'", 'data:', 'blob:', 'https:'],
    ['font-src', "'self'"],
    ['connect-src', "'self'", 'blob:', 'data:', ...CONNECT_ORIGINS],
    // <model-viewer> (three.js) decodes in workers it makes from blobs.
    ['worker-src', "'self'", 'blob:'],
    ['manifest-src', "'self'"],
    ['media-src', "'self'"],
    ['frame-src', "'none'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['upgrade-insecure-requests'],
  ];
  return directives.map(directive => directive.join(' ')).join('; ');
}
