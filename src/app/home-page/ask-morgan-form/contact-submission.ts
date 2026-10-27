import { oneLine } from '../../../shared/visitor-content/visitor-content';

/**
 * What the Contact form sends to the Ask Morgan function, which forwards it to Morgan's Discord.
 *
 * `question` is always a complete, human-readable message: the deployed function only reads
 * `question` (and the honeypot), so it must stand on its own. The other fields describe the same
 * thing in structured form for a function that knows about kinds.
 */
export type ContactKind = 'question' | 'subtitle' | 'message';

export interface ContactSubmission {
  readonly question: string;
  readonly kind: ContactKind;
  readonly [field: string]: unknown;
}

/**
 * One clean line: invisible formatting and control characters dropped, runs of whitespace folded to one
 * space. The same cleaning the backend and the content checks use, so what Discord shows is what publishes.
 */
export { oneLine };

export function questionSubmission(text: string): ContactSubmission {
  const body = text.trim();
  return { question: `❓ Question\n${body}`, kind: 'question', text: body };
}

export function dropboxSubmission(text: string): ContactSubmission {
  const body = text.trim();
  return { question: `📥 Anonymous dropbox\n${body}`, kind: 'message', text: body };
}

/**
 * A suggested greeting subtitle. The message is exactly what morganvanv.com-backend's `ask/submit` checks
 * the structured fields against before it offers a "Publish as PR" link (its `matchesMessage`): the
 * title, the line in quotes, the credit, and nothing else.
 */
export function subtitleSubmission(line: string, credit: string): ContactSubmission {
  const subtitle = oneLine(line);
  const by = oneLine(credit) || null;
  return {
    question: [
      '✨ Subtitle suggestion',
      `"${subtitle}"`,
      `credit: ${by ?? 'anonymous'}`,
    ].join('\n'),
    kind: 'subtitle',
    subtitle,
    credit: by,
  };
}
