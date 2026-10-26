// Turns a Lighthouse CI run (.lighthouseci/) into a small Markdown table: the median of each page's
// runs, any failed or warned checks, and links to the full reports. In GitHub Actions it's written to
// the job summary (shown on the Quality check's Summary page); locally it's printed.
//
//   node scripts/lighthouse-summary.mjs "Desktop"
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';

const dir = '.lighthouseci';
const label = process.argv[2] ?? 'Lighthouse';
const readJson = file => (existsSync(`${dir}/${file}`) ? JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) : null);

const runs = existsSync(dir)
  ? readdirSync(dir)
      .filter(file => /^lhr-.*\.json$/.test(file))
      .map(readJson)
  : [];
const links = readJson('links.json') ?? {};
const assertions = readJson('assertion-results.json') ?? [];

const median = values => {
  const sorted = values.filter(value => typeof value === 'number').sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
};
const path = url => new URL(url).pathname;
const score = value => (value === null ? '–' : Math.round(value * 100));
const kb = value => (value === null ? '–' : `${Math.round(value / 1024)} KB`);
const transfer = (lhr, type) =>
  lhr.audits['resource-summary']?.details?.items?.find(item => item.resourceType === type)?.transferSize;

const byUrl = Map.groupBy(runs, lhr => lhr.requestedUrl);
const pages = [...byUrl].map(([url, lhrs]) => {
  const m = pick => median(lhrs.map(pick));
  return {
    url,
    perf: m(lhr => lhr.categories.performance?.score),
    a11y: m(lhr => lhr.categories.accessibility?.score),
    best: m(lhr => lhr.categories['best-practices']?.score),
    seo: m(lhr => lhr.categories.seo?.score),
    weight: m(lhr => lhr.audits['total-byte-weight']?.numericValue),
    js: m(lhr => transfer(lhr, 'script')),
    images: m(lhr => transfer(lhr, 'image')),
    cls: m(lhr => lhr.audits['cumulative-layout-shift']?.numericValue),
  };
});

const failed = assertions
  .filter(result => !result.passed)
  .map(result => {
    const name = result.auditProperty ? `${result.auditId}:${result.auditProperty}` : result.auditId;
    const bytes = result.auditId === 'total-byte-weight' || result.auditProperty?.endsWith('size');
    const show = value => (bytes ? kb(value) : Number(value.toFixed(3)));
    const text = `${path(result.url)} ${name}: ${show(result.actual)} (want ${result.operator} ${show(result.expected)})`;
    return { level: result.level, text };
  });

const markdown = [
  `### Lighthouse: ${label}`,
  '',
  pages.length
    ? [
        '| Page | Perf | A11y | Best | SEO | Weight | JS | Images | CLS | |',
        '|---|--:|--:|--:|--:|--:|--:|--:|--:|---|',
        ...pages.map(p =>
          [
            `\`${path(p.url)}\``,
            score(p.perf),
            score(p.a11y),
            score(p.best),
            score(p.seo),
            kb(p.weight),
            kb(p.js),
            kb(p.images),
            p.cls?.toFixed(3) ?? '–',
            links[p.url] ? `[report](${links[p.url]})` : '',
          ].join(' | '),
        ).map(row => `| ${row} |`),
        '',
        `Median of ${Math.max(...[...byUrl.values()].map(lhrs => lhrs.length))} runs per page.`,
      ].join('\n')
    : '_No Lighthouse results found._',
  failed.length ? ['', ...failed.map(f => `- ${f.level === 'error' ? '❌' : '⚠️'} \`${f.text}\``)].join('\n') : '',
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else console.log(markdown);

// In Actions, also annotate the run: each failed check (so the reason shows on the PR), and one line
// with the heaviest numbers (what the ceilings in lighthouserc.cjs are measured against).
if (process.env.GITHUB_ACTIONS) {
  for (const f of failed) console.log(`::${f.level === 'error' ? 'error' : 'warning'} title=Lighthouse ${label}::${f.text}`);
  if (pages.length) {
    const most = key => Math.max(...pages.map(p => p[key] ?? 0));
    console.log(
      `::notice title=Lighthouse ${label}::heaviest page ${kb(most('weight'))} · JS ${kb(most('js'))} · images ${kb(most('images'))} · ` +
        `max CLS ${most('cls').toFixed(3)} · lowest perf ${Math.round(Math.min(...pages.map(p => p.perf ?? 1)) * 100)}`,
    );
  }
}
