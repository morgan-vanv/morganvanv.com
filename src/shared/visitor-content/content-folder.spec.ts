import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ContentFile, ContentProblem, gatherContent, generatedModules, sameStar } from './visitor-content';
import { SUBTITLES } from '../constants/subtitles.const';
import { ProperNameFile } from '../sky/sky-naming';

/**
 * The guard on content/: a visitor PR (or a hand-made entry) that would publish something wrong fails
 * here, in the Test job, before it can be merged. The build itself only warns and leaves a bad file out
 * (scripts/build-visitor-content.mjs), so a deploy never breaks over content.
 */

/** Every file under content/, as the build script reads it. */
function readContent(dir: string): ContentFile[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const full = join(entry.parentPath, entry.name);
      return { path: relative(dir, full).split(sep).join('/'), text: readFileSync(full, 'utf8') };
    });
}

/** One line per problem, so the failure reads as a to-do list. */
const report = (problems: readonly ContentProblem[]) => problems.map(p => `content/${p.path}: ${p.message}`);

const files = readContent('content');
const { content, problems } = gatherContent(files);

describe('content/ (what visitors sent, approved by merging)', () => {
  it('every file passes its checks (a mailbag letter needs an answer under the marker)', () => {
    expect(report(problems)).toEqual([]);
  });

  it('has its README and keeps each folder in git', () => {
    const paths = files.map(f => f.path);
    for (const path of ['README.md', 'subtitles/.gitkeep', 'stars/.gitkeep', 'mailbag/.gitkeep']) expect(paths).toContain(path);
  });

  it('no guest subtitle repeats one of Morgan\'s', () => {
    const mine = SUBTITLES.map(line => line.toLowerCase());
    const repeats = content.subtitles.filter(s => mine.includes(s.text.toLowerCase())).map(s => s.text);
    expect(repeats).toEqual([]);
  });

  it('no visitor names a star that already has a proper name', () => {
    const proper: ProperNameFile = JSON.parse(readFileSync('public/data/sky/proper-names.json', 'utf8'));
    const clashes = content.stars
      .map(star => [star.name, proper.names.find(([ra, dec]) => sameStar(ra, dec, star.ra, star.dec))?.[2]] as const)
      .filter(([, properName]) => properName)
      .map(([name, properName]) => `${name} is ${properName}`);
    expect(clashes).toEqual([]);
  });

  it('the generated modules are up to date (npm run content rebuilds them)', () => {
    for (const [path, source] of Object.entries(generatedModules(content))) {
      expect(readFileSync(path, 'utf8'), path).toBe(source);
    }
  });
});
