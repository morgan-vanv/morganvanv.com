import { LabStatusId } from '../constants/lab.const';

/**
 * What the status Worker (`SITE_CONFIG.labStatusUrl`, lab-status 1.1) answers: whether the things on the air are up,
 * as seen from outside the house, when it last looked, and how many people are on the Minecraft server.
 * `{ "checkedAt": "…Z", "services": { "vtt": "up", "jellyfin": "up", "desk": "up", "minecraft": "up" },
 *   "players": { "minecraft": 3 } }`
 */
export interface LabStatus {
  checkedAt: string;
  /** vtt and jellyfin are always there; desk and minecraft only from lab-status 1.1 on (absent: no light). */
  services: Partial<Record<LabStatusId, 'up' | 'down'>>;
  /** How many are on the server, while it's up and said so; null otherwise. A count, never a name. */
  minecraftOnline: number | null;
}

/** Asked again this often while a page that shows it is open and visible; the Worker itself looks at most every two minutes. */
export const LAB_STATUS_POLL_MS = 2 * 60 * 1000;

/** Every answer has these, or it isn't trusted at all. */
const REQUIRED_IDS: readonly LabStatusId[] = ['vtt', 'jellyfin'];
/** Newer checks: read when present and well formed, left out otherwise (an older Worker has none). */
const OPTIONAL_IDS: readonly LabStatusId[] = ['desk', 'minecraft'];
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isState = (value: unknown): value is 'up' | 'down' => value === 'up' || value === 'down';

/**
 * A real timestamp and "up" or "down" for vtt and jellyfin, or null (and no lights at all). desk and minecraft are
 * kept when they're "up" or "down", and the player count only while minecraft is up and it's a whole number.
 */
export function toLabStatus(value: unknown): LabStatus | null {
  if (!isRecord(value) || !isRecord(value['services'])) return null;
  const checkedAt = value['checkedAt'];
  if (typeof checkedAt !== 'string' || !ISO_TIME.test(checkedAt) || Number.isNaN(Date.parse(checkedAt))) return null;
  const given = value['services'];
  const services: Partial<Record<LabStatusId, 'up' | 'down'>> = {};
  for (const id of REQUIRED_IDS) {
    const state = given[id];
    if (!isState(state)) return null;
    services[id] = state;
  }
  for (const id of OPTIONAL_IDS) {
    const state = given[id];
    if (isState(state)) services[id] = state;
  }
  const players = value['players'];
  const online = isRecord(players) ? players['minecraft'] : undefined;
  const minecraftOnline = services.minecraft === 'up' && typeof online === 'number' && Number.isInteger(online) && online >= 0
    ? online : null;
  return { checkedAt, services, minecraftOnline };
}
