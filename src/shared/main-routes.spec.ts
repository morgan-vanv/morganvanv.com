import { MAIN_ROUTES, MAIN_NAV_ROUTES, getMainRouteAnimation } from './main-routes';
import { routes } from '../app/app.routes';
import { NAV_LINKS } from './custom-navbar/custom-navbar.component';

describe('MAIN_ROUTES', () => {
  it('every main route has a lazy component and an animation index', () => {
  for (const { path } of MAIN_ROUTES) {
  const route = routes.find(r => r.path === path);
  expect(route?.loadComponent, path).toBeDefined();
  expect(route?.data?.['animation']).toBe(getMainRouteAnimation(path));
  }
  });

  it('the navbar lists the greeting followed by every main route, in order', () => {
  expect(NAV_LINKS.map(l => l.route)).toEqual(['/', ...MAIN_NAV_ROUTES]);
  });

  it('every main route has a title and a description', () => {
  for (const route of MAIN_ROUTES) {
  expect(route.title.length).toBeGreaterThan(0);
  expect(route.description.length).toBeGreaterThan(20);
  }
  });

  it('animation indexes are 1-based and unique', () => {
  const indexes = MAIN_ROUTES.map(r => getMainRouteAnimation(r.path));
  expect(indexes).toEqual(MAIN_ROUTES.map((_, i) => i + 1));
  });
});
