/**
 * Photos on the Social page's community wall, oldest first. Add new ones at the end.
 * Each has the full photo (shown fullscreen) and a 480x640 thumbnail in `thumbs/`
 * (shown on the wall and on /now); make the thumbnail when adding a photo.
 */
export interface CommunityPhoto {
  imageUrl: string;
  thumbUrl: string;
  caption?: string;
}

export const COMMUNITY_PHOTOS: readonly CommunityPhoto[] = [
  { imageUrl: 'images/community-wall/stobi.webp', thumbUrl: 'images/community-wall/thumbs/stobi.webp', caption: 'a beast or demon of some sort' },
  { imageUrl: 'images/community-wall/richard_and_bernie.webp', thumbUrl: 'images/community-wall/thumbs/richard_and_bernie.webp', caption: 'Richard & Bernie <3' },
  { imageUrl: 'images/community-wall/gup.webp', thumbUrl: 'images/community-wall/thumbs/gup.webp', caption: 'gup' },
  { imageUrl: 'images/community-wall/dirty_dan.webp', thumbUrl: 'images/community-wall/thumbs/dirty_dan.webp', caption: 'Dirty Dan' },
  { imageUrl: 'images/community-wall/atlas.webp', thumbUrl: 'images/community-wall/thumbs/atlas.webp', caption: 'atlas gains knowledge of self' },
  { imageUrl: 'images/community-wall/gerbie.webp', thumbUrl: 'images/community-wall/thumbs/gerbie.webp', caption: 'gerbie' },
];

/** "1 photo", "6 photos": the dim count beside the wall's heading and on its badge. */
export function photoCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'photo' : 'photos'}`;
}
