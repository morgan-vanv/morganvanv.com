// Gathers content/ (the guest subtitles, star names and mailbag letters Morgan approved, one file each)
// into the gitignored modules the app imports: src/generated/guest-subtitles.ts, visitor-stars.ts and
// mailbag.ts. Runs before every build, test and dev server (the pre* hooks in package.json).
//
// It never fails the build over content: a file with a problem is left out and named in a warning, so a
// bad file can't block a deploy. The checks that stop such a file being merged are in
// src/shared/visitor-content/content-folder.spec.ts (the Test job), which hold content/ to the same
// rules strictly. Runs on Node 24, which strips the types from the .ts file it imports.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gatherContent, generatedModules, warningAnnotation } from '../src/shared/visitor-content/visitor-content.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = join(root, 'content');

/** Every file under content/, by its path relative to it (forward slashes). */
function readContent(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { recursive: true, withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    // A symlink or other special file is never read through; say so, rather than skip it quietly.
    if (!entry.isFile() && !entry.isDirectory()) {
      odd.push(relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'));
    }
  }
  return entries
    .filter(entry => entry.isFile())
    .map(entry => {
      const full = join(entry.parentPath, entry.name);
      return { path: relative(dir, full).split(sep).join('/'), text: readFileSync(full, 'utf8') };
    });
}

/** The sky's catalogue (committed JSON), so a star must be one the sky draws; skipped if it can't be read. */
function readCatalogue() {
  try {
    const json = file => JSON.parse(readFileSync(join(root, 'public/data/sky', file), 'utf8'));
    return {
      stars: json('stars.json').stars,
      properNames: json('proper-names.json').names,
      landmarks: json('names.json').names.map(row => row[2]),
    };
  } catch {
    console.warn('visitor content: public/data/sky/ unreadable, so stars are not checked against the catalogue');
    return undefined;
  }
}

const odd = [];
const { content, problems } = gatherContent(readContent(contentDir), readCatalogue());
problems.push(...odd.map(path => ({ path, message: 'not a plain file (a symlink?)' })));

for (const { path, message } of problems) {
  // In GitHub Actions, also as an annotation on the file.
  if (process.env.GITHUB_ACTIONS) console.log(warningAnnotation({ path, message }));
  console.warn(`content/${path}: ${message} (left out)`);
}

for (const [path, source] of Object.entries(generatedModules(content))) {
  const file = join(root, path);
  let current = null;
  try {
    current = readFileSync(file, 'utf8');
  } catch {
    // Not written yet.
  }
  // Only when it changed, so a running dev server doesn't rebuild for nothing.
  if (current !== source) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, source);
  }
}

const count = (n, noun) => `${n} ${noun}${n === 1 ? '' : 's'}`;
console.log(`visitor content: ${count(content.subtitles.length, 'subtitle')}, ${count(content.stars.length, 'star')}, `
  + `${count(content.mailbag.length, 'letter')}${problems.length ? `, ${count(problems.length, 'file')} left out` : ''}`);
