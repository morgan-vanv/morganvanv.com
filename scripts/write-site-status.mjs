// Writes dist/browser/site-status.json for the Build badge on /now: what built the page you're looking at.
//
//   - the commit: how many commits master's history holds up to it (merged branches included), and its hash
//   - the pull request that merged it, and how its checks went (CI and Lighthouse only run on PRs,
//     so the merge commit itself has none of its own)
//   - the test suite: passed/total from test-results.json, line coverage from coverage/
//   - the deploy history: when a deploy last failed
//
// Runs in the deploy job after the build (needs a full-history checkout, GITHUB_TOKEN with actions,
// checks and pull-requests read, and the test run before it). Every part is optional; with nothing usable
// it leaves the committed placeholder (public/site-status.json) in place, and the badge hides. Never fails.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const out = 'dist/browser/site-status.json';
const repo = process.env.GITHUB_REPOSITORY ?? 'morgan-vanv/morganvanv.com';
const token = process.env.GITHUB_TOKEN;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const attempt = (what, fn) => {
  try {
    return fn();
  } catch (error) {
    console.warn(`write-site-status: no ${what} (${error.message})`);
    return undefined;
  }
};

async function github(path) {
  if (!token) throw new Error('no GITHUB_TOKEN');
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

// The checks the badge reports, in order. CodeQL arrives as one check per language plus a summary.
const CHECKS = [
  { name: 'Lint', matches: name => name === 'Lint' },
  { name: 'Build', matches: name => name === 'Build' },
  { name: 'Test', matches: name => name === 'Test' },
  { name: 'Lighthouse', matches: name => name === 'Lighthouse' },
  { name: 'Layout', matches: name => name === 'Layout' },
  { name: 'CodeQL', matches: name => name === 'CodeQL' || name.startsWith('Analyze (') },
];

const sha = attempt('commit', () => git('rev-parse', 'HEAD'));
// Needs a full-history checkout; a shallow one would count 1.
const commit = sha && attempt('commit number', () => ({ sha, number: Number(git('rev-list', '--count', 'HEAD')) }));

const pr = sha && await (async () => {
  try {
    // Only the PR this commit merged (or squashed) into master: not an open one, not an older one in a stack.
    const pulls = await github(`/commits/${sha}/pulls`);
    const merged = pulls.find(p => p.merge_commit_sha === sha && p.base?.ref === 'master');
    if (!merged) return undefined;
    const runs = (await github(`/commits/${merged.head.sha}/check-runs?per_page=100`)).check_runs ?? [];
    const checks = CHECKS
      .map(({ name, matches }) => {
        const mine = runs.filter(run => matches(run.name) && run.status === 'completed');
        if (!mine.length) return null;
        return { name, ok: mine.every(run => ['success', 'neutral', 'skipped'].includes(run.conclusion)) };
      })
      .filter(Boolean);
    return { number: merged.number, url: merged.html_url, checks };
  } catch (error) {
    console.warn(`write-site-status: no pull request (${error.message})`);
    return undefined;
  }
})();

const tests = attempt('test results', () => {
  const results = JSON.parse(readFileSync('test-results.json', 'utf8'));
  const dir = readdirSync('coverage').map(name => `coverage/${name}/coverage-summary.json`).find(existsSync)
    ?? 'coverage/coverage-summary.json';
  const lines = attempt('coverage', () => JSON.parse(readFileSync(dir, 'utf8')).total.lines.pct);
  return { passed: results.numPassedTests, total: results.numTotalTests, ...(typeof lines === 'number' ? { lines } : {}) };
});

const deploys = await (async () => {
  try {
    const failed = await github('/actions/workflows/deploy.yml/runs?status=failure&per_page=1');
    return { lastFailureAt: failed.workflow_runs?.[0]?.created_at ?? null };
  } catch (error) {
    console.warn(`write-site-status: no deploy history (${error.message})`);
    return undefined;
  }
})();

if (!commit) {
  console.warn('write-site-status: no commit to report; the badge will hide.');
} else {
  const status = { commit, measuredAt: new Date().toISOString() };
  if (pr) status.pr = pr;
  if (tests) status.tests = tests;
  if (deploys) status.deploys = deploys;
  writeFileSync(out, JSON.stringify(status) + '\n');
  console.log(`write-site-status: ${out} ${JSON.stringify(status)}`);
}
