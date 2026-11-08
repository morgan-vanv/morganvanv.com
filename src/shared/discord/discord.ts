/**
 * Discord's public widget feed for Morgan's server (`SITE_CONFIG.discord.widgetUrl`), boiled down to
 * what the site shows: how many are on, how they're split, how many are in voice and what's being
 * played. The feed's own invite (`instant_invite`) only lasts a day, so it's ignored: the way in is the
 * permanent `SITE_CONFIG.discord.inviteUrl`. Usernames, avatars and channel names are dropped here, so nothing past this file ever sees
 * them: the site shows counts, never people.
 */
export interface DiscordSummary {
  name: string;
  /** Everyone online, by Discord's count. */
  online: number;
  /** How they're split, scaled to `online` (Discord lists at most about a hundred members). */
  status: DiscordStatusCounts;
  /** People in a voice channel. */
  inVoice: number;
  /** What's being played, most-played first, then by name. */
  games: readonly DiscordGame[];
}

export interface DiscordStatusCounts {
  online: number;
  idle: number;
  dnd: number;
}

export interface DiscordGame {
  name: string;
  count: number;
}

/** Asked again this often while a page showing it is open; Discord caches the feed for five minutes. */
export const DISCORD_POLL_MS = 5 * 60 * 1000;

const STATUSES = ['online', 'idle', 'dnd'] as const;
/** Bots tend to "play" their own website ("bot.wiseoldman.net"): that's not a game. */
const LOOKS_LIKE_A_DOMAIN = /^[\w-]+(\.[\w-]+)+(\/\S*)?$/;
const MAX_NAME = 60;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Plain, short, one-line text, or null. */
function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // Control characters and bidirectional overrides out, whitespace collapsed.
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const chars = [...text];
  return chars.length > MAX_NAME ? `${chars.slice(0, MAX_NAME - 1).join('').trimEnd()}…` : text;
}

/**
 * Scales the listed members' split up to Discord's full count, so the three add up to `online`
 * (largest remainder). With no members listed it's all "online".
 */
export function scaleStatus(listed: DiscordStatusCounts, online: number): DiscordStatusCounts {
  const total = listed.online + listed.idle + listed.dnd;
  if (total === 0) return { online, idle: 0, dnd: 0 };
  if (total === online) return listed;
  const exact = STATUSES.map(s => listed[s] * online / total);
  const counts = exact.map(Math.floor);
  let left = online - counts.reduce((a, b) => a + b, 0);
  const byRemainder = exact.map((x, i) => [x - counts[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of byRemainder) {
    if (left <= 0) break;
    counts[i]++;
    left--;
  }
  return { online: counts[0], idle: counts[1], dnd: counts[2] };
}

/** The feed as the site uses it, or null if it isn't the shape Discord sends (then nothing shows). */
export function toDiscordSummary(value: unknown): DiscordSummary | null {
  if (!isRecord(value)) return null;
  const name = cleanName(value['name']);
  const online = value['presence_count'];
  const members = value['members'];
  if (!name || typeof online !== 'number' || !Number.isInteger(online) || online < 0 || !Array.isArray(members)) return null;

  const listed: DiscordStatusCounts = { online: 0, idle: 0, dnd: 0 };
  const played = new Map<string, number>();
  let inVoice = 0;
  for (const member of members) {
    if (!isRecord(member)) continue;
    const status = member['status'];
    if (status === 'online' || status === 'idle' || status === 'dnd') listed[status]++;
    if (typeof member['channel_id'] === 'string' && member['channel_id']) inVoice++;
    const game = isRecord(member['game']) ? cleanName(member['game']['name']) : null;
    if (game && !LOOKS_LIKE_A_DOMAIN.test(game)) played.set(game, (played.get(game) ?? 0) + 1);
  }

  const games = [...played].map(([game, count]) => ({ name: game, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return { name, online, status: scaleStatus(listed, online), inVoice, games };
}

/** "69 online · 1 in voice · 5 on RuneLite": the /now row's line. */
export function discordDetail(summary: DiscordSummary): string {
  const top = summary.games[0];
  return [
    `${summary.online} online`,
    summary.inVoice ? `${summary.inVoice} in voice` : null,
    top ? `${top.count} on ${top.name}` : null,
  ].filter(part => part !== null).join(' · ');
}
