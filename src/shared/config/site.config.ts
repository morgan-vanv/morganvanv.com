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
  handles: {
    github: 'morgan-vanv',
    linkedin: 'morganvanv',
    discordUserId: '186233910529622016',
    spotifyUserId: '1228709273',
    steam: 'most_money',
    instagram: 'morgan.vanv',
    statsFm: 'morgan.vanv',
    discogs: 'morganvanv',
    osrs: 'TipodissDong',
  },
  askMorganSubmitUrl: 'https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-fb12a0f7-e7af-4149-8e0a-f676ef64d868/ask/submit',
  /** The weather badge: Open-Meteo (free, no key) for the numbers, the National Weather Service for people. */
  weatherApiUrl: 'https://api.open-meteo.com/v1/forecast',
  forecastPageUrl: 'https://forecast.weather.gov/MapClick.php?lat=39.1&lon=-84.51',
} as const;
