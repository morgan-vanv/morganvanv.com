// Lighthouse CI: every page in public/sitemap.xml, served from the prerendered build.
// Runs as desktop by default; LH_FORM_FACTOR=mobile runs as a phone (Lighthouse's default mobile emulation).
//
// What fails a PR (only things that don't wobble with runner speed):
//   - accessibility or SEO below 0.95
//   - page weight, JavaScript or images past a loose ceiling, or layout shift past 0.1.
//     The ceilings sit well above today's numbers, so they only catch accidents (an unconverted PNG,
//     a library bundled twice). Growing on purpose? Raise the number here.
// Performance and best-practices scores only warn, since runner timing is noisy.
const { readFileSync } = require('node:fs');

const KB = 1024;
const mobile = process.env.LH_FORM_FACTOR === 'mobile';

// Sitemap URLs (trailing slashes, as GitHub Pages serves them), pointed at LHCI's local server.
const urls = [...readFileSync('public/sitemap.xml', 'utf8').matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map(
  ([, path]) => `http://localhost${path}`,
);

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist/browser',
      url: urls,
      numberOfRuns: 3,
      settings: mobile ? { formFactor: 'mobile' } : { preset: 'desktop' },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:performance': ['warn', { minScore: 0.8 }],
        'total-byte-weight': ['error', { maxNumericValue: 3000 * KB }],
        'resource-summary:script:size': ['error', { maxNumericValue: 1200 * KB }],
        'resource-summary:image:size': ['error', { maxNumericValue: 1500 * KB }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
