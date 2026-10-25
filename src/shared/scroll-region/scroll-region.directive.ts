import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { ScrollRegionService } from './scroll-region.service';

/**
 * Marks an element as the page's arrow-key scroll target. Pass `false` to
 * temporarily withdraw (e.g. a collapsed card); omit the value to always
 * register.
 */
@Directive({ selector: '[appScrollRegion]' })
export class ScrollRegionDirective {
  readonly appScrollRegion = input<boolean | ''>('');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly regions = inject(ScrollRegionService);

  constructor() {
    effect(onCleanup => {
      if (this.appScrollRegion() === false) return;
      this.regions.register(this.el);
      onCleanup(() => this.regions.unregister(this.el));
    });
  }
}
