// The "Visitor scope" check (.github/workflows/visitor-scope.yml): a PR that calls itself a visitor's
// (a visitor/ branch or a "visitor:" title) may only add the one content/ file its name promises.
// Every other PR passes at once. The rules are in src/shared/visitor-content/visitor-pr.ts.
// Runs on Node 24, which strips the types from the .ts file it imports.
import { isVisitorPr, visitorPrProblems } from '../src/shared/visitor-content/visitor-pr.ts';

const { GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, PR_TITLE = '', PR_HEAD_REF = '' } = process.env;

if (!isVisitorPr({ title: PR_TITLE, headRef: PR_HEAD_REF })) {
  console.log('Not a visitor PR: nothing to check.');
  process.exit(0);
}

/** Every file the PR changes (GitHub lists at most 3000; a visitor PR has one). */
async function changedFiles() {
  const files = [];
  for (let page = 1; page <= 30; page++) {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`listing the PR's files: HTTP ${response.status}`);
    const batch = await response.json();
    files.push(...batch.map(({ filename, status }) => ({ filename, status })));
    if (batch.length < 100) break;
  }
  return files;
}

const problems = visitorPrProblems({ title: PR_TITLE, headRef: PR_HEAD_REF, files: await changedFiles() });
if (problems.length) {
  console.log('::error title=Not a visitor PR::This PR calls itself a visitor\'s, but ' + problems.join('; ').replace(/[\r\n%]/g, ' '));
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
console.log('A visitor PR adding exactly its one content/ file.');
