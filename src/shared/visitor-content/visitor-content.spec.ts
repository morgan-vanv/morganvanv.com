import {
  ANSWER_MARKER,
  ContentFile,
  GENERATED_MODULES,
  dayLabel,
  emptyAnswerMessage,
  gatherContent,
  generatedModules,
  idDate,
  parseLetter,
  parseStar,
  parseSubtitle,
  renderAnswer,
  safeHref,
} from './visitor-content';

const ID = '2026-10-27-a-certified-night-owl-3fa9c1b2';
const json = (data: unknown) => JSON.stringify(data, null, 2) + '\n';

/** A mailbag file exactly as morganvanv.com-backend's ask/publish writes it, plus an answer. */
function letterFile(question: string, answer = '', asked = '2026-10-27'): string {
  const quoted = question.split('\n').map(line => (line ? `> ${line}` : '>')).join('\n');
  return `---\nasked: ${asked}\n---\n${quoted}\n\n${ANSWER_MARKER}\n${answer}`;
}

describe('visitor content: ids', () => {
  it('reads YYYY-MM-DD-<slug>-<8 hex>, with a real date and a slug of at most 40', () => {
    expect(idDate(ID)).toBe('2026-10-27');
    expect(idDate('2026-10-27-question-00000000')).toBe('2026-10-27');
    for (const bad of [
      '2026-10-27-a-certified-night-owl',          // no hex
      '2026-10-27-a-certified-night-owl-3FA9C1B2', // upper-case hex
      '2026-10-27-a-certified-night-owl-3fa9c1b',  // seven hex
      '2026-02-30-feb-30-3fa9c1b2',                // not a date
      '2026-10-27-Night-Owl-3fa9c1b2',             // upper case
      '2026-10-27--night-3fa9c1b2',                // empty word
      `2026-10-27-${'a'.repeat(41)}-3fa9c1b2`,     // slug too long
      '26-10-27-night-3fa9c1b2',
    ]) {
      expect(idDate(bad), bad).toBeNull();
    }
    expect(idDate(`2026-10-27-${'a'.repeat(40)}-3fa9c1b2`)).toBe('2026-10-27');
  });
});

