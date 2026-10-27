import { Component, inject, ChangeDetectionStrategy, computed, signal, DestroyRef, ElementRef, input } from '@angular/core';
import { VerticalNavContainerComponent } from './vertical-nav-container.component';
import { ScrollHintComponent } from '../scroll-hint/scroll-hint.component';
import { ScrollRegionDirective } from '../scroll-region/scroll-region.directive';

@Component({
  selector: 'app-vertical-nav-item',
  imports: [ScrollHintComponent, ScrollRegionDirective],
  templateUrl: './vertical-nav-item.component.html',
  styleUrl: './vertical-nav-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.hidden-sibling]': 'isHiddenSibling()',
    '(click)': 'onClick($event)',
    '(mouseenter)': 'onMouseEnter()',
    '(focusin)': 'onFocusIn()',
  }
})
export class VerticalNavItemComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly isUnderConstruction = input(false);
  readonly iconUrl = input<string>();

  readonly isEscapeActive = signal(false);

  private container = inject(VerticalNavContainerComponent);
  private destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);

  focus() {
    const wrapper = this.elementRef.nativeElement.querySelector('.item-card-wrapper');
    wrapper?.focus();
  }

  readonly isHighlighted = computed(() => {
    const index = this.container.itemsList().indexOf(this);
    return index !== -1 && index === this.container.highlightedIndex();
  });

  readonly isExpanded = computed(() => {
    return this.isHighlighted() && this.container.isExpanded();
  });

  readonly isHiddenSibling = computed(() => {
    return this.container.isExpanded() && !this.isExpanded();
  });

  onClick(event?: MouseEvent) {
    if (event) {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const interactiveEl = target.closest('a, button, input, select, textarea, [role="button"]');
        // Ignore the outer card wrapper itself, which has role="button" when collapsed
        const wrapper = this.elementRef.nativeElement.querySelector('.item-card-wrapper');
        if (interactiveEl && interactiveEl !== wrapper) {
          return;
        }
      }
    }
    this.container.expandItem(this);
  }

  onMouseEnter() {
    if (!this.isHighlighted()) {
      this.container.setHighlight(this);
    }
  }

  onFocusIn() {
    if (!this.isHighlighted()) {
      this.container.setHighlight(this);
    }
  }

  private readonly ANIMATION_DURATION_MS = 150;

  triggerClose() {
    this.isEscapeActive.set(true);
    const timeoutId = window.setTimeout(() => {
      this.container.isExpanded.set(false);
      this.isEscapeActive.set(false);
      this.focus();
    }, this.ANIMATION_DURATION_MS);
    this.destroyRef.onDestroy(() => window.clearTimeout(timeoutId));
  }

  onClose(event: MouseEvent) {
    event.stopPropagation();
    this.triggerClose();
  }
}
