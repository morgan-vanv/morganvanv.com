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
}

export const UNDER_CONSTRUCTION: readonly UnderConstructionSpot[] = [
  { id: 'projects', label: 'Projects', where: 'page' },
  { id: 'blog', label: 'Blog', where: 'page' },
  { id: 'shoutbox', label: 'Shoutbox', where: 'Social' },
  { id: 'favorite-media', label: 'Favorite Media', where: 'Interests' },
  { id: 'my-photos', label: 'My Photos', where: 'Interests' },
];

export function isUnderConstruction(id: UnderConstructionId): boolean {
  return UNDER_CONSTRUCTION.some(spot => spot.id === id);
}
