/**
 * What a visitor PR may change.
 *
 * Until Ask Morgan 2.1 (morganvanv.com-backend), a token that could write to this repo opened one PR per
 * approved suggestion: branch `visitor/<kind>/<id>`, title `visitor: <kind> <id>`, and one new file,
 * `content/<folder>/<id>.<ext>`; to a reviewer they looked like any other PR. Morgan now opens them
 * himself from GitHub's editor, and the guard stays for anything that claims the old shape. The "Visitor scope" check holds anything that calls itself a visitor PR (by branch or
 * by title) to exactly that shape, so "it's just a visitor PR" is safe to merge: a PR that says it's a
 * visitor's and touches anything else fails.
 *
 * No imports, and only erasable TypeScript: scripts/check-visitor-pr.mjs runs it straight from Node.
 */

export interface PullRequestFile {
  readonly filename: string;
  readonly status: string;
}

export interface PullRequestFacts {
  readonly title: string;
  readonly headRef: string;
  /** Every file the PR changes, as GitHub lists them. */
  readonly files: readonly PullRequestFile[];
}

/** Where each kind's file goes, as ask/publish writes it (publish-link.js, DIRECTORIES and filePath). */
export const VISITOR_FILES: Readonly<Record<string, { readonly folder: string; readonly extension: string }>> = {
  subtitle: { folder: 'content/subtitles', extension: '.json' },
  star: { folder: 'content/stars', extension: '.json' },
  question: { folder: 'content/mailbag', extension: '.md' },
};

/** The ids ask/publish makes: `YYYY-MM-DD-<slug>-<8 hex>`. */
const ID_PATTERN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{8}$/;

/** A PR that presents itself as a visitor's, by its branch or its title. */
export function isVisitorPr(pr: Pick<PullRequestFacts, 'title' | 'headRef'>): boolean {
  return pr.headRef.startsWith('visitor/') || /^\s*visitor\b/i.test(pr.title);
}

/** Why a PR that calls itself a visitor's isn't one; empty when it is one, or doesn't claim to be. */
export function visitorPrProblems(pr: PullRequestFacts): string[] {
  if (!isVisitorPr(pr)) return [];

  const branch = /^visitor\/([a-z]+)\/(.+)$/.exec(pr.headRef);
  const kind = branch?.[1] ?? '';
  const id = branch?.[2] ?? '';
  const target = Object.hasOwn(VISITOR_FILES, kind) ? VISITOR_FILES[kind] : undefined;
  if (!branch || !target || !ID_PATTERN.test(id)) {
    return [`the branch "${pr.headRef}" isn't visitor/<subtitle|star|question>/<id>, as ask/publish names them`];
  }

  const problems: string[] = [];
  const title = `visitor: ${kind} ${id}`;
  if (pr.title !== title) problems.push(`the title should be exactly "${title}"`);

  const expected = `${target.folder}/${id}${target.extension}`;
  const others = pr.files.filter(file => file.filename !== expected).map(file => file.filename);
  if (others.length) problems.push(`it changes more than ${expected}: ${others.join(', ')}`);

  const file = pr.files.find(f => f.filename === expected);
  if (!file) problems.push(`it doesn't add ${expected}`);
  else if (file.status !== 'added') problems.push(`${expected} should be a new file (it's "${file.status}")`);

  return problems;
}
