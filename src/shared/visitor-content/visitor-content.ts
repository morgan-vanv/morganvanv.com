/**
 * Visitor content: the guest subtitles, star names and mailbag letters Morgan approved, one file each in
 * `content/` (morganvanv.com-backend's "Publish as PR" opens a PR that adds one; merging it publishes it).
 *
 * This file reads, checks and gathers those files, renders an answer's Markdown to HTML, and writes the
 * generated modules the app imports. `scripts/build-visitor-content.mjs` runs it before every build, test
 * and dev server, and `content-folder.spec.ts` holds the real folder to it strictly. No imports, and only
 * erasable TypeScript, so Node runs it without a build step.
 *
 *   content/subtitles/<id>.json  { "text", "by": string | null, "added": "YYYY-MM" }
 *   content/stars/<id>.json      { "ra", "dec", "name", "by", "added", "near"? }
 *   content/mailbag/<id>.md      front matter (asked: YYYY-MM-DD), the question quoted, the marker, the answer
 *   <id> = YYYY-MM-DD-<slug>-<8 hex>
 */

/** The form's limits (the backend holds submissions to the same ones). */
export const SUBTITLE_MAX_LENGTH = 60;
export const CREDIT_MAX_LENGTH = 24;
export const STAR_NAME_MAX_LENGTH = 24;
export const QUESTION_MAX_LENGTH = 500;
/** "Near" is a bright star's name; the backend drops one longer than this. */
export const NEAR_MAX_LENGTH = 40;
const SLUG_MAX_LENGTH = 40;

/** The line Morgan writes his answer under. Exactly the backend's `ANSWER_MARKER` (ask/publish/entry.js). */
export const ANSWER_MARKER =
  '<!-- Write your answer below this line, then merge. Leave it empty and the site\'s checks will fail. -->';

export const CONTENT_FOLDERS = ['subtitles', 'stars', 'mailbag'] as const;
export type ContentFolder = (typeof CONTENT_FOLDERS)[number];

/** Files that may sit in content/ besides entries: the format notes, and what keeps an empty folder in git. */
const ALLOWED_EXTRAS = ['README.md', ...CONTENT_FOLDERS.map(folder => `${folder}/.gitkeep`)];
/** Files an OS drops on its own (both are gitignored, so they only ever exist locally). */
const OS_LITTER = ['.DS_Store', 'Thumbs.db'];

const ID_PATTERN = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)-[0-9a-f]{8}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** A line under Morgan's name on the greeting. */
export interface GuestSubtitle {
  readonly text: string;
  /** How they asked to be credited; null for anonymous ("a stranger"). */
  readonly by: string | null;
  /** YYYY-MM */
  readonly added: string;
}

/** A star a visitor named. */
export interface VisitorStar {
  /** J2000 degrees. */
  readonly ra: number;
  readonly dec: number;
  readonly name: string;
  readonly by: string | null;
  /** YYYY-MM */
  readonly added: string;
  /** The bright named star it's near, as the naming panel said; null to let the sky work it out. */
  readonly near: string | null;
}

/** A question a visitor asked and Morgan answered. */
export interface MailbagLetter {
  readonly id: string;
  /** YYYY-MM-DD */
  readonly asked: string;
  /** The visitor's exact words, plain text (line breaks kept). Never render it as HTML. */
  readonly question: string;
  /** Morgan's answer, rendered from Markdown to a small, safe subset of HTML (see renderAnswer). */
  readonly answer: string;
}

export interface VisitorContent {
  /** Oldest first, so they join the greeting's rotation in the order they were added. */
  readonly subtitles: readonly GuestSubtitle[];
  readonly stars: readonly VisitorStar[];
  /** Newest first. */
  readonly mailbag: readonly MailbagLetter[];
}

/** One file under content/: its path relative to that folder ("mailbag/<id>.md") and its text. */
export interface ContentFile {
  readonly path: string;
  readonly text: string;
}

export interface ContentProblem {
  /** Relative to content/. */
  readonly path: string;
  readonly message: string;
}

