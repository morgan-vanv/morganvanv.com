import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerticalNavContainerComponent } from './vertical-nav-container.component';
import { VerticalNavItemComponent } from './vertical-nav-item.component';

@Component({
  imports: [VerticalNavContainerComponent, VerticalNavItemComponent],
  template: `
    <app-vertical-nav-container>
      <app-vertical-nav-item title="One" subtitle="first sub" status="live" [inside]="['songs', 'albums']" openLabel="put it on">
        <span art class="one-art"></span>
        <span preview>first preview</span>
        <span description>first <a href="#">link</a></span>
        <p>one</p>
      </app-vertical-nav-item>
      <app-vertical-nav-item title="Two"><p>two</p></app-vertical-nav-item>
      <app-vertical-nav-item title="Three" [isUnderConstruction]="true" />
    </app-vertical-nav-container>
  `,
})
class HostComponent {}

function keydown(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
  document.body.dispatchEvent(event);
  return event;
}

describe('Vertical nav', () => {
  let fixture: ComponentFixture<HostComponent>;
  let container: VerticalNavContainerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    container = fixture.debugElement.children[0].componentInstance as VerticalNavContainerComponent;
    (document.activeElement as HTMLElement | null)?.blur();
  });

  it('starts with the first item highlighted and nothing expanded', () => {
    expect(container.highlightedIndex()).toBe(0);
    expect(container.isExpanded()).toBe(false);
  });

  it('shows a collapsed item as a poster: art, plate, status, live line, what is inside and what pressing does', () => {
    const tile = (fixture.nativeElement as HTMLElement).querySelector('app-vertical-nav-item')!;
    expect(tile.querySelector('.tile-art .one-art')).not.toBeNull();
    expect(tile.querySelector('.status')?.textContent?.trim()).toBe('live');
    expect(tile.querySelector('.plate .name')?.textContent?.trim()).toBe('One');
    expect(tile.querySelector('.plate .subtitle')?.textContent?.trim()).toBe('first sub');
    expect(tile.querySelector('.tile-live')?.textContent?.trim()).toBe('first preview');
    expect([...tile.querySelectorAll('.tile-inside li')].map(li => li.textContent?.trim())).toEqual(['songs', 'albums']);
    expect(tile.querySelector('.tile-open')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('[ put it on › ]');
    // Its links wait for the open section: nothing focusable inside the tile, which is itself the button.
    expect(tile.querySelector('a')).toBeNull();
    expect(tile.textContent).not.toContain('first link');
  });

  it('leaves out the status pill and the inside list when an item has none', () => {
    const tiles = (fixture.nativeElement as HTMLElement).querySelectorAll('app-vertical-nav-item');
    expect(tiles[1].querySelector('.status')).toBeNull();
    expect(tiles[1].querySelector('.tile-inside')).toBeNull();
    expect(tiles[1].querySelector('.tile-open')?.textContent).toContain('open ›');
  });

  it('shows the description and its links once open, and the poster no more', async () => {
    keydown('Enter');
    await fixture.whenStable();
    const tile = (fixture.nativeElement as HTMLElement).querySelector('app-vertical-nav-item')!;
    expect(tile.querySelector('.item-header a')?.textContent).toBe('link');
    expect(tile.querySelector('.tile')).toBeNull();
  });

  it('moves the highlight with Up/Down and clamps at the ends', () => {
    keydown('ArrowDown');
    keydown('ArrowDown');
    keydown('ArrowDown');
    expect(container.highlightedIndex()).toBe(2);
    keydown('ArrowUp');
    expect(container.highlightedIndex()).toBe(1);
  });

  it('expands with Enter and renders only that item\'s content', async () => {
    keydown('ArrowDown');
    keydown('Enter');
    await fixture.whenStable();
    expect(container.isExpanded()).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('two');
    expect(text).not.toContain('one');
  });

  it('shows the construction notice instead of content for stubbed items', async () => {
    keydown('ArrowDown');
    keydown('ArrowDown');
    keydown(' ');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('UNDER CONSTRUCTION');
  });

  it('collapses with Escape after the close animation', async () => {
    keydown('Enter');
    await fixture.whenStable();
    expect(container.isExpanded()).toBe(true);
    keydown('Escape');
    expect(container.isExpanded()).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(container.isExpanded()).toBe(false);
  });

  it('ignores arrow keys while an item is expanded', async () => {
    keydown('Enter');
    await fixture.whenStable();
    keydown('ArrowDown');
    expect(container.highlightedIndex()).toBe(0);
  });

  it('ignores keys while the page is hidden (inert, as when looking up at the sky)', async () => {
    const host: HTMLElement = fixture.nativeElement;
    host.setAttribute('inert', '');
    keydown('ArrowDown');
    expect(container.highlightedIndex()).toBe(0);
    const enter = keydown('Enter');
    expect(container.isExpanded()).toBe(false);
    expect(enter.defaultPrevented).toBe(false);
    host.removeAttribute('inert');
    keydown('ArrowDown');
    expect(container.highlightedIndex()).toBe(1);
  });
});
