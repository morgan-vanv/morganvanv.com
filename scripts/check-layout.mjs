// Layout check: every page in public/sitemap.xml, at every size the site promises to work at, in a real
// (headless) Chrome, against the prerendered build. Fails if any of these is broken:
//
//   - no horizontal scroll, on the page or in the card (`base-page`'s `.page-content`)
//   - exactly one <h1>
//   - tap targets at least 44×44 on touch-sized screens (links inside running text excepted, as WCAG allows)
//   - on tablets and phones, the ☾ never overlaps the pager's buttons
//
// Third-party APIs are blocked, so the result doesn't depend on stats.fm being up: live panels show their
// empty states. The same-origin badge files keep the placeholders the build ships with.
//
//   npm run build && npm run layout
//
// Chrome: CI uses the runner's own (channel "chrome"); elsewhere set CHROME_PATH to a Chrome or Chromium.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = 'dist/browser';
const SIZES = [[360, 740], [390, 844], [740, 360], [1024, 768], [1440, 900], [2560, 1080]];
const TOUCH_MAX_WIDTH = 1000; // $breakpoint-mobile: tablets and phones
const MIN_TARGET = 44;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary',
  '.txt': 'text/plain', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

const paths = [...readFileSync('public/sitemap.xml', 'utf8').matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map(([, path]) => path);

// A tiny static server for the prerendered build: /now/ serves /now/index.html, as GitHub Pages does.
const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = normalize(join(DIST, url));
  if (!file.startsWith(normalize(DIST))) return res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise(resolve => server.listen(0, resolve));
const origin = `http://localhost:${server.address().port}`;

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
);

// Runs in the page: everything wrong with the layout at this size, as readable strings.
function inspect({ touch, minTarget }) {
  const problems = [];
  const name = el => el.getAttribute('aria-label') || el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) || el.tagName.toLowerCase();
  const visible = el => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };

  const root = document.documentElement;
  if (root.scrollWidth > root.clientWidth + 1) problems.push(`page scrolls sideways (${root.scrollWidth} > ${root.clientWidth})`);
  const card = document.querySelector('.page-content');
  if (card && card.scrollWidth > card.clientWidth + 1) problems.push(`card scrolls sideways (${card.scrollWidth} > ${card.clientWidth})`);

  const h1s = document.querySelectorAll('h1').length;
  if (h1s !== 1) problems.push(`${h1s} <h1>s`);

  if (touch) {
    const inRunningText = el => {
      const parent = el.parentElement;
      // Inline (pills are inline-flex) and sitting among words: WCAG 2.5.8 exempts targets in a sentence.
      return getComputedStyle(el).display.startsWith('inline') && !!parent
        && [...parent.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    };
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')) {
      if (!visible(el) || el.closest('[aria-hidden=true], [inert]') || inRunningText(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < minTarget - 0.5 || r.height < minTarget - 0.5) {
        problems.push(`small tap target "${name(el)}" (${Math.round(r.width)}×${Math.round(r.height)})`);
      }
    }
    const moon = document.querySelector('.sky-button');
    if (moon && visible(moon)) {
      const m = moon.getBoundingClientRect();
      for (const el of document.querySelectorAll('.pager-button, .pager-current')) {
        const r = el.getBoundingClientRect();
        if (r.width && m.left < r.right && r.left < m.right && m.top < r.bottom && r.top < m.bottom) {
          problems.push(`☾ overlaps the pager's "${name(el)}"`);
        }
      }
    }
  }
  return problems;
}

let failures = 0;
for (const [width, height] of SIZES) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.route(url => !url.href.startsWith(origin), route => route.abort());
  for (const path of paths) {
    // Pinned to a night, so the sky (and the ☾, which appears once it has drawn) is the same every run.
    await page.goto(`${origin}${path}?sky-at=2026-10-27T01:00:00Z`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const problems = await page.evaluate(inspect, { touch: width < TOUCH_MAX_WIDTH, minTarget: MIN_TARGET });
    // Also at the bottom of the card, where the long pages keep their widest things.
    await page.evaluate(() => { const card = document.querySelector('.page-content'); if (card) card.scrollTop = card.scrollHeight; });
    await page.waitForTimeout(200);
    const atBottom = await page.evaluate(inspect, { touch: width < TOUCH_MAX_WIDTH, minTarget: MIN_TARGET });
    const all = [...new Set([...problems, ...atBottom])];
    for (const problem of all) console.log(`✗ ${path} at ${width}×${height}: ${problem}`);
    failures += all.length;
  }
  await page.close();
}

await browser.close();
server.close();
if (failures) {
  console.log(`\n${failures} layout problem${failures === 1 ? '' : 's'}.`);
  process.exit(1);
}
console.log(`✓ ${paths.length} pages × ${SIZES.length} sizes: no sideways scroll, one h1 each, tap targets ≥ ${MIN_TARGET}px, the ☾ clear of the pager.`);