export interface GatheredContent {
  /** Every valid entry; a file with a problem is left out. */
  readonly content: VisitorContent;
  readonly problems: readonly ContentProblem[];
}

/** One clean line, as the backend cleans it: no invisible or control characters, whitespace folded. */
export function oneLine(text: string): string {
  return text.replace(/[\p{Cf}]/gu, '').replace(/[^\P{Cc}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

function isRealDay(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

/** The date in an id ("2026-10-27"), or null when the id isn't `YYYY-MM-DD-<slug>-<8 hex>`. */
export function idDate(id: string): string | null {
  const match = ID_PATTERN.exec(id);
  if (!match || match[2].length > SLUG_MAX_LENGTH || !isRealDay(match[1])) return null;
  return match[1];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Problems with a one-line text field: present, clean, not too long. */
function textProblem(label: string, value: unknown, max: number, optional = false): string | null {
  if (value === null && optional) return null;
  if (typeof value !== 'string') return `"${label}" must be a string${optional ? ' or null' : ''}`;
  if (!value) return `"${label}" is empty${optional ? ' (use null for anonymous)' : ''}`;
  if (value !== oneLine(value)) return `"${label}" has line breaks, control characters or stray spaces`;
  if (value.length > max) return `"${label}" is ${value.length} characters; the limit is ${max}`;
  return null;
}

function keysProblem(data: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): string | null {
  const missing = required.filter(key => !(key in data));
  if (missing.length) return `missing ${missing.map(key => `"${key}"`).join(', ')}`;
  const unknown = Object.keys(data).filter(key => !required.includes(key) && !optional.includes(key));
  return unknown.length ? `unknown field${unknown.length > 1 ? 's' : ''} ${unknown.map(key => `"${key}"`).join(', ')}` : null;
}

function addedProblem(added: unknown, id: string): string | null {
  if (typeof added !== 'string' || !MONTH_PATTERN.test(added)) return '"added" must be "YYYY-MM"';
  if (added !== id.slice(0, 7)) return `"added" (${added}) isn't the month in the file name (${id.slice(0, 7)})`;
  return null;
}

function parseJson(text: string): { value: unknown } | { error: string } {
  try {
    return { value: JSON.parse(text) };
  } catch (error) {
    return { error: `isn't valid JSON (${(error as Error).message})` };
  }
}

/** A guest subtitle file's entry, or the reason it isn't one. */
export function parseSubtitle(id: string, text: string): GuestSubtitle | string {
  const parsed = parseJson(text);
  if ('error' in parsed) return parsed.error;
  const data = parsed.value;
  if (!isObject(data)) return 'must be a JSON object';
  const problem = keysProblem(data, ['text', 'by', 'added'])
    ?? textProblem('text', data['text'], SUBTITLE_MAX_LENGTH)
    ?? textProblem('by', data['by'], CREDIT_MAX_LENGTH, true)
    ?? addedProblem(data['added'], id);
  if (problem) return problem;
  return { text: data['text'] as string, by: data['by'] as string | null, added: data['added'] as string };
}

/** A star name file's entry, or the reason it isn't one. */
export function parseStar(id: string, text: string): VisitorStar | string {
  const parsed = parseJson(text);
  if ('error' in parsed) return parsed.error;
  const data = parsed.value;
  if (!isObject(data)) return 'must be a JSON object';
  const { ra, dec } = data;
  const problem = keysProblem(data, ['ra', 'dec', 'name', 'by', 'added'], ['near'])
    ?? (typeof ra === 'number' && Number.isFinite(ra) && ra >= 0 && ra < 360 ? null : '"ra" must be a number of degrees, 0 ≤ ra < 360')
    ?? (typeof dec === 'number' && Number.isFinite(dec) && dec >= -90 && dec <= 90 ? null : '"dec" must be a number of degrees, −90 ≤ dec ≤ 90')
    ?? textProblem('name', data['name'], STAR_NAME_MAX_LENGTH)
    ?? textProblem('by', data['by'], CREDIT_MAX_LENGTH, true)
    ?? ('near' in data ? textProblem('near', data['near'], NEAR_MAX_LENGTH) : null)
    ?? addedProblem(data['added'], id);
  if (problem) return problem;
  return {
    ra: ra as number,
    dec: dec as number,
    name: data['name'] as string,
    by: data['by'] as string | null,
    added: data['added'] as string,
    near: (data['near'] as string | undefined) ?? null,
  };
}

/** What Morgan should do about a mailbag file that has no answer yet. */
export function emptyAnswerMessage(path: string): string {
  return `has no answer yet: write your answer below the marker in content/${path}, then merge`;
}

/**
 * A mailbag letter, or the reason it isn't one. The file is the backend's:
 *
 *   ---
 *   asked: 2026-10-27
 *   ---
 *   > every line of the question, quoted ("> text", or ">" for a blank line)
 *
 *   <the answer marker>
 *   Morgan's answer, in Markdown
 *
 * The marker only counts at the start of a line, and every question line starts with ">", so nothing a
 * visitor wrote can pass for it (or for the front matter's end).
 */
export function parseLetter(id: string, text: string, path = `mailbag/${id}.md`): MailbagLetter | string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines[0] !== '---' || lines[2] !== '---') return 'must start with front matter: "---", "asked: YYYY-MM-DD", "---"';
  const asked = /^asked: (\d{4}-\d{2}-\d{2})$/.exec(lines[1])?.[1];
  if (!asked || !isRealDay(asked)) return 'the front matter must be exactly "asked: YYYY-MM-DD"';
  if (asked !== id.slice(0, 10)) return `"asked" (${asked}) isn't the date in the file name (${id.slice(0, 10)})`;

  let i = 3;
  const question: string[] = [];
  for (; i < lines.length && lines[i].startsWith('>'); i++) {
    const line = lines[i];
    if (line !== '>' && !line.startsWith('> ')) return `line ${i + 1}: a question line is "> text" or a lone ">"`;
    question.push(line.slice(2));
  }
  const asText = question.join('\n').trim();
  if (!asText) return 'has no question: quote it under the front matter, every line starting with "> "';
  if (asText.length > QUESTION_MAX_LENGTH) return `the question is ${asText.length} characters; the limit is ${QUESTION_MAX_LENGTH}`;

  for (; i < lines.length && !lines[i].trim(); i++);
  if (lines[i]?.trimEnd() !== ANSWER_MARKER) {
    return lines.slice(i).some(line => line.trimEnd() === ANSWER_MARKER)
      ? `line ${i + 1}: only blank lines may sit between the question and the answer marker`
      : `the answer marker is missing: put this line back between the question and the answer: ${ANSWER_MARKER}`;
  }
  const answerMarkdown = stripComments(lines.slice(i + 1).join('\n')).trim();
  if (!answerMarkdown) return emptyAnswerMessage(path);
  return { id, asked, question: asText, answer: renderAnswer(answerMarkdown) };
}

/** HTML comments are notes to self in Markdown: they never show. */
function stripComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, '');
}

/** The entries in content/ that pass every check, and a problem for each file that doesn't. */
export function gatherContent(files: readonly ContentFile[]): GatheredContent {
  const problems: ContentProblem[] = [];
  const subtitles: (GuestSubtitle & { id: string })[] = [];
  const stars: (VisitorStar & { id: string })[] = [];
  const mailbag: MailbagLetter[] = [];
  const problem = (path: string, message: string) => problems.push({ path, message });

  for (const { path, text } of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const name = path.split('/').pop()!;
    if (ALLOWED_EXTRAS.includes(path) || OS_LITTER.includes(name)) continue;
    const parts = path.split('/');
    const folder = parts[0] as ContentFolder;
    if (parts.length !== 2 || !CONTENT_FOLDERS.includes(folder)) {
      problem(path, `isn't an entry: content/ only holds README.md and the folders ${CONTENT_FOLDERS.join(', ')}`);
      continue;
    }
    const extension = folder === 'mailbag' ? '.md' : '.json';
    if (!name.endsWith(extension)) {
      problem(path, `isn't an entry: ${folder}/ only holds <id>${extension} files (and .gitkeep)`);
      continue;
    }
    const id = name.slice(0, -extension.length);
    if (!idDate(id)) {
      problem(path, 'the file name must be YYYY-MM-DD-<slug>-<8 hex>, a real date, a slug of a-z, 0-9 and hyphens (at most 40)');
      continue;
    }

    if (folder === 'subtitles') {
      const entry = parseSubtitle(id, text);
      if (typeof entry === 'string') problem(path, entry);
      else if (subtitles.some(other => other.text.toLowerCase() === entry.text.toLowerCase())) {
        problem(path, `repeats a subtitle already in subtitles/ ("${entry.text}")`);
      } else subtitles.push({ id, ...entry });
    } else if (folder === 'stars') {
      const entry = parseStar(id, text);
      if (typeof entry === 'string') problem(path, entry);
      else {
        const twin = stars.find(other => sameStar(other.ra, other.dec, entry.ra, entry.dec));
        if (twin) problem(path, `names a star that's already named ("${twin.name}", stars/${twin.id}.json)`);
        else stars.push({ id, ...entry });
      }
    } else {
      const letter = parseLetter(id, text, path);
      if (typeof letter === 'string') problem(path, letter);
      else mailbag.push(letter);
    }
  }

  return {
    content: {
      subtitles: subtitles.sort(byId).map(({ text, by, added }) => ({ text, by, added })),
      stars: stars.sort(byId).map(({ ra, dec, name, by, added, near }) => ({ ra, dec, name, by, added, near })),
      mailbag: mailbag.sort((a, b) => byId(b, a)),
    },
    problems,
  };
}

/** Ids start with their date, so sorting by id is sorting by date (ties: by slug, then hex; stable). */
function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The same star: within 0.01° in RA (wrapping at 360) and Dec, as sky-naming.ts's `sameStar`. */
export function sameStar(ra1: number, dec1: number, ra2: number, dec2: number): boolean {
  const dRa = Math.abs(((ra1 - ra2 + 540) % 360) - 180);
  return dRa <= 0.01 && Math.abs(dec1 - dec2) <= 0.01;
}

// --- The answer's Markdown ---------------------------------------------------------------------------

/**
 * Morgan's answer as HTML, from a deliberately small Markdown subset: paragraphs, *emphasis*,
 * **strong**, `code`, fenced code blocks, - and 1. lists, [links](https://…) and bare https:// URLs.
 * Everything else (headings, raw HTML, images, quotes) shows as the text it is. All text is escaped
 * before any tag is made, and the only tags made are p, em, strong, code, pre, ul, ol, li and a. A
 * link must be http(s), mailto: or a path on this site; anything else (javascript:, data:, …) is
 * left as plain text. External links open in a new tab with rel="noopener".
 */
export function renderAnswer(markdown: string): string {
  const lines = stripComments(markdown).replace(/\r\n?/g, '\n').replace(/[^\P{Cc}\n\t]/gu, '').split('\n');
  const blocks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].trimStart().startsWith(fence[1]); i++) code.push(lines[i]);
      i++;
      blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    const block: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^ {0,3}(`{3,}|~{3,})/.test(lines[i]); i++) block.push(lines[i]);
    blocks.push(renderBlock(block));
  }
  return blocks.join('\n');
}

const BULLET = /^ {0,3}[-*+] +/;
const NUMBER = /^ {0,3}\d{1,9}[.)] +/;

function renderBlock(lines: readonly string[]): string {
  const marker = BULLET.test(lines[0]) ? BULLET : NUMBER.test(lines[0]) ? NUMBER : null;
  if (!marker) return `<p>${renderInline(lines.map(line => line.trim()).join('\n'))}</p>`;
  const items: string[][] = [];
  for (const line of lines) {
    if (marker.test(line)) items.push([line.replace(marker, '')]);
    else items[items.length - 1].push(line.trim());
  }
  const tag = marker === BULLET ? 'ul' : 'ol';
  return `<${tag}>${items.map(item => `<li>${renderInline(item.join('\n').trim())}</li>`).join('')}</${tag}>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** A link target that's safe to put in href, or null. Checked on the raw text, before escaping. */
export function safeHref(url: string): string | null {
  if (/[\s<>"'`\\]/.test(url)) return null;
  if (/^https?:\/\/[^/]/i.test(url) || /^mailto:[^/]/i.test(url) || /^\/(?!\/)/.test(url)) return url;
  return null;
}

function linkHtml(href: string, inner: string): string {
  const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
  return `<a href="${escapeHtml(href)}"${external}>${inner}</a>`;
}

/**
 * Inline Markdown on one block's text. Code spans and links are swapped for placeholders first (so
 * nothing inside them is touched again), the rest is escaped, emphasis is applied to text with no tag
 * inside it (so every tag closes where it opens), then the placeholders go back.
 */
function renderInline(text: string): string {
  const held: string[] = [];
  // Private-use characters mark the placeholders (any in the text itself are dropped first).
  const hold = (html: string) => `\uE000${held.push(html) - 1}\uE001`;

  let out = text.replace(/[\uE000\uE001]/g, '');
  out = out.replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, _ticks: string, code: string) => {
    const inner = /^ [\s\S]* $/.test(code) && code.trim() ? code.slice(1, -1) : code;
    return hold(`<code>${escapeHtml(inner)}</code>`);
  });
  out = out.replace(/\[([^\]\n]+)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g, (whole, label: string, url: string) => {
    const href = safeHref(url);
    return href ? hold(linkHtml(href, emphasis(escapeHtml(label)))) : label;
  });
  out = out.replace(/\bhttps?:\/\/[^\s<>"'`\uE000]+/gi, url => {
    const trimmed = url.replace(/[.,;:!?)\]*_]+$/, '');
    const href = safeHref(trimmed);
    return href ? hold(linkHtml(href, escapeHtml(trimmed))) + url.slice(trimmed.length) : url;
  });
  out = emphasis(escapeHtml(out));
  // Restore innermost-first: a link's label can hold a code span's placeholder.
  while (/\uE000\d+\uE001/.test(out)) out = out.replace(/\uE000(\d+)\uE001/g, (_, n: string) => held[Number(n)]);
  return out;
}

