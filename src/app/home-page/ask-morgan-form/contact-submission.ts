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

/** Trims and folds runs of whitespace (newlines included) into single spaces. */
export function oneLine(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function questionSubmission(text: string): ContactSubmission {
  const body = text.trim();
  return { question: `❓ Question\n${body}`, kind: 'question', text: body };
}

export function dropboxSubmission(text: string): ContactSubmission {
  const body = text.trim();
  return { question: `📥 Anonymous dropbox\n${body}`, kind: 'message', text: body };
}

/**
 * A suggested greeting subtitle. The message ends with the exact entry to paste into
 * `GUEST_SUBTITLES` (src/shared/constants/subtitles.const.ts) to approve it.
 */
export function subtitleSubmission(line: string, credit: string, now: Date): ContactSubmission {
  const subtitle = oneLine(line);
  const by = oneLine(credit) || null;
  const added = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const entry = `{ text: ${tsString(subtitle)}, by: ${by === null ? 'null' : tsString(by)}, added: '${added}' },`;
  return {
    question: [
      '✨ Subtitle suggestion',
      `"${subtitle}"`,
      `credit: ${by ?? 'anonymous'}`,
      `approve: ${entry}`,
    ].join('\n'),
    kind: 'subtitle',
    subtitle,
    credit: by,
  };
}

/** A single-quoted TypeScript string literal for `text`. */
export function tsString(text: string): string {
  return `'${text.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`;
}
