/**
 * Everything on the site that's still under construction, in one place. The pages show their
 * under-construction gif or banner only while their spot is listed here, and the badge on /now counts
 * this list, so finishing something is one deletion: take its line out and both update.
 */
export type UnderConstructionId = 'projects' | 'blog' | 'shoutbox' | 'favorite-media' | 'my-photos';

export interface UnderConstructionSpot {
  id: UnderConstructionId;
  /** What it is, and where it lives, as the badge's popover lists them. */
  label: string;
  where: string;
  /** Where it lives, for the badge's link. */
  path: string;
}

export const UNDER_CONSTRUCTION: readonly UnderConstructionSpot[] = [
  { id: 'projects', label: 'Projects', where: 'page', path: '/projects' },
  { id: 'blog', label: 'Blog', where: 'page', path: '/blog' },
  { id: 'shoutbox', label: 'Shoutbox', where: 'Social', path: '/social' },
  { id: 'favorite-media', label: 'Favorite Media', where: 'Interests', path: '/interests' },
  { id: 'my-photos', label: 'My Photos', where: 'Interests', path: '/interests' },
];

export function isUnderConstruction(id: UnderConstructionId): boolean {
  return UNDER_CONSTRUCTION.some(spot => spot.id === id);
}
