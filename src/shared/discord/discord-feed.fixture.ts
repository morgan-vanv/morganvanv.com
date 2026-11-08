/**
 * A widget feed in the shape Discord sends (`/api/guilds/<id>/widget.json`), cut down from the real one
 * of 2026-11-08 with the people made up: what the specs parse. Real members are never committed.
 */
export const DISCORD_FEED_FIXTURE = {
  id: '269944360014053388',
  name: 'Ugandan Commandos',
  instant_invite: 'https://discord.com/invite/jUwYdRCy',
  channels: [
    { id: '1', name: 'general voice', position: 0 },
    { id: '2', name: 'AFK', position: 1 },
  ],
  members: [
    { id: '0', username: 'alpha', discriminator: '0000', avatar: null, status: 'online', avatar_url: 'https://cdn.discordapp.com/widget-avatars/a/b', game: { name: 'RuneLite' } },
    { id: '1', username: 'bravo', discriminator: '0000', avatar: null, status: 'online', avatar_url: 'https://cdn.discordapp.com/widget-avatars/c/d', game: { name: 'RuneLite' } },
    { id: '2', username: 'charlie', discriminator: '0000', avatar: null, status: 'idle', avatar_url: 'https://cdn.discordapp.com/widget-avatars/e/f', game: { name: 'World of Warcraft: Forever' } },
    { id: '3', username: 'delta', discriminator: '0000', avatar: null, status: 'dnd', avatar_url: 'https://cdn.discordapp.com/widget-avatars/g/h', game: { name: 'HELLDIVERS 2' } },
    { id: '4', username: 'echo', discriminator: '0000', avatar: null, status: 'online', avatar_url: 'https://cdn.discordapp.com/widget-avatars/i/j', channel_id: '1', deaf: false, mute: false, self_deaf: false, self_mute: false, suppress: false },
    { id: '5', username: 'Some Bot', discriminator: '0000', avatar: null, status: 'online', avatar_url: 'https://cdn.discordapp.com/widget-avatars/k/l', game: { name: 'bot.example.net' } },
    { id: '6', username: 'foxtrot', discriminator: '0000', avatar: null, status: 'idle', avatar_url: 'https://cdn.discordapp.com/widget-avatars/m/n' },
  ],
  presence_count: 7,
};
