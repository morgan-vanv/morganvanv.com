export const GREETING_ROUTE_PATH = '';
export const GREETING_ROUTE = '/';

export interface MainRoute {
  path: string;
  title: string;
  /** One-sentence description used for <meta name="description"> and Open Graph. */
  description: string;
}

/**
 * The site's main pages, in navigation order. This order drives arrow-key
 * navigation, the navbar, slide direction, page titles, and the sitemap.
 */
export const MAIN_ROUTES = [
  { path: 'home', title: 'Home', description: 'Morgan Van Valkenburgh\'s personal website. Some guy from Cincinnati, his cat, and the things he\'s into.' },
  { path: 'background', title: 'Background', description: 'A bit about Morgan: physics and applied math at Ohio University, software engineering, and Ada the cat.' },
  { path: 'social', title: 'Social', description: 'The community photo wall. Send a photo, get a polaroid.' },
  { path: 'interests', title: 'Interests', description: 'Live stats on what Morgan is listening to and what his Old School RuneScape character is up to.' },
  { path: 'projects', title: 'Projects', description: 'Things Morgan has built or is building. Under construction.' },
  { path: 'blog', title: 'Blog', description: 'Writing from Morgan, eventually. Under construction.' },
] as const satisfies readonly MainRoute[];

export type MainRoutePath = (typeof MAIN_ROUTES)[number]['path'];

export const MAIN_NAV_ROUTES = MAIN_ROUTES.map(({ path }) => `/${path}`);

/** 1-based index of a main route; the greeting page is 0. */
export function getMainRouteAnimation(path: MainRoutePath): number {
  return MAIN_ROUTES.findIndex((route) => route.path === path) + 1;
}
