/** Photos on the Social page's community wall, oldest first. Add new ones at the end. */
export interface CommunityPhoto {
  imageUrl: string;
  caption?: string;
}

export const COMMUNITY_PHOTOS: readonly CommunityPhoto[] = [
  { imageUrl: 'images/community-wall/stobi.webp', caption: 'a beast or demon of some sort' },
  { imageUrl: 'images/community-wall/richard_and_bernie.webp', caption: 'Richard & Bernie <3' },
  { imageUrl: 'images/community-wall/gup.webp', caption: 'gup' },
  { imageUrl: 'images/community-wall/dirty_dan.webp', caption: 'Dirty Dan' },
  { imageUrl: 'images/community-wall/atlas.webp', caption: 'atlas gains knowledge of self' },
  { imageUrl: 'images/community-wall/gerbie.webp', caption: 'gerbie' },
];
