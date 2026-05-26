export const GREETING_ROUTE_PATH = '';
export const GREETING_ROUTE = '/';

export const MAIN_ROUTES = [
  { path: 'home', title: 'Home' },
  { path: 'background', title: 'Background' },
  { path: 'interests', title: 'Interests' },
  { path: 'projects', title: 'Projects' },
  { path: 'blog', title: 'Blog' },
] as const;

export type MainRoutePath = (typeof MAIN_ROUTES)[number]['path'];

export const MAIN_NAV_ROUTES = MAIN_ROUTES.map(({ path }) => `/${path}`);

export function getMainRouteAnimation(path: MainRoutePath): number {
  return MAIN_ROUTES.findIndex((route) => route.path === path) + 1;
}
