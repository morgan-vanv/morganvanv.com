import { ContactSubmission, dropboxSubmission, oneLine, questionSubmission, subtitleSubmission } from './contact-submission';

/**
 * morganvanv.com-backend #4's `matchesMessage` (ask/submit/embed.js), which only offers a "Publish as PR"
 * link when the message says what the fields say. Copied here so a change to the message can't quietly
 * cost Morgan his links.
 */
function backendMatches(args: ContactSubmission): boolean {
  const message = args.question.trim();
  const lines = message.split('\n');
  const rest = lines.slice(3).every(line => line.startsWith('approve: '));
  const credit = args['credit'] === null || args['credit'] === undefined ? 'anonymous' : args['credit'];
  if (args.kind === 'question') return message === `❓ Question\n${args['text']}`.trim();
  return rest && lines[0] === '✨ Subtitle suggestion' && lines[1] === `"${args['subtitle']}"` && lines[2] === `credit: ${credit}`;
}

describe('contact submissions', () => {
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

  it('folds a subtitle onto one line: the title, the line in quotes, the credit', () => {
    const sent = subtitleSubmission('  definitely   not\na robot ', ' sam ');
    expect(sent).toEqual({
      question: [
        '✨ Subtitle suggestion',
        '"definitely not a robot"',
        'credit: sam',
      ].join('\n'),
      kind: 'subtitle',
      subtitle: 'definitely not a robot',
      credit: 'sam',
    });
  });

  it('credits a blank name as anonymous, and sends null', () => {
    const sent = subtitleSubmission('a line', '   ');
    expect(sent['credit']).toBeNull();
    expect(sent.question).toBe('✨ Subtitle suggestion\n"a line"\ncredit: anonymous');
  });

  it('no longer carries an approve: line (content/ files replaced pasting)', () => {
    expect(subtitleSubmission('a line', 'sam').question).not.toContain('approve:');
  });

  it('matches the backend\'s check, so a question or subtitle gets its Publish as PR link', () => {
    for (const sent of [
      questionSubmission('  why the cat?\nreally?  '),
      subtitleSubmission('a "quoted" line', ''),
      subtitleSubmission(' it\'s me ', 'sam'),
    ]) {
      expect(backendMatches(sent)).toBe(true);
    }
  });

  it('collapses whitespace', () => {
    expect(oneLine(' a \n\t b ')).toBe('a b');
  });

  it('drops invisible formatting and control characters', () => {
    expect(oneLine('night\u202Eowl\u200B\u0007 ok')).toBe('nightowl ok');
  });
});
