/** A friend's site, shown as its 88×31 in the "my friends" row of /now's Buttons. */
export interface Friend {
  /** Their site; opens in a new tab. */
  href: string;
  /** What the button says, then the domain: the link's name starts with the words on its face. */
  name: string;
  domain: string;
  /** Our copy of their 88×31, in public/friends/ (kept here, so a visit to /now pings nobody). */
  image: string;
  /** For an animated button: one still frame, shown under reduced motion. */
  still?: string;
}

/** In Morgan's order, left to right (the /now spec pins it). */
export const FRIENDS: readonly Friend[] = [
  // Nick's own button, copied byte for byte from nickdeda.com/88x31.gif.
  { href: 'https://nickdeda.com', name: 'Nick Deda', domain: 'nickdeda.com', image: '/friends/nickdeda.gif', still: '/friends/nickdeda-still.webp' },
  // Harry's site had no button, so this one is drawn by scripts/build-harry-88x31.py, after his header.
  { href: 'https://harryrosenberg.net', name: "Harry's Site", domain: 'harryrosenberg.net', image: '/friends/harryrosenberg.gif' },
];
