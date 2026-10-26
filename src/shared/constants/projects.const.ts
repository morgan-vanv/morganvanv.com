/**
 * Things Morgan is building. Shown on /now today; the future Projects page
 * will list the same entries. Copy here is drafted from each project's own
 * README and in-game text; Morgan should edit it freely.
 */
export interface Project {
  id: string;
  name: string;
  subtitle?: string;
  /** One or two sentences: what it is. */
  description: string;
  /** Optional line in the project's own voice. */
  quote?: string;
  imageUrl: string;
  imageAlt: string;
  /** Where to try it, if it's playable/usable. */
  liveUrl?: string;
  liveLabel?: string;
  /** GitHub repo, used for the source link and the live "updated N ago". */
  repo: { owner: string; name: string };
  tags: readonly string[];
}

export const PROJECTS: readonly Project[] = [
  {
    id: 'valkenburg-castle',
    name: 'Valkenburg Castle',
    subtitle: 'The Heir\'s Return',
    description: 'A turn-based extraction crawler for the browser, inspired by Task Force Games\' Valkenburg Castle (1980).',
    quote: 'Take contracts. Come back alive. If Keven falls, Valkenburg stays dark.',
    imageUrl: 'images/projects/valkenburg-castle.webp',
    imageAlt: 'Valkenburg Castle in play: Keven, lantern raised, at the castle gate on a hex-tiled floor',
    liveUrl: 'https://morgan-vanv.github.io/Valkenburg-Castle/',
    liveLabel: 'Play it',
    repo: { owner: 'morgan-vanv', name: 'Valkenburg-Castle' },
    tags: ['TypeScript', 'Three.js', 'Vite'],
  },
];
