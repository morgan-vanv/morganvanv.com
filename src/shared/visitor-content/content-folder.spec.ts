import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ContentFile, ContentProblem, SkyCatalogue, gatherContent } from './visitor-content';
import { SUBTITLES } from '../constants/subtitles.const';

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

/** Anything under content/ that isn't a plain file or folder (a symlink, say): readContent never reads it. */
const notPlain = existsSync('content')
  ? readdirSync('content', { recursive: true, withFileTypes: true })
    .filter(entry => !entry.isFile() && !entry.isDirectory())
    .map(entry => relative('content', join(entry.parentPath, entry.name)).split(sep).join('/'))
  : [];
const sky = (file: string) => JSON.parse(readFileSync(`public/data/sky/${file}`, 'utf8'));
/** The sky's own catalogue: a visitor star must be a star it draws, with no proper name, near one it labels. */
const catalogue: SkyCatalogue = {
  stars: sky('stars.json').stars,
  properNames: sky('proper-names.json').names,
  landmarks: (sky('names.json').names as [number, number, string][]).map(row => row[2]),
};
const { content, problems } = gatherContent(files, catalogue);

describe('content/ (what visitors sent, approved by merging)', () => {
  it('every file passes its checks (a mailbag letter needs an answer, a star must be in the sky\'s catalogue)', () => {
    expect(catalogue.stars.length).toBeGreaterThan(900);
    expect(catalogue.properNames.length).toBeGreaterThan(300);
    expect(catalogue.landmarks).toContain('Vega');
    expect(report(problems)).toEqual([]);
  });

  it('holds only plain files (no symlinks)', () => {
    expect(notPlain).toEqual([]);
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
});
