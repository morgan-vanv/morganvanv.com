export const WOM_USERNAME = 'TipodissDong';

export interface CharacterBadge {
  iconUrl: string;
  alt: string;
  label: string;
  href: string;
}

export const CHARACTER_BADGES: CharacterBadge[] = [
  { iconUrl: 'osrs/badges/group_ironman_badge.png', alt: 'Group Ironman', label: 'SeedSlingers', href: 'https://wiseoldman.net/groups/12982' },
  { iconUrl: 'osrs/badges/clan_deputy_owner_icon.png', alt: 'Clan', label: 'Ugandans', href: 'https://wiseoldman.net/groups/7117' },
];

export interface PoweredByLink {
  label: string;
  href: string;
}

export const POWERED_BY_LINKS: PoweredByLink[] = [
  { label: 'Wise Old Man', href: `https://wiseoldman.net/players/${WOM_USERNAME}` },
  { label: 'RuneProfile', href: `https://www.runeprofile.com/${WOM_USERNAME}` },
  { label: 'TempleOSRS', href: `https://templeosrs.com/player/overview.php?player=${WOM_USERNAME.toLowerCase()}` },
];

// Ordered to match the in-game Skills tab layout (3 columns, top to bottom)
export const SKILL_ORDER = [
  'attack',       'hitpoints',    'mining',
  'strength',     'agility',      'smithing',
  'defence',      'herblore',     'fishing',
  'ranged',       'thieving',     'cooking',
  'prayer',       'crafting',     'firemaking',
  'magic',        'fletching',    'woodcutting',
  'runecrafting', 'slayer',       'farming',
  'construction', 'hunter',       'sailing',
] as const;

export const DIARY_TIERS = ['Easy', 'Medium', 'Hard', 'Elite'] as const;
