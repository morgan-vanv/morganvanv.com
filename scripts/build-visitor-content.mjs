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
import { gatherContent, generatedModules } from '../src/shared/visitor-content/visitor-content.ts';

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
  return entries
    .filter(entry => entry.isFile())
    .map(entry => {
      const full = join(entry.parentPath, entry.name);
      return { path: relative(dir, full).split(sep).join('/'), text: readFileSync(full, 'utf8') };
    });
}

const { content, problems } = gatherContent(readContent(contentDir));

for (const { path, message } of problems) {
  // In GitHub Actions, also as an annotation on the file.
  if (process.env.GITHUB_ACTIONS) console.log(`::warning file=content/${path}::${message}`);
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
