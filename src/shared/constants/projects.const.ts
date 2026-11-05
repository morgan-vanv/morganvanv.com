/**
 * Things Morgan is building. The Projects page shows every entry as a poster;
 * /now pins the one marked `pinned` under "Building" (`PINNED_PROJECT`) and names whichever
 * repo was pushed to most recently. Copy here is drafted from each project's own
 * README and in-game text; Morgan should edit it freely.
 */

/** One line of the mocked-up Discord exchange that stands in for a bot's screenshot. */
export interface ChatLine {
  /** Who's talking: a guest in the server, or the bot itself. */
  from: 'guest' | 'bot';
  name: string;
  /** A slash command the guest ran, shown in the command colour. */
  command?: string;
  /** Plain text after the command, or the bot's reply. */
  text?: string;
  /** The part of the bot's reply it bolds. */
  strong?: string;
  /** Three card buttons under the line, as Three Card Monte deals them. */
  cards?: boolean;
}

/** What a poster shows above its title plate. */
export type ProjectArt =
  /** A real screenshot in public/. */
  | { kind: 'image'; url: string; alt: string }
  /** A chat log drawn in CSS, for a bot with no screen to shoot. */
  | { kind: 'chat'; alt: string; lines: readonly ChatLine[] }
  /** A miniature of this site: the glass card over the sky. */
  | { kind: 'site'; alt: string }
  /** A server rack drawn in CSS: a faceplate per machine, named on its front (public names only, never addresses or ports). */
  | { kind: 'rack'; alt: string; units: readonly RackUnit[] };

/** One machine in the rack art, top to bottom. */
export interface RackUnit {
  /** The name on its faceplate. */
  name: string;
  /** 1U or 2U tall. */
  height: 1 | 2;
  /** What fills the rest of the faceplate: a vent grille, four drive bays, or nothing. */
  face?: 'vent' | 'bays';
  /** Its light: green (the default), or amber for the UPS. */
  led?: 'green' | 'amber';
}

export interface Project {
  id: string;
  name: string;
  subtitle?: string;
  /** Two or three words on the poster's corner: "live", "resurrected". */
  status: string;
  /** One or two sentences: what it is. */
  description: string;
  /** Optional line in the project's own voice. */
  quote?: string;
  art: ProjectArt;
  /** Where to try it, if it's playable/usable. */
  liveUrl?: string;
  liveLabel?: string;
  /** The words that rise onto the art on hover (it links where `liveUrl`, else `more`, goes); default: that link's label. */
  artLabel?: string;
  /** A page on this site to read more, as `[ label › ]`. */
  more?: { label: string; route: string };
  /** GitHub repo, used for the source link and the live "updated N ago"; none for something hosted, not coded. */
  repo?: { owner: string; name: string };
  tags: readonly string[];
  /** Pin this one on /now under "Building". Exactly one project has it, and it needs a screenshot (the card has no other art). */
  pinned?: true;
  /** A red sash on the art's corner after a big update, e.g. "new · v5". Morgan removes the line when it's had its moment. */
  ribbon?: string;
}

