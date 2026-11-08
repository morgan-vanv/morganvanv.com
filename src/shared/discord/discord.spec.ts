import { DISCORD_FEED_FIXTURE } from './discord-feed.fixture';
import { discordDetail, scaleStatus, toDiscordSummary } from './discord';

describe('toDiscordSummary', () => {
  it('boils the feed down to counts and games', () => {
    expect(toDiscordSummary(DISCORD_FEED_FIXTURE)).toEqual({
      name: 'Ugandan Commandos',
      invite: 'https://discord.com/invite/jUwYdRCy',
      online: 7,
      status: { online: 4, idle: 2, dnd: 1 },
      inVoice: 1,
      games: [
        { name: 'RuneLite', count: 2 },
        { name: 'HELLDIVERS 2', count: 1 },
        { name: 'World of Warcraft: Forever', count: 1 },
      ],
    });
  });

  it('keeps no people: no usernames, avatars or channel names survive', () => {
    const json = JSON.stringify(toDiscordSummary(DISCORD_FEED_FIXTURE));
    for (const member of DISCORD_FEED_FIXTURE.members) {
      expect(json).not.toContain(member.username);
      expect(json).not.toContain(member.avatar_url);
    }
    for (const channel of DISCORD_FEED_FIXTURE.channels) expect(json).not.toContain(channel.name);
  });

  it("leaves out a bot's website as a game", () => {
    expect(toDiscordSummary(DISCORD_FEED_FIXTURE)?.games.map(g => g.name)).not.toContain('bot.example.net');
  });

  it('only trusts a Discord invite', () => {
    const invite = (instant_invite: unknown) => toDiscordSummary({ ...DISCORD_FEED_FIXTURE, instant_invite })?.invite;
    expect(invite('https://discord.gg/abc123')).toBe('https://discord.gg/abc123');
    expect(invite(null)).toBeNull();
    expect(invite('https://evil.example/invite/abc')).toBeNull();
    expect(invite('javascript:alert(1)')).toBeNull();
    expect(invite('https://discord.com/invite/abc?x=1')).toBeNull();
  });

  it('cleans names: no control or direction characters, one line, capped', () => {
    const summary = toDiscordSummary({
      ...DISCORD_FEED_FIXTURE,
      name: '  The‮  Server\n',
      members: [{ status: 'online', game: { name: 'A'.repeat(80) } }],
    });
    expect(summary?.name).toBe('The Server');
    expect([...summary!.games[0].name].length).toBe(60);
    expect(summary!.games[0].name.endsWith('…')).toBe(true);
  });

  it("is null for anything that isn't the feed", () => {
    expect(toDiscordSummary(null)).toBeNull();
    expect(toDiscordSummary([])).toBeNull();
    expect(toDiscordSummary({ ...DISCORD_FEED_FIXTURE, name: '' })).toBeNull();
    expect(toDiscordSummary({ ...DISCORD_FEED_FIXTURE, presence_count: -1 })).toBeNull();
    expect(toDiscordSummary({ ...DISCORD_FEED_FIXTURE, presence_count: 2.5 })).toBeNull();
    expect(toDiscordSummary({ ...DISCORD_FEED_FIXTURE, members: 'lots' })).toBeNull();
    // Discord's answer for a server with its widget turned off.
    expect(toDiscordSummary({ message: 'Widget Disabled', code: 50004 })).toBeNull();
  });

  it('skips members that make no sense rather than failing', () => {
    const summary = toDiscordSummary({ ...DISCORD_FEED_FIXTURE, members: [null, 'x', { status: 'offline' }, { status: 'idle' }], presence_count: 1 });
    expect(summary?.status).toEqual({ online: 0, idle: 1, dnd: 0 });
    expect(summary?.games).toEqual([]);
  });
});

describe('scaleStatus', () => {
  it("leaves the split alone when every member's listed", () => {
    expect(scaleStatus({ online: 42, idle: 17, dnd: 10 }, 69)).toEqual({ online: 42, idle: 17, dnd: 10 });
  });

  it('scales a capped list up to the full count, still adding up', () => {
    const scaled = scaleStatus({ online: 50, idle: 30, dnd: 20 }, 151);
    expect(scaled.online + scaled.idle + scaled.dnd).toBe(151);
    expect(scaled).toEqual({ online: 76, idle: 45, dnd: 30 });
  });

  it('calls everyone around when nobody is listed', () => {
    expect(scaleStatus({ online: 0, idle: 0, dnd: 0 }, 3)).toEqual({ online: 3, idle: 0, dnd: 0 });
  });
});

describe('discordDetail', () => {
  const summary = toDiscordSummary(DISCORD_FEED_FIXTURE)!;

  it('says how many are on, in voice and on the top game', () => {
    expect(discordDetail(summary)).toBe('7 online · 1 in voice · 2 on RuneLite');
  });

  it('leaves out voice and games when there are none', () => {
    expect(discordDetail({ ...summary, inVoice: 0, games: [] })).toBe('7 online');
  });
});
