// Writes dist/browser/letterboxd.json: Morgan's Letterboxd diary (his 50 most recent entries) for the
// Favorite Media section on /interests and the Watched row on /now.
//
// Letterboxd's feed is CORS-blocked and its API isn't open to personal sites, so the deploy reads the
// public RSS feed (never the HTML) and the site reads same-origin JSON. The deploy also runs daily on a
// schedule, so this stays about a day fresh.
//
// If the feed can't be read (or holds no diary entries), it keeps the live site's copy, so a blip doesn't
// blank the section, unless that copy is over two weeks old; failing that, it leaves the committed
// placeholder (public/letterboxd.json) and the section hides.
// Never fails. Runs on Node 24, which strips the types from the .ts files it imports.
import { writeFileSync } from 'node:fs';
import { SITE_CONFIG } from '../src/shared/config/site.config.ts';
import { parseLetterboxdRss, toDiary } from '../src/shared/letterboxd/letterboxd.ts';

const out = process.argv[2] ?? 'dist/browser/letterboxd.json';
const profileUrl = `https://letterboxd.com/${SITE_CONFIG.handles.letterboxd}/`;
const liveCopyUrl = `${SITE_CONFIG.url}/letterboxd.json`;
const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const headers = { 'User-Agent': `${SITE_CONFIG.domain} deploy (+${SITE_CONFIG.url})` };

async function get(url, accept) {
  const response = await fetch(url, { headers: { ...headers, Accept: accept }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response;
}

async function fromFeed() {
  const xml = await (await get(`${profileUrl}rss/`, 'application/rss+xml')).text();
  if (!/<rss\b/.test(xml)) throw new Error('the feed is not RSS');
  const diary = parseLetterboxdRss(xml, profileUrl, new Date().toISOString());
  // A feed with no diary entries is more likely a format change than an empty diary: keep the last good copy.
  if (!diary.entries.length) throw new Error('the feed has no diary entries');
  return diary;
}

async function fromLiveSite() {
  const diary = toDiary(await (await get(liveCopyUrl, 'application/json')).json());
  if (!diary) throw new Error('the live copy is the placeholder or malformed');
  // Past a fortnight, "updates daily" would be a lie: let the section hide until the feed is back.
  if (Date.now() - Date.parse(diary.fetchedAt) > STALE_AFTER_MS) throw new Error(`the live copy is from ${diary.fetchedAt}`);
  return diary;
}

let diary;
try {
  diary = await fromFeed();
} catch (error) {
  console.warn(`write-letterboxd: no feed (${error.message}); trying the live site's copy`);
  try {
    diary = await fromLiveSite();
  } catch (fallbackError) {
    console.warn(`write-letterboxd: no live copy either (${fallbackError.message}); leaving the placeholder`);
  }
}

if (diary) {
  writeFileSync(out, `${JSON.stringify(diary)}\n`);
  console.log(`write-letterboxd: ${diary.entries.length} entries, read ${diary.fetchedAt} → ${out}`);
}
