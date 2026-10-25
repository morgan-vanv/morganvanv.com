import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { KeyboardNavService } from './keyboard-nav.service';
import { ScrollRegionService } from '../scroll-region/scroll-region.service';
import { MAIN_NAV_ROUTES } from '../main-routes';

function key(name: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: name, cancelable: true, ...init });
}

describe('KeyboardNavService', () => {
  let service: KeyboardNavService;
  let router: Router;
  let navigate: ReturnType<typeof vi.spyOn>;
  let url = '/';

  beforeEach(() => {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  router = TestBed.inject(Router);
  vi.spyOn(router, 'url', 'get').mockImplementation(() => url);
  navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  service = TestBed.inject(KeyboardNavService);
  url = '/';
  });

  it('leaves the greeting page on any arrow key', () => {
  url = '/';
  service.onKeyDown(key('ArrowDown'));
  expect(navigate).toHaveBeenCalledWith([MAIN_NAV_ROUTES[0]]);
  });

  it('moves to the next and previous main page with Left/Right', () => {
  url = MAIN_NAV_ROUTES[1];
  service.onKeyDown(key('ArrowRight'));
  expect(navigate).toHaveBeenLastCalledWith([MAIN_NAV_ROUTES[2]]);
  service.onKeyDown(key('ArrowLeft'));
  expect(navigate).toHaveBeenLastCalledWith([MAIN_NAV_ROUTES[0]]);
  });

  it('does not go past either end of the route list', () => {
  url = MAIN_NAV_ROUTES[0];
  service.onKeyDown(key('ArrowLeft'));
  url = MAIN_NAV_ROUTES[MAIN_NAV_ROUTES.length - 1];
  service.onKeyDown(key('ArrowRight'));
  expect(navigate).not.toHaveBeenCalled();
  });

  it('returns to the greeting on Escape', () => {
  url = MAIN_NAV_ROUTES[2];
  service.onKeyDown(key('Escape'));
  expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('ignores keys with modifiers and already-handled events', () => {
  url = MAIN_NAV_ROUTES[1];
  service.onKeyDown(key('ArrowRight', { ctrlKey: true }));
  service.onKeyDown(key('ArrowRight', { metaKey: true }));
  const handled = key('ArrowRight');
  handled.preventDefault();
  service.onKeyDown(handled);
  expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores keys while typing in a form field', () => {
  url = MAIN_NAV_ROUTES[1];
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  textarea.focus();
  service.onKeyDown(key('ArrowRight'));
  expect(navigate).not.toHaveBeenCalled();
  textarea.remove();
  });

  it('scrolls the active scroll region with Up/Down', () => {
  url = MAIN_NAV_ROUTES[1];
  const region = document.createElement('div');
  const scrollBy = vi.fn();
  region.scrollBy = scrollBy;
  TestBed.inject(ScrollRegionService).register(region);

  const down = key('ArrowDown');
  service.onKeyDown(down);
  expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: 120 }));
  expect(down.defaultPrevented).toBe(true);

  service.onKeyDown(key('ArrowUp'));
  expect(scrollBy).toHaveBeenLastCalledWith(expect.objectContaining({ top: -120 }));
  expect(navigate).not.toHaveBeenCalled();
  });
});
