/**
 * Everything on the site that's still under construction, in one place. The pages show their
 * under-construction gif or banner only while their spot is listed here, so finishing something is one
 * deletion: take its line out. (An Under construction badge counted this list on /now for a day; it's
 * shelved in docs/ideas-later.md and can be brought back from git history.)
 */
export type UnderConstructionId = 'projects' | 'blog' | 'shoutbox' | 'favorite-media' | 'my-photos';

export const UNDER_CONSTRUCTION: readonly UnderConstructionId[] = ['projects', 'blog', 'shoutbox', 'my-photos'];

export function isUnderConstruction(id: UnderConstructionId): boolean {
  return UNDER_CONSTRUCTION.includes(id);
}
