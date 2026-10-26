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
const rows = [...byUrl].map(([url, lhrs]) => {
  const m = pick => median(lhrs.map(pick));
  return [
    `\`${path(url)}\``,
    score(m(lhr => lhr.categories.performance?.score)),
    score(m(lhr => lhr.categories.accessibility?.score)),
    score(m(lhr => lhr.categories['best-practices']?.score)),
    score(m(lhr => lhr.categories.seo?.score)),
    kb(m(lhr => lhr.audits['total-byte-weight']?.numericValue)),
    kb(m(lhr => transfer(lhr, 'script'))),
    kb(m(lhr => transfer(lhr, 'image'))),
    m(lhr => lhr.audits['cumulative-layout-shift']?.numericValue)?.toFixed(3) ?? '–',
    links[url] ? `[report](${links[url]})` : '',
  ];
});

const problems = assertions
  .filter(result => !result.passed)
  .map(result => {
    const name = result.auditProperty ? `${result.auditId}:${result.auditProperty}` : result.auditId;
    const bytes = result.auditId === 'total-byte-weight' || result.auditProperty?.endsWith('size');
    const show = value => (bytes ? kb(value) : Number(value.toFixed(3)));
    return `- ${result.level === 'error' ? '❌' : '⚠️'} \`${path(result.url)}\` ${name}: ${show(result.actual)} (want ${result.operator} ${show(result.expected)})`;
  });

const markdown = [
  `### Lighthouse: ${label}`,
  '',
  rows.length
    ? [
        '| Page | Perf | A11y | Best | SEO | Weight | JS | Images | CLS | |',
        '|---|--:|--:|--:|--:|--:|--:|--:|--:|---|',
        ...rows.map(row => `| ${row.join(' | ')} |`),
        '',
        `Median of ${Math.max(...[...byUrl.values()].map(lhrs => lhrs.length))} runs per page.`,
      ].join('\n')
    : '_No Lighthouse results found._',
  problems.length ? ['', ...problems].join('\n') : '',
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else console.log(markdown);
