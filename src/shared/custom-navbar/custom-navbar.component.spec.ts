import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CustomNavbarComponent } from './custom-navbar.component';
import { MAIN_ROUTES, SIDE_ROUTES } from '../main-routes';

@Component({ template: '' })
class BlankComponent {}

describe('CustomNavbarComponent', () => {
  let fixture: ComponentFixture<CustomNavbarComponent>;
  let el: HTMLElement;

  const goTo = async (url: string) => {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  };
  const label = (selector: string) => el.querySelector(selector)?.getAttribute('aria-label');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomNavbarComponent],
      providers: [provideRouter([
        { path: '', component: BlankComponent },
        ...MAIN_ROUTES.map(({ path }) => ({ path, component: BlankComponent })),
        ...SIDE_ROUTES.map(({ path }) => ({ path, component: BlankComponent })),
      ])],
    }).compileComponents();

    fixture = TestBed.createComponent(CustomNavbarComponent);
    el = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('lists the greeting and every main page on the wide-screen line', () => {
    expect(el.querySelectorAll('.links a').length).toBe(MAIN_ROUTES.length + 1);
  });

  it('pages between neighbours, with the current page in the middle', async () => {
    await goTo('/now');
    expect(el.querySelector('.pager-current')?.textContent).toContain('[ Now ]');
    const arrows = [...el.querySelectorAll('.pager-arrow')].map(a => a.getAttribute('aria-label'));
    expect(arrows).toEqual(['Previous: Home', 'Next: Background']);
  });

  it('keeps a side page\'s parent lit, on the line and in the pager', async () => {
    const side = SIDE_ROUTES[0];
    const parent = MAIN_ROUTES.find(r => r.path === side.parent)!;
    await goTo(`/${side.path}`);
    expect(el.querySelector('.pager-current')?.textContent).toContain(`[ ${parent.title} ]`);
    const lit = [...el.querySelectorAll('.links a.active-link')].map(a => a.textContent?.trim());
    expect(lit).toEqual([parent.title]);
    // Lit, but not this page: aria-current says so.
    expect(el.querySelector('.links a.active-link')?.getAttribute('aria-current')).toBe('true');
    expect(el.querySelectorAll('.links a').length).toBe(MAIN_ROUTES.length + 1);

    await goTo(`/${parent.path}`);
    expect(el.querySelector('.links a.active-link')?.getAttribute('aria-current')).toBe('page');
  });

  it('goes back to the greeting from Home and has no next page on the last one', async () => {
    await goTo('/home');
    expect(label('.pager-arrow')).toBe('Previous: Greeting');

    await goTo(`/${MAIN_ROUTES.at(-1)!.path}`);
    const arrows = [...el.querySelectorAll('.pager-arrow')].map(a => a.getAttribute('aria-label'));
    expect(arrows).toEqual([`Previous: ${MAIN_ROUTES.at(-2)!.title}`]);
  });

  it('opens the page list with the current page marked, and closes it on Escape', async () => {
    await goTo('/social');
    const button = el.querySelector<HTMLButtonElement>('.pager-current')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const links = [...el.querySelectorAll('.page-list a')];
    expect(links.length).toBe(MAIN_ROUTES.length + 1);
    expect(links.filter(a => a.getAttribute('aria-current') === 'page').map(a => a.textContent?.trim())).toEqual(['[ Social ]']);

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    button.dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(el.querySelector('.page-list')).toBeNull();
  });

  it('closes the page list after navigating', async () => {
    await goTo('/home');
    el.querySelector<HTMLButtonElement>('.pager-current')!.click();
    await fixture.whenStable();
    await goTo('/now');
    expect(el.querySelector('.page-list')).toBeNull();
  });

  it('only points aria-controls at the page list while it exists, and hides the brackets from screen readers', async () => {
    await goTo('/now');
    const button = el.querySelector<HTMLButtonElement>('.pager-current')!;
    expect(button.getAttribute('aria-controls')).toBeNull();
    expect([...button.querySelectorAll('span[aria-hidden="true"]')].map(s => s.textContent?.trim())).toEqual(['[', ']']);
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-controls')).toBe('page-list');
  });

  it('closes the page list when focus leaves the navbar', async () => {
    await goTo('/home');
    el.querySelector<HTMLButtonElement>('.pager-current')!.click();
    await fixture.whenStable();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    el.querySelector('.page-list a')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
    await fixture.whenStable();
    expect(el.querySelector('.page-list')).toBeNull();
    outside.remove();
  });
});