function emphasis(text: string): string {
  return text
    .replace(/\*\*(?=\S)([^<]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([^<]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=[^\s*])([^<*]*?[^\s*])\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=[^\s_])([^<_]*?[^\s_])_(?!\w)/g, '$1<em>$2</em>');
}

// --- Dates ------------------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-27" → "Oct 27, 2026" (fixed, so the prerendered page and the browser agree). */
export function dayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return `${MONTHS[month - 1]} ${date}, ${year}`;
}

// --- The generated modules ----------------------------------------------------------------------------

/** Where the generated modules go (relative to the repo) and what each one exports. */
export const GENERATED_MODULES = {
  subtitles: { path: 'src/generated/guest-subtitles.ts', name: 'GUEST_SUBTITLES', type: 'GuestSubtitle' },
  stars: { path: 'src/generated/visitor-stars.ts', name: 'VISITOR_STARS', type: 'VisitorStar' },
  mailbag: { path: 'src/generated/mailbag.ts', name: 'MAILBAG', type: 'MailbagLetter' },
} as const;

/**
 * The source of each generated module, by repo path. One module per kind, so each lands only in the
 * bundle that uses it (the mailbag's HTML stays in /social's chunk; the stars ride with the sky).
 */
export function generatedModules(content: VisitorContent): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(GENERATED_MODULES) as (keyof VisitorContent)[]) {
    const { path, name, type } = GENERATED_MODULES[key];
    out[path] = [
      '// Generated from content/ by scripts/build-visitor-content.mjs before every build, test and dev server.',
      '// Don\'t edit it (it\'s gitignored); add or change a file in content/ instead.',
      `import type { ${type} } from '../shared/visitor-content/visitor-content';`,
      '',
      `export const ${name}: readonly ${type}[] = ${JSON.stringify(content[key], null, 2)};`,
      '',
    ].join('\n');
  }
  return out;
}
