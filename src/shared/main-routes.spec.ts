import { MAIN_ROUTES, MAIN_NAV_ROUTES, SIDE_ROUTES, getMainRouteAnimation, getSideRouteAnimation, navRouteFor } from './main-routes';
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

  it('side routes hang off a main route, with a lazy component and a slot just past their parent', () => {
    for (const side of SIDE_ROUTES) {
      expect(MAIN_ROUTES.map(r => r.path)).toContain(side.parent);
      expect(side.title.length).toBeGreaterThan(0);
      expect(side.description.length).toBeGreaterThan(20);
      const route = routes.find(r => r.path === side.path);
      expect(route?.loadComponent, side.path).toBeDefined();
      expect(route?.data?.['animation']).toBe(getMainRouteAnimation(side.parent) + 0.5);
      expect(getSideRouteAnimation(side.path)).toBe(getMainRouteAnimation(side.parent) + 0.5);
      expect(navRouteFor(`/${side.path}`)).toBe(`/${side.parent}`);
    }
    expect(navRouteFor('/now')).toBe('/now');
    expect(navRouteFor('/')).toBe('/');
    // Side pages stay off the navbar.
    for (const side of SIDE_ROUTES) expect(NAV_LINKS.map(l => l.route)).not.toContain(`/${side.path}`);
  });
});
