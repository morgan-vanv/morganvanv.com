// Writes dist/browser/lighthouse.json for the Lighthouse badge on /now: the median scores of the
// homepage runs that the deploy job just collected into .lighthouseci/ (as a phone).
// If there are no usable runs it leaves the committed placeholder (public/lighthouse.json) in place,
// and the badge hides itself.
//
//   LH_FORM_FACTOR=mobile LH_PAGES=/ npx @lhci/cli@0.15.x collect --config=./lighthouserc.cjs
//   node scripts/write-lighthouse-badge.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = '.lighthouseci';
const out = 'dist/browser/lighthouse.json';

const runs = existsSync(dir)
  ? readdirSync(dir)
      .filter(file => /^lhr-.*\.json$/.test(file))
      .map(file => JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')))
  : [];

const median = values => {
  const sorted = values.filter(value => typeof value === 'number').sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)] * 100) : null;
};
const category = id => median(runs.map(lhr => lhr.categories?.[id]?.score));

const scores = {
  performance: category('performance'),
  accessibility: category('accessibility'),
  bestPractices: category('best-practices'),
  seo: category('seo'),
};

if (Object.values(scores).some(score => score === null)) {
  console.warn(`write-lighthouse-badge: no usable runs (${runs.length} found); the badge will hide.`);
} else {
  writeFileSync(out, JSON.stringify({ scores, measuredAt: new Date().toISOString() }) + '\n');
  console.log(`write-lighthouse-badge: ${out} ${JSON.stringify(scores)}`);
}
