import { isVisitorPr, visitorPrProblems } from './visitor-pr';

const id = '2026-10-27-does-this-feature-work-3995b433';
const question = {
  title: `visitor: question ${id}`,
  headRef: `visitor/question/${id}`,
  files: [{ filename: `content/mailbag/${id}.md`, status: 'added' }],
};

describe('visitor PRs (the Visitor scope check)', () => {
  it('passes a PR in the visitor shape, for each kind', () => {
    expect(visitorPrProblems(question)).toEqual([]);
    const subtitle = `2026-10-27-trying-to-escape-the-permanent-a305f7ae`;
    expect(visitorPrProblems({
      title: `visitor: subtitle ${subtitle}`,
      headRef: `visitor/subtitle/${subtitle}`,
      files: [{ filename: `content/subtitles/${subtitle}.json`, status: 'added' }],
    })).toEqual([]);
    expect(visitorPrProblems({
      title: `visitor: star ${id}`,
      headRef: `visitor/star/${id}`,
      files: [{ filename: `content/stars/${id}.json`, status: 'added' }],
    })).toEqual([]);
  });

  it('leaves every other PR alone', () => {
    const ordinary = { title: 'feat(sky): free look', headRef: 'feat/free-look', files: [{ filename: '.github/workflows/ci.yml', status: 'modified' }] };
    expect(isVisitorPr(ordinary)).toBe(false);
    expect(visitorPrProblems(ordinary)).toEqual([]);
  });

  it('fails a visitor PR that changes anything besides its one file', () => {
    const problems = visitorPrProblems({
      ...question,
      files: [...question.files, { filename: 'src/index.html', status: 'modified' }, { filename: '.github/workflows/deploy.yml', status: 'modified' }],
    });
    expect(problems).toEqual([`it changes more than content/mailbag/${id}.md: src/index.html, .github/workflows/deploy.yml`]);
  });

  it('fails one that edits or removes an existing file instead of adding its own', () => {
    expect(visitorPrProblems({ ...question, files: [{ filename: `content/mailbag/${id}.md`, status: 'modified' }] }))
      .toEqual([`content/mailbag/${id}.md should be a new file (it's "modified")`]);
    expect(visitorPrProblems({ ...question, files: [] })).toEqual([`it doesn't add content/mailbag/${id}.md`]);
  });

  it('fails one whose file, folder or extension doesn\'t match its name', () => {
    expect(visitorPrProblems({ ...question, files: [{ filename: `content/subtitles/${id}.json`, status: 'added' }] })).toHaveLength(2);
  });

  it('counts a PR as a visitor\'s by its title alone, so a renamed branch can\'t dodge the check', () => {
    const disguised = { title: `visitor: question ${id}`, headRef: 'fix/typo', files: [{ filename: 'src/main.ts', status: 'modified' }] };
    expect(isVisitorPr(disguised)).toBe(true);
    expect(visitorPrProblems(disguised)[0]).toContain('isn\'t visitor/');
    expect(isVisitorPr({ title: '  Visitor: hi', headRef: 'x' })).toBe(true);
  });

  it('wants the exact title, and an id shaped like the backend\'s', () => {
    expect(visitorPrProblems({ ...question, title: 'visitor: something nice' })).toEqual([`the title should be exactly "visitor: question ${id}"`]);
    expect(visitorPrProblems({ ...question, headRef: 'visitor/question/../../etc' })[0]).toContain('isn\'t visitor/');
    expect(visitorPrProblems({ ...question, headRef: `visitor/toString/${id}` })[0]).toContain('isn\'t visitor/');
  });
});
