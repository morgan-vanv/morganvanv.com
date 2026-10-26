/**
 * The commit the site was built from, shown on /now. Lives in its own file
 * because production builds swap src/build-info.ts for the generated
 * src/build-info.prod.ts, and both need this type.
 */
export interface BuildInfo {
  /** Full commit SHA, or '' when unknown. */
  sha: string;
  /** Commit date, ISO 8601, or '' when unknown. */
  date: string;
  /** Commit subject (for GitHub merges, the PR title and number). */
  message: string;
}
