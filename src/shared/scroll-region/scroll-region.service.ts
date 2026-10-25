import { Injectable, signal } from '@angular/core';

/**
 * Tracks which element should receive arrow-key scrolling on the current
 * page. Elements register through the ScrollRegionDirective; the most
 * recently registered one wins, so a nested region (an expanded Interests
 * card) takes precedence over the page shell.
 */
@Injectable({ providedIn: 'root' })
export class ScrollRegionService {
  private readonly regions = signal<HTMLElement[]>([]);

  /** The element arrow keys should scroll, or null if nothing is registered. */
  readonly active = () => this.regions().at(-1) ?? null;

  register(el: HTMLElement): void {
    this.regions.update(list => list.includes(el) ? list : [...list, el]);
  }

  unregister(el: HTMLElement): void {
    this.regions.update(list => list.filter(item => item !== el));
  }
}
