import { LabStatusId } from '../../shared/constants/lab.const';

/**
 * What the status Worker (`SITE_CONFIG.labStatusUrl`) answers: whether the things on the air are up,
 * as seen from outside the house, and when it last looked.
 * `{ "checkedAt": "2026-11-05T19:40:00.000Z", "services": { "vtt": "up", "jellyfin": "down" } }`
 */
export interface LabStatus {
  checkedAt: string;
  services: Record<LabStatusId, 'up' | 'down'>;
}

/** Asked again this often while `/lab` is open and visible; the Worker itself looks at most every two minutes. */
export const LAB_STATUS_POLL_MS = 2 * 60 * 1000;

const STATUS_IDS: readonly LabStatusId[] = ['vtt', 'jellyfin'];
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** All or nothing: a real timestamp and "up" or "down" for every service, or null (and no pills). */
export function toLabStatus(value: unknown): LabStatus | null {
  if (!isRecord(value) || !isRecord(value['services'])) return null;
  const checkedAt = value['checkedAt'];
  if (typeof checkedAt !== 'string' || !ISO_TIME.test(checkedAt) || Number.isNaN(Date.parse(checkedAt))) return null;
  const given = value['services'];
  const services = {} as Record<LabStatusId, 'up' | 'down'>;
  for (const id of STATUS_IDS) {
    const state = given[id];
    if (state !== 'up' && state !== 'down') return null;
    services[id] = state;
  }
  return { checkedAt, services };
}
