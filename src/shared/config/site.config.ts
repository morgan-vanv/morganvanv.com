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
  /** The weather badge: Open-Meteo (free, no key) for the numbers, the National Weather Service for people. */
  weatherApiUrl: 'https://api.open-meteo.com/v1/forecast',
  forecastPageUrl: 'https://forecast.weather.gov/MapClick.php?lat=39.1&lon=-84.51',
} as const;
