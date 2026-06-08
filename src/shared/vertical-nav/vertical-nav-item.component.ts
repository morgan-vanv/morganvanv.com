import { Component, Input, HostListener, inject, ChangeDetectionStrategy, computed, signal, DestroyRef, ElementRef } from '@angular/core';
import { VerticalNavContainerComponent } from './vertical-nav-container.component';
import { ScrollHintComponent } from '../scroll-hint/scroll-hint.component';

@Component({
  selector: 'app-vertical-nav-item',
  imports: [ScrollHintComponent],
  templateUrl: './vertical-nav-item.component.html',
  styleUrl: './vertical-nav-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.hidden-sibling]': 'isHiddenSibling()'
  }
})
export class VerticalNavItemComponent {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() isUnderConstruction = false;
  @Input() iconUrl?: string;

  isEscapeActive = signal(false);

  private container = inject(VerticalNavContainerComponent);
  private destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef);

  focus() {
    const wrapper = this.elementRef.nativeElement.querySelector('.item-card-wrapper');
    wrapper?.focus();
  }

  isHighlighted = computed(() => {
    const index = this.container.itemsList().indexOf(this);
    return index !== -1 && index === this.container.highlightedIndex();
  });

  isExpanded = computed(() => {
    return this.isHighlighted() && this.container.isExpanded();
  });

  isHiddenSibling = computed(() => {
    return this.container.isExpanded() && !this.isExpanded();
  });

  @HostListener('click')
  onClick() {
    this.container.expandItem(this);
  }

  @HostListener('mouseenter')
  onMouseEnter() {
    if (!this.isHighlighted()) {
      this.container.setHighlight(this);
    }
  }

  @HostListener('focusin')
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
    }, this.ANIMATION_DURATION_MS);
    this.destroyRef.onDestroy(() => window.clearTimeout(timeoutId));
  }

  onClose(event: MouseEvent) {
    event.stopPropagation();
    this.triggerClose();
  }
}
