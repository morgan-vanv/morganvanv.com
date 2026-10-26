// Writes dist/browser/lighthouse.json for the Lighthouse and Page weight badges on /now: the median
// scores and weights of the homepage runs that the deploy job just collected into .lighthouseci/ (as a
// phone), with the ceilings lighthouserc.cjs holds every page to.
// If there are no usable runs it leaves the committed placeholder (public/lighthouse.json) in place,
// and the badge hides itself.
//
//   LH_FORM_FACTOR=mobile LH_PAGES=/ npx @lhci/cli@0.15.x collect --config=./lighthouserc.cjs
//   node scripts/write-lighthouse-badge.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const dir = '.lighthouseci';
const out = 'dist/browser/lighthouse.json';

const runs = existsSync(dir)
  ? readdirSync(dir)
      .filter(file => /^lhr-.*\.json$/.test(file))
      .map(file => JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')))
  : [];

const middle = values => {
  const sorted = values.filter(value => typeof value === 'number').sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};
const median = values => {
  const value = middle(values);
  return value === null ? null : Math.round(value * 100);
};
const category = id => median(runs.map(lhr => lhr.categories?.[id]?.score));

const scores = {
  performance: category('performance'),
  accessibility: category('accessibility'),
  bestPractices: category('best-practices'),
  seo: category('seo'),
};

// Weights in KB (what Lighthouse calls KiB): the whole page, and its JavaScript.
const KB = 1024;
const kb = bytes => (bytes === null ? null : Math.round(bytes / KB));
const assertions = createRequire(import.meta.url)('../lighthouserc.cjs').ci.assert.assertions;
const ceiling = id => kb(assertions[id]?.[1]?.maxNumericValue ?? null);
const weight = {
  total: kb(middle(runs.map(lhr => lhr.audits?.['total-byte-weight']?.numericValue))),
  script: kb(middle(runs.map(lhr => lhr.audits?.['resource-summary']?.details?.items?.find(item => item.resourceType === 'script')?.transferSize))),
  totalCeiling: ceiling('total-byte-weight'),
  scriptCeiling: ceiling('resource-summary:script:size'),
};

if (Object.values(scores).some(score => score === null)) {
  console.warn(`write-lighthouse-badge: no usable runs (${runs.length} found); the badges will hide.`);
} else {
  const report = { scores, measuredAt: new Date().toISOString() };
  // The weights are a bonus: without them the Lighthouse badge still shows, the Page weight one doesn't.
  if (Object.values(weight).every(value => typeof value === 'number')) report.weight = weight;
  writeFileSync(out, JSON.stringify(report) + '\n');
  console.log(`write-lighthouse-badge: ${out} ${JSON.stringify(report)}`);
}
