import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { SkyService } from '../shared/sky/sky.service';
import { VerticalNavContainerComponent } from '../shared/vertical-nav/vertical-nav-container.component';
import { VerticalNavItemComponent } from '../shared/vertical-nav/vertical-nav-item.component';
import { ScrollRegionDirective } from '../shared/scroll-region/scroll-region.directive';

/** A stand-in for /interests: a scroll region holding the tiles. */
@Component({
  selector: 'app-tiles-page',
  imports: [VerticalNavContainerComponent, VerticalNavItemComponent, ScrollRegionDirective],
  template: `
    <div class="page-content" appScrollRegion>
      <app-vertical-nav-container>
        <app-vertical-nav-item title="One"><p>one</p></app-vertical-nav-item>
        <app-vertical-nav-item title="Two"><p>two</p></app-vertical-nav-item>
      </app-vertical-nav-container>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TilesPageComponent {}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([{ path: 'interests', component: TilesPageComponent }]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('looking up makes the page inert, and keys no longer reach it (no tile moves or opens, nothing scrolls)', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/interests');
    await fixture.whenStable();
    const sky = TestBed.inject(SkyService);
    const el: HTMLElement = fixture.nativeElement;
    document.body.append(el);
    const main = el.querySelector('main')!;
    const tiles = fixture.debugElement.query(d => d.componentInstance instanceof VerticalNavContainerComponent)
      .componentInstance as VerticalNavContainerComponent;
    const region = el.querySelector<HTMLElement>('.page-content')!;
    const scrollBy = vi.fn();
    region.scrollBy = scrollBy;
    const press = (key: string) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event;
    };

    sky.enterLookUp();
    await fixture.whenStable();
    expect(main.hasAttribute('inert')).toBe(true);
    expect(main.classList).toContain('looking-up');
    (document.activeElement as HTMLElement | null)?.blur();
    for (const key of ['ArrowDown', 'ArrowDown', 'Enter', ' ', 'ArrowUp']) expect(press(key).defaultPrevented, key).toBe(false);
    expect(tiles.highlightedIndex()).toBe(0);
    expect(tiles.isExpanded()).toBe(false);
    expect(scrollBy).not.toHaveBeenCalled();

    // Back to the page: the tiles take keys again.
    sky.leaveLookUp();
    await fixture.whenStable();
    expect(main.hasAttribute('inert')).toBe(false);
    press('ArrowDown');
    expect(tiles.highlightedIndex()).toBe(1);
    el.remove();
  });
});
