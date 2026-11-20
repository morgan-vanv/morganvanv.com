/**
 * Every external handle and URL the site uses, in one place.
 * Social links, live-stat services, SEO tags and the sitemap all read from here.
 */
export const SITE_CONFIG = {
  name: 'Morgan Van Valkenburgh',
  domain: 'morganvanv.com',
  url: 'https://morganvanv.com',
  email: 'website@morganvanv.com',
  defaultDescription: 'Morgan Van Valkenburgh\'s personal website. Some guy from Cincinnati, his cat, and the things he\'s into.',
  repoUrl: 'https://github.com/morgan-vanv/morganvanv.com',
  backendRepoUrl: 'https://github.com/morgan-vanv/morganvanv.com-backend',
  handles: {
    github: 'morgan-vanv',
    linkedin: 'morganvanv',
    discordUserId: '186233910529622016',
    spotifyUserId: '1228709273',
    steam: 'most_money',
    instagram: 'morgan.vanv',
    statsFm: 'morgan.vanv',
    discogs: 'morganvanv',
    letterboxd: 'morganvanv',
    osrs: 'TipodissDong',
  },
  /**
   * Hotline Webring: a loop of personal sites. There's no sign-up; the first click through our
   * previous/next links adds the site, and the ring learns where we are from the Referer, so these
   * links must never carry `rel="noreferrer"`.
   */
  webring: {
    name: 'Hotline Webring',
    home: 'https://hotlinewebring.club/',
    previous: 'https://hotlinewebring.club/morganvanv/previous',
    next: 'https://hotlinewebring.club/morganvanv/next',
  },
  /** Real IRC on Libera.Chat; the shoutbox panel on Social links to it. */
  irc: {
    network: 'Libera.Chat',
    channel: '#morganvanv',
    server: 'irc.libera.chat',
    tlsPort: 6697,
    /** Libera's lightweight web client (gamja), opened on the channel with a nick to edit. */
    webClientUrl: 'https://web.libera.chat/gamja/?nick=guest#morganvanv',
  },
  /**
   * The campfire: a Cloudflare Worker (morganvanv.com-backend/campfire) holding the visitor count and the
   * shoutbox. Empty means none: the visitor counter hides and the shoutbox stays under construction.
   */
  campfireUrl: 'https://campfire.morganvanv.workers.dev',
  /** Ask Morgan: a Cloudflare Worker (morganvanv.com-backend/ask) that forwards the Contact form and star names to Discord. */
  askMorganSubmitUrl: 'https://ask.morganvanv.workers.dev/submit',
  /**
   * The lab's status: a Cloudflare Worker (morganvanv.com-backend/lab-status) that checks from outside every few
   * minutes whether the things on the Homelab's "On the air" are up, and how many are on the Minecraft server.
   * Answers `{ checkedAt, services: { vtt, jellyfin, desk, minecraft }, players?: { minecraft } }` (`lab-status.ts`).
   */
  labStatusUrl: 'https://lab-status.morganvanv.workers.dev/status',
  /**
   * The front desk: where friends and family sign in (Authentik; this name redirects to its own). The one door
   * to Morgan's hosted apps the site links (Morgan, 2026-11-20); the apps behind it are named, never linked.
   */
  frontDeskUrl: 'https://services.morganvanv.com',
  /**
   * The Minecraft network, open to anyone, Java and Bedrock alike, on the games' default ports. Its address is the
   * one the site shows on purpose (Morgan, 2026-11-20: the Homelab's exception to "no addresses").
   */
  minecraftAddress: 'mc.morganvanv.com',
  /**
   * Morgan's Discord server: its public widget feed (counts, voice, what's being played, an invite),
   * read straight from the browser on /social and /now. Turned on in the server's settings (Widget).
   */
  discord: {
    widgetUrl: 'https://discord.com/api/guilds/269944360014053388/widget.json',
    /**
     * The way in: a permanent invite Morgan made (no expiry, checked 2026-11-08). Not the widget's own
     * `instant_invite`, which Discord makes for a day at a time.
     */
    inviteUrl: 'https://discord.gg/Cgxk3Ya',
    /**
     * The names VideoJoker shows under in the widget, which lists it like any member (by its server nickname when
     * it has one), so the Homelab reads whether the bot is online from the same feed. "VJ" since November 2026,
     * when the bot got that nickname (the site read "offline" until this list learned it, 2026-11-20); its account
     * name stays as a fallback. The names never leave the parser (`toDiscordSummary`).
     */
    botNames: ['VJ', 'botmaster12'],
  },
  /** The weather badge: Open-Meteo (free, no key) for the numbers, the National Weather Service for people. */
  weatherApiUrl: 'https://api.open-meteo.com/v1/forecast',
  forecastPageUrl: 'https://forecast.weather.gov/MapClick.php?lat=39.1&lon=-84.51',
} as const;
