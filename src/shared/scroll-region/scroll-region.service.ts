import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks which element should receive arrow-key scrolling on the current
 * page. Elements register through the ScrollRegionDirective. The innermost
 * registered element wins (a region nested inside another region beats its
 * ancestor), and among unrelated regions the most recently registered wins.
 */
@Injectable({ providedIn: 'root' })
export class ScrollRegionService {
  private readonly regions = signal<HTMLElement[]>([]);

  /** The element arrow keys should scroll, or null if nothing is registered. */
  readonly active = computed(() => {
    const list = this.regions();
    const leaves = list.filter(el => !list.some(other => other !== el && el.contains(other)));
    return leaves.at(-1) ?? null;
  });

  register(el: HTMLElement): void {
    this.regions.update(list => list.includes(el) ? list : [...list, el]);
  }

  unregister(el: HTMLElement): void {
    this.regions.update(list => list.filter(item => item !== el));
  }
}
