import { Tonight } from '../../../shared/sky/sky-tonight';
import { clock } from '../../../shared/sky/sky-clock';
import { phaseName } from '../../../shared/badges/moon-badge/moon-phase';
import { LAB_ON_AIR, LabStatusId } from '../../../shared/constants/lab.const';
import { onlineLine } from '../../../shared/minecraft/minecraft';

/** "waxing gibbous · 81% lit", from the sky's own numbers. */
export function moonLine(moon: { readonly illuminated: number; readonly phase: number }): string {
  return `${phaseName(moon.phase)} · ${Math.round(moon.illuminated * 100)}% lit`;
}

/**
 * The night's first planet and when it's up, on the sky's clock: "Jupiter up all night",
 * "Saturn up now, until 1:15 am", "Mars up 9:40 pm–dawn", with "· +2" for the others the
 * Up tonight badge lists. A night with no planets, or no dark sky, says so.
 */
export function planetLine(night: Tonight, timeZone?: string): string {
  if (!night.start) return 'no dark sky tonight';
  const [first, ...rest] = night.planets;
  if (!first) return 'no planets up tonight';
  const from = first.upAtStart ? (night.dark ? 'now' : 'dusk') : clock(first.from, timeZone);
  const until = first.upAtEnd ? (night.end ? 'dawn' : 'morning') : clock(first.until, timeZone);
  const when = from === 'dusk' && until === 'dawn' ? 'all night'
    : from === 'now' ? `now, until ${until}`
    : `${from}–${until}`;
  return `${first.name} up ${when}${rest.length ? ` · +${rest.length}` : ''}`;
}

export interface OnAirLine {
  readonly name: string;
  /** Null until it's known (the status Worker or Discord hasn't answered): no light. */
  readonly state: 'up' | 'down' | null;
  /** The server's "3 online", while it's up and counted; null for everything else. */
  readonly count: string | null;
}

/** The porch's On the air, in Morgan's order (2026-11-20), by name in `LAB_ON_AIR`, with the porch's own label where it differs. */
export const PORCH_ON_AIR: readonly { readonly name: string; readonly label?: string }[] = [
  { name: 'Minecraft', label: 'Minecraft Server' },
  { name: 'VideoJoker' },
  { name: 'Jellyfin' },
  { name: 'Foundry VTT' },
];

/**
 * The Homelab's live "On the air" entries, in the porch's order (`PORCH_ON_AIR`), each with its state:
 * the status Worker's for the ones it checks, the Discord feed's yes-or-no for the bot (`via: 'discord'`;
 * `null` when Discord capped its member list, since absence then proves nothing), and for the server,
 * how many are on.
 */
export function onAirLines(
  stateOf: (id: LabStatusId) => 'up' | 'down' | null,
  botOnline: boolean | null,
  minecraftOnline: number | null = null,
): OnAirLine[] {
  return PORCH_ON_AIR.flatMap(({ name, label }) => {
    const entry = LAB_ON_AIR.find(candidate => candidate.name === name);
    if (!entry || entry.state !== 'live') return [];
    const state = 'statusId' in entry ? stateOf(entry.statusId)
      : botOnline === null ? null : botOnline ? 'up' : 'down';
    const count = entry.server && state === 'up' && minecraftOnline !== null ? onlineLine(minecraftOnline) : null;
    return [{ name: label ?? entry.name, state, count }];
  });
}

/**
 * Hanging out's second line, the Minecraft server (drafts): how many are on while it's up, else where to
 * find it. Always the address, since that's how you join.
 */
export function serverLine(state: 'up' | 'down' | null, online: number | null, address: string): string {
  if (state === 'up' && online !== null) return `${onlineLine(online)} · ${address}`;
  if (state === 'down') return `down for now · ${address}`;
  return `${address} · Java and Bedrock`;
}
