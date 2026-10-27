import { dropboxSubmission, oneLine, questionSubmission, subtitleSubmission, tsString } from './contact-submission';

describe('contact submissions', () => {
  const october = new Date(2026, 9, 27, 3, 0);

  it('labels a question and keeps its text whole', () => {
    expect(questionSubmission('  why the cat?\nreally?  ')).toEqual({
      question: '❓ Question\nwhy the cat?\nreally?',
      kind: 'question',
      text: 'why the cat?\nreally?',
    });
  });

  it('labels a dropbox note as a message', () => {
    const sent = dropboxSubmission(' the arrows confused me ');
    expect(sent.kind).toBe('message');
    expect(sent.question).toBe('📥 Anonymous dropbox\nthe arrows confused me');
    expect(sent['text']).toBe('the arrows confused me');
  });

  it('folds a subtitle onto one line and ends with the entry to paste in', () => {
    const sent = subtitleSubmission('  definitely   not\na robot ', ' sam ', october);
    expect(sent).toEqual({
      question: [
        '✨ Subtitle suggestion',
        '"definitely not a robot"',
        'credit: sam',
        'approve: { text: \'definitely not a robot\', by: \'sam\', added: \'2026-10\' },',
      ].join('\n'),
      kind: 'subtitle',
      subtitle: 'definitely not a robot',
      credit: 'sam',
    });
  });

  it('credits a blank name as anonymous, and null in the entry', () => {
    const sent = subtitleSubmission('a line', '   ', october);
    expect(sent['credit']).toBeNull();
    expect(sent.question).toContain('credit: anonymous');
    expect(sent.question).toContain('by: null, added: \'2026-10\'');
  });

  it('escapes quotes and backslashes so the entry is valid TypeScript', () => {
    expect(tsString('it\'s a \\ slash')).toBe('\'it\\\'s a \\\\ slash\'');
    expect(new Function(`return ${tsString('it\'s a \\ slash')}`)()).toBe('it\'s a \\ slash');
  });

  it('collapses whitespace', () => {
    expect(oneLine(' a \n\t b ')).toBe('a b');
  });

  it('drops invisible formatting and control characters', () => {
    expect(oneLine('night\u202Eowl\u200B\u0007 ok')).toBe('nightowl ok');
  });
});