export const PROJECTS: readonly Project[] = [
  {
    id: 'valkenburg-castle',
    name: 'Valkenburg Castle',
    subtitle: 'The Heir\'s Return',
    status: 'live',
    description: 'A turn-based extraction crawler for the browser, inspired by Task Force Games\' Valkenburg Castle (1980).',
    quote: 'Take contracts. Come back alive. If Keven falls, Valkenburg stays dark.',
    art: {
      kind: 'image',
      url: 'images/projects/valkenburg-castle-v5.webp',
      alt: 'Valkenburg Castle v5 in play: the party on a firelit hex floor, facing a red dragon on its pile of gold',
    },
    liveUrl: 'https://morgan-vanv.github.io/Valkenburg-Castle/',
    liveLabel: 'Play it',
    // Draft from the hover mockups (2026-10-31); Morgan may reword.
    artLabel: 'enter the castle',
    repo: { owner: 'morgan-vanv', name: 'Valkenburg-Castle' },
    tags: ['TypeScript', 'Three.js', 'Vite'],
    pinned: true,
    ribbon: 'new · v5',
  },
  {
    id: 'homelab',
    name: 'The Homelab',
    subtitle: 'my closet',
    status: 'humming',
    // Morgan's words (2026-11-05).
    description: 'A Proxmox server, a Synology NAS, and all sorts of other stuff (including Raspberry Pis!). This hosts my apps '
      + 'for me, as well as family and friends.',
    // Draft, from his infra docs; Morgan keeps it or cuts it.
    quote: 'Each box does one job it is good at.',
    art: {
      kind: 'rack',
      alt: 'A server rack drawn in lines: four machines with their lights on',
      units: [
        { name: 'BIG HOSS', height: 2, face: 'vent' },
        { name: 'FALKENBURGHNAS', height: 2, face: 'bays' },
        { name: 'PI-HOLE', height: 1 },
        { name: 'UPS', height: 1, led: 'amber' },
      ],
    },
    // The infra repo is private: no source link, no "updated".
    more: { label: 'the lab', route: '/lab' },
    tags: ['Proxmox', 'Synology', 'Tailscale', 'Caddy'],
  },
  {
    id: 'videojoker',
    name: 'VideoJoker',
    subtitle: 'a Discord bot, with friends',
    status: 'resurrected',
    // From the README; approved by Morgan (2026-10-28).
    description: 'A Discord bot named after the Video Jokers of Uganda, who dub over bootleg action films with their own '
      + 'commentary. It roasts, flips coins, deals Three Card Monte and pays out in Ugandan Shillings.',
    quote: 'I don\'t even know why I spent so long on this README lol',
    art: {
      kind: 'chat',
      alt: 'A Discord chat: someone runs /roast and VideoJoker answers; a game of Three Card Monte with three card buttons',
      // Every bot line is one the bot really says (core/constants.py, cogs/games.py).
      lines: [
        { from: 'guest', name: 'someone', command: '/roast', text: '@morgan' },
        { from: 'bot', name: 'VideoJoker', text: 'someone roasted morgan: ', strong: 'You are a stinky smeller boy.' },
        { from: 'guest', name: 'morgan', command: '/threecardmonte' },
        { from: 'bot', name: 'VideoJoker', text: 'Pick a card, any card!', cards: true },
      ],
    },
    repo: { owner: 'morgan-vanv', name: 'VideoJoker' },
    tags: ['Python', 'discord.py', 'SQLite', 'Docker'],
  },
  {
    id: 'vtt',
    name: 'vtt.morganvanv.com',
    subtitle: 'the table',
    status: 'self-hosted',
    // Approved by Morgan (2026-10-28).
    description: 'A Foundry Virtual Tabletop I host myself, for the Vampire: The Masquerade campaign I run, set in Athens, '
      + 'Ohio. It\'s set up for D&D too, for all my TTRPG lovers.',
    art: {
      kind: 'image',
      url: 'images/projects/foundry-vtt.webp',
      alt: 'Foundry VTT\'s sixth-anniversary art: a glowing orange d20 in a candlelit hall of stained glass',
    },
    liveUrl: 'https://vtt.morganvanv.com/',
    liveLabel: 'The table',
    tags: ['Foundry VTT', 'Vampire: The Masquerade', 'D&D'],
  },
  {
    id: 'morganvanv-com',
    name: 'morganvanv.com',
    subtitle: 'this site',
    status: 'you\'re on it',
    // Approved by Morgan (2026-10-28).
    description: 'the thing you\'re looking at.',
    quote: 'Built with: Angular, TypeScript, SCSS',
    art: { kind: 'site', alt: 'A miniature of this website: the glass card over the night sky' },
    more: { label: 'colophon', route: '/colophon' },
    repo: { owner: 'morgan-vanv', name: 'morganvanv.com' },
    tags: ['Angular', 'TypeScript', 'SCSS', 'Cloudflare'],
  },
];

/** The project /now keeps under "Building", whatever else is moving: the one marked `pinned` (a spec holds it to one). */
export const PINNED_PROJECT: Project = PROJECTS.find(p => p.pinned) ?? PROJECTS[0];