describe('visitor content: subtitles', () => {
  it('reads the backend\'s file', () => {
    expect(parseSubtitle(ID, json({ text: 'a certified night owl', by: 'sam', added: '2026-10' })))
      .toEqual({ text: 'a certified night owl', by: 'sam', added: '2026-10' });
    expect(parseSubtitle(ID, json({ text: 'a certified night owl', by: null, added: '2026-10' })))
      .toEqual({ text: 'a certified night owl', by: null, added: '2026-10' });
  });

  it('says what\'s wrong with a bad one', () => {
    const ok = { text: 'a certified night owl', by: 'sam', added: '2026-10' };
    const cases: [unknown, RegExp][] = [
      ['{ nope', /isn't valid JSON/],
      [[], /must be a JSON object/],
      [{ text: 'x', by: null }, /missing "added"/],
      [{ ...ok, extra: 1 }, /unknown field "extra"/],
      [{ ...ok, text: 'x'.repeat(61) }, /"text" is 61 characters; the limit is 60/],
      [{ ...ok, text: '' }, /"text" is empty/],
      [{ ...ok, text: 'two\nlines' }, /line breaks/],
      [{ ...ok, text: ' padded ' }, /stray spaces/],
      [{ ...ok, text: 'hidden‮text' }, /control characters/],
      [{ ...ok, text: 7 }, /"text" must be a string/],
      [{ ...ok, by: 'y'.repeat(25) }, /"by" is 25 characters; the limit is 24/],
      [{ ...ok, by: '' }, /"by" is empty \(use null for anonymous\)/],
      [{ ...ok, by: 3 }, /"by" must be a string or null/],
      [{ ...ok, added: 'October' }, /"added" must be "YYYY-MM"/],
      [{ ...ok, added: '2026-13' }, /"added" must be "YYYY-MM"/],
      [{ ...ok, added: '2026-09' }, /isn't the month in the file name/],
    ];
    for (const [data, message] of cases) {
      const text = typeof data === 'string' ? data : json(data);
      expect(parseSubtitle(ID, text), text).toMatch(message);
    }
    // Exactly at the limits is fine.
    expect(typeof parseSubtitle(ID, json({ ...ok, text: 'x'.repeat(60), by: 'y'.repeat(24) }))).toBe('object');
  });
});

describe('visitor content: stars', () => {
  const ok = { ra: 283.626, dec: 36.899, name: 'Gerald', by: 'sam', added: '2026-10', near: 'Vega' };

  it('reads the backend\'s file, with or without "near"', () => {
    expect(parseStar(ID, json(ok))).toEqual(ok);
    const withoutNear = { ra: ok.ra, dec: ok.dec, name: ok.name, by: ok.by, added: ok.added };
    expect(parseStar(ID, json(withoutNear))).toEqual({ ...withoutNear, near: null });
  });

  it('holds RA and Dec to the sky, and names and credits to the form\'s limits', () => {
    const cases: [object, RegExp][] = [
      [{ ...ok, ra: 360 }, /"ra" must be a number of degrees/],
      [{ ...ok, ra: -0.1 }, /"ra"/],
      [{ ...ok, ra: '283' }, /"ra"/],
      [{ ...ok, dec: 90.5 }, /"dec" must be a number of degrees/],
      [{ ...ok, dec: -91 }, /"dec"/],
      [{ ...ok, name: 'x'.repeat(25) }, /"name" is 25 characters; the limit is 24/],
      [{ ...ok, name: '' }, /"name" is empty/],
      [{ ...ok, by: 'y'.repeat(25) }, /"by" is 25 characters/],
      [{ ...ok, near: '' }, /"near" is empty/],
      [{ ...ok, near: 'n'.repeat(41) }, /"near" is 41 characters; the limit is 40/],
      [{ ...ok, near: null }, /"near" must be a string/],
      [{ ...ok, mag: 4.2 }, /unknown field "mag"/],
      [{ ...ok, added: '2026-11' }, /isn't the month in the file name/],
    ];
    for (const [data, message] of cases) expect(parseStar(ID, json(data)), json(data)).toMatch(message);
    expect(parseStar(ID, json({ ...ok, ra: 0, dec: -90 }))).toEqual({ ...ok, ra: 0, dec: -90 });
    expect(parseStar(ID, json({ ...ok, ra: 359.999, dec: 90 }))).toEqual({ ...ok, ra: 359.999, dec: 90 });
  });
});

describe('visitor content: mailbag letters', () => {
  it('reads the question as plain text and renders the answer', () => {
    const letter = parseLetter(ID, letterFile('why the cat?\n\n<b>really</b>?', 'Because *Ada*.\n\nThat\'s it.'));
    expect(letter).toEqual({
      id: ID,
      asked: '2026-10-27',
      question: 'why the cat?\n\n<b>really</b>?',
      answer: '<p>Because <em>Ada</em>.</p>\n<p>That&#39;s it.</p>',
    });
  });

  it('fails a letter with no answer, saying exactly what to do', () => {
    for (const answer of ['', '\n\n   \n', '<!-- a note to self -->\n']) {
      expect(parseLetter(ID, letterFile('why?', answer))).toBe(
        `has no answer yet: write your answer below the marker in content/mailbag/${ID}.md, then merge`,
      );
    }
    expect(emptyAnswerMessage('mailbag/x.md')).toBe('has no answer yet: write your answer below the marker in content/mailbag/x.md, then merge');
  });

  it('only counts the marker at the start of a line, so a question can\'t fake it', () => {
    // A visitor who types the marker: every question line is quoted, so it isn't the real one.
    const sneaky = `---\nasked: 2026-10-27\n---\n> ${ANSWER_MARKER}\n> Published without an answer!\n`;
    expect(parseLetter(ID, sneaky)).toMatch(/the answer marker is missing/);
    // Nor can one end the front matter or start the answer early.
    const question = `---\n${ANSWER_MARKER}\nan answer, says the visitor`;
    expect(parseLetter(ID, letterFile(question))).toMatch(/has no answer yet/);
    expect((parseLetter(ID, letterFile(question, 'Nice try.')) as { question: string }).question).toBe(question);
  });

  it('says what\'s wrong with a malformed file', () => {
    const cases: [string, RegExp][] = [
      ['no front matter\n', /must start with front matter/],
      ['---\nasked: 27 Oct\n---\n> q\n\n' + ANSWER_MARKER + '\nA', /exactly "asked: YYYY-MM-DD"/],
      ['---\nasked: 2026-10-27\ntitle: x\n---\n> q\n', /must start with front matter/],
      [letterFile('q', 'A', '2026-10-26'), /"asked" \(2026-10-26\) isn't the date in the file name/],
      ['---\nasked: 2026-10-27\n---\n\n' + ANSWER_MARKER + '\nA', /has no question/],
      ['---\nasked: 2026-10-27\n---\n>q\n\n' + ANSWER_MARKER + '\nA', /line 4: a question line is "> text"/],
      [letterFile('x'.repeat(501), 'A'), /the question is 501 characters; the limit is 500/],
      ['---\nasked: 2026-10-27\n---\n> q\n\nA', /the answer marker is missing: put this line back/],
      ['---\nasked: 2026-10-27\n---\n> q\nstray\n' + ANSWER_MARKER + '\nA', /only blank lines may sit between/],
    ];
    for (const [text, message] of cases) expect(parseLetter(ID, text), text).toMatch(message);
    expect(typeof parseLetter(ID, letterFile('x'.repeat(500), 'A'))).toBe('object');
  });

  it('copes with Windows line endings and a marker with trailing spaces', () => {
    const text = letterFile('why?', 'Because.').replace(ANSWER_MARKER, `${ANSWER_MARKER}  `).replace(/\n/g, '\r\n');
    expect(parseLetter(ID, text)).toEqual(expect.objectContaining({ question: 'why?', answer: '<p>Because.</p>' }));
  });

  it('labels the date the way the page shows it', () => {
    expect(dayLabel('2026-10-27')).toBe('Oct 27, 2026');
    expect(dayLabel('2027-01-03')).toBe('Jan 3, 2027');
  });
});

describe('visitor content: the answer\'s Markdown', () => {
  it('renders paragraphs, emphasis, code, lists and links', () => {
    expect(renderAnswer('One *two* **three** _four_ __five__ `six`.\nSame paragraph.\n\nNew one.')).toBe(
      '<p>One <em>two</em> <strong>three</strong> <em>four</em> <strong>five</strong> <code>six</code>.\nSame paragraph.</p>\n<p>New one.</p>',
    );
    expect(renderAnswer('- a\n- b *c*\n  more b')).toBe('<ul><li>a</li><li>b <em>c</em>\nmore b</li></ul>');
    expect(renderAnswer('1. first\n2. second')).toBe('<ol><li>first</li><li>second</li></ol>');
    expect(renderAnswer('```ts\nconst a = 1 < 2;\n```')).toBe('<pre><code>const a = 1 &lt; 2;</code></pre>');
    expect(renderAnswer('See [the sky](/home) or [my repo](https://github.com/morgan-vanv) or [mail](mailto:a@b.c).')).toBe(
      '<p>See <a href="/home">the sky</a> or <a href="https://github.com/morgan-vanv" target="_blank" rel="noopener">my repo</a>'
      + ' or <a href="mailto:a@b.c">mail</a>.</p>',
    );
  });

  it('links bare URLs, leaving trailing punctuation outside', () => {
    expect(renderAnswer('Try https://example.com/a?b=1&c=2.')).toBe(
      '<p>Try <a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener">https://example.com/a?b=1&amp;c=2</a>.</p>',
    );
  });

  it('leaves snake_case and lone asterisks alone, and never mis-nests tags', () => {
    expect(renderAnswer('my_var_name and 2 * 3 * 4')).toBe('<p>my_var_name and 2 * 3 * 4</p>');
    expect(renderAnswer('**a *b** c*')).toBe('<p><strong>a *b</strong> c*</p>');
    expect(renderAnswer('`*not em*` and [`code` link](/now)')).toBe('<p><code>*not em*</code> and <a href="/now"><code>code</code> link</a></p>');
  });

  describe('is safe', () => {
    const dangerous = [
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(1)">',
      '<a href="javascript:alert(1)">x</a>',
      '<iframe src="https://evil.example"></iframe>',
      '<style>body { display: none }</style>',
      '"><svg onload=alert(1)>',
    ];

    it('escapes raw HTML, so it shows as text (a URL inside it is just a link)', () => {
      for (const html of dangerous) {
        const out = renderAnswer(html);
        expect(out, html).not.toMatch(/<(?!\/?(p|em|strong|code|pre|ul|ol|li|a)[ >])/);
      }
      expect(renderAnswer('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
    });

    it('drops links that aren\'t http(s), mailto: or on this site, keeping their text', () => {
      for (const url of ['javascript:alert(1)', 'JavaScript:alert(1)', 'data:text/html,hi', 'vbscript:x', '//evil.example', 'file:///etc/passwd']) {
        expect(renderAnswer(`[click](${url})`), url).toBe('<p>click</p>');
      }
      // Whitespace never makes a link at all.
      expect(renderAnswer('[click](java\tscript:x)')).not.toContain('<a');
      expect(safeHref('javascript:alert(1)')).toBeNull();
      expect(safeHref('https://a.b/"onmouseover="x')).toBeNull();
      expect(renderAnswer('[x](https://a.b/"onmouseover="alert(1))')).not.toContain('onmouseover="');
    });

    it('only ever makes the allowed tags, with no attributes but href, target and rel', () => {
      const out = renderAnswer([
        '*a* **b** `c` [d](https://e.f) https://g.h', '', '- i', '', '1. j', '', '```', '<k>', '```',
        ...dangerous,
      ].join('\n'));
      const tags = out.match(/<[^>]+>/g)!;
      for (const tag of tags) {
        expect(tag).toMatch(/^<\/?(p|em|strong|code|pre|ul|ol|li)>$|^<a href="[^"]*"( target="_blank" rel="noopener")?>$|^<\/a>$/);
      }
    });

    it('drops HTML comments and control characters', () => {
      expect(renderAnswer('Hi<!-- hidden -->\u0000\u0007 there')).toBe('<p>Hi there</p>');
      // Removing one comment can't leave another behind; a stray "<!--" is just escaped text.
      expect(renderAnswer('a <!<!-- x -->-- hidden --> b')).toBe('<p>a  b</p>');
      expect(renderAnswer('a <!-- never closed')).toBe('<p>a &lt;!-- never closed</p>');
    });
  });
});

describe('visitor content: gathering the folder', () => {
  const subtitle = (text: string, added = '2026-10') => json({ text, by: null, added });
  const star = (name: string, ra = 283.626, dec = 36.899) => json({ ra, dec, name, by: null, added: '2026-10' });

  it('gathers every kind, subtitles and stars oldest first, letters newest first', () => {
    const files: ContentFile[] = [
      { path: 'README.md', text: '# notes' },
      { path: 'subtitles/.gitkeep', text: '' },
      { path: 'subtitles/2026-11-02-second-00000002.json', text: subtitle('second', '2026-11') },
      { path: 'subtitles/2026-10-27-first-00000001.json', text: subtitle('first') },
      { path: 'stars/2026-10-27-gerald-00000003.json', text: star('Gerald') },
      { path: 'mailbag/2026-10-01-old-00000004.md', text: letterFile('old?', 'Old.', '2026-10-01') },
      { path: 'mailbag/2026-10-27-new-00000005.md', text: letterFile('new?', 'New.') },
      { path: 'mailbag/.DS_Store', text: 'litter' },
    ];
    const { content, problems } = gatherContent(files);
    expect(problems).toEqual([]);
    expect(content.subtitles.map(s => s.text)).toEqual(['first', 'second']);
    expect(content.stars).toEqual([{ ra: 283.626, dec: 36.899, name: 'Gerald', by: null, added: '2026-10', near: null }]);
    expect(content.mailbag.map(l => l.question)).toEqual(['new?', 'old?']);
  });

  it('leaves out each bad file with a problem naming it, and keeps the rest', () => {
    const files: ContentFile[] = [
      { path: 'notes.txt', text: '' },
      { path: 'guestbook/2026-10-27-hi-00000001.json', text: '{}' },
      { path: 'subtitles/nested/2026-10-27-a-00000001.json', text: subtitle('a') },
      { path: 'subtitles/2026-10-27-a-00000001.md', text: subtitle('a') },
      { path: 'subtitles/night-owl.json', text: subtitle('a') },
      { path: 'subtitles/2026-10-27-a-00000001.json', text: subtitle('a') },
      { path: 'subtitles/2026-10-27-a-again-00000002.json', text: subtitle('A') },
      { path: 'stars/2026-10-27-b-00000003.json', text: star('B') },
      { path: 'stars/2026-10-27-b-twin-00000004.json', text: star('B twin', 283.63, 36.9) },
      { path: 'mailbag/2026-10-27-q-00000005.md', text: letterFile('unanswered?') },
      { path: 'mailbag/2026-10-27-q-00000006.json', text: '{}' },
    ];
    const { content, problems } = gatherContent(files);
    expect(problems.map(p => p.path)).toEqual([
      'guestbook/2026-10-27-hi-00000001.json',
      'mailbag/2026-10-27-q-00000005.md',
      'mailbag/2026-10-27-q-00000006.json',
      'notes.txt',
      'stars/2026-10-27-b-twin-00000004.json',
      'subtitles/2026-10-27-a-00000001.md',
      'subtitles/2026-10-27-a-again-00000002.json',
      'subtitles/nested/2026-10-27-a-00000001.json',
      'subtitles/night-owl.json',
    ]);
    const message = (path: string) => problems.find(p => p.path === path)!.message;
    expect(message('notes.txt')).toMatch(/isn't an entry: content\/ only holds README.md and the folders subtitles, stars, mailbag/);
    expect(message('guestbook/2026-10-27-hi-00000001.json')).toMatch(/isn't an entry/);
    expect(message('subtitles/2026-10-27-a-00000001.md')).toMatch(/only holds <id>.json files/);
    expect(message('subtitles/night-owl.json')).toMatch(/the file name must be YYYY-MM-DD-<slug>-<8 hex>/);
    expect(message('subtitles/2026-10-27-a-again-00000002.json')).toMatch(/repeats a subtitle/);
    expect(message('stars/2026-10-27-b-twin-00000004.json')).toMatch(/already named \("B"/);
    expect(message('mailbag/2026-10-27-q-00000005.md')).toBe(
      'has no answer yet: write your answer below the marker in content/mailbag/2026-10-27-q-00000005.md, then merge',
    );
    expect(content.subtitles.map(s => s.text)).toEqual(['a']);
    expect(content.stars.map(s => s.name)).toEqual(['B']);
    expect(content.mailbag).toEqual([]);
  });

  it('writes one typed module per kind', () => {
    const { content } = gatherContent([{ path: 'subtitles/2026-10-27-first-00000001.json', text: subtitle('it\'s "first"') }]);
    const modules = generatedModules(content);
    expect(Object.keys(modules)).toEqual([GENERATED_MODULES.subtitles.path, GENERATED_MODULES.stars.path, GENERATED_MODULES.mailbag.path]);
    const source = modules['src/generated/guest-subtitles.ts'];
    expect(source).toContain('import type { GuestSubtitle } from \'../shared/visitor-content/visitor-content\';');
    expect(source).toContain('export const GUEST_SUBTITLES: readonly GuestSubtitle[] = [');
    expect(source).toContain('"text": "it\'s \\"first\\""');
    expect(modules['src/generated/mailbag.ts']).toContain('export const MAILBAG: readonly MailbagLetter[] = [];');
  });
});
