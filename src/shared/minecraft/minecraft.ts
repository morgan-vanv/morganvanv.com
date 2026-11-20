/**
 * The Minecraft network, as the site tells it: its modes and the two ways in. The address is
 * `SITE_CONFIG.minecraftAddress` and the live count comes from the status Worker (`LabStatusService.minecraftOnline`,
 * a number, never a name). Facts from the infra repo as of 2026-11-20; every line of copy is a draft for Morgan.
 */

export type MinecraftModeState = 'open' | 'soon' | 'later';

export interface MinecraftMode {
  name: string;
  line: string;
  state: MinecraftModeState;
}

/** In the order the server's own MOTD names them ("Factions · Anarchy · minigames soon"), then what's after. */
export const MINECRAFT_MODES: readonly MinecraftMode[] = [
  { name: 'Factions', line: 'kingdoms, claims and dungeons; the old world, progress and all', state: 'open' },
  { name: 'Anarchy', line: 'hard survival, no protection', state: 'open' },
  { name: 'Minigames', line: 'parkour, Skyblock, OneBlock, boat racing, an arena', state: 'soon' },
  { name: 'Creative', line: 'a plot of your own to build on', state: 'later' },
];

export interface MinecraftEdition {
  name: string;
  devices: string;
  line: string;
  /** Where to add the server: the menu, then the button in it. */
  menu: string;
  button: string;
}

/**
 * Java and Bedrock join the same worlds (Geyser), and Java's newer and older versions both get in (ViaVersion and
 * ViaBackwards on every mode). Both editions use their default port, so the address alone is enough. Bedrock on
 * consoles can't add a server of its own choosing, so the line names phones, tablets and Windows only.
 */
export const MINECRAFT_EDITIONS: readonly MinecraftEdition[] = [
  { name: 'Java Edition', devices: 'PC, Mac, Linux', line: 'newer and older versions both get in', menu: 'Multiplayer', button: 'Add Server' },
  { name: 'Bedrock Edition', devices: 'phones, tablets, Windows', line: 'same address, no port to type', menu: 'Servers', button: 'Add Server' },
];

/** "Factions · Anarchy · Minigames": the modes as one line (the 88×31's popover). Creative isn't on it until it opens. */
export const MODES_LINE = MINECRAFT_MODES.filter(mode => mode.state !== 'later').map(mode => mode.name).join(' · ');

/** "3 online", "0 online". */
export function onlineLine(count: number): string {
  return `${count} online`;
}

/** The server's icon, Morgan's own (2026-11-20), 264 px square for a 132 px spot. */
export const SERVER_ICON_URL = '/minecraft/server-icon.webp';
export const SERVER_ICON_ALT = 'The server\'s icon: a green block with M and V on it, over mc.morganvanv.com';
