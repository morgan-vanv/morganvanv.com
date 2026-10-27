import { Component, ChangeDetectionStrategy, signal, contentChildren, ElementRef, inject } from '@angular/core';
import { VerticalNavItemComponent } from './vertical-nav-item.component';

@Component({
  selector: 'app-vertical-nav-container',
  template: `<ng-content />`,
  styleUrl: './vertical-nav-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'handleKeyDown($event)',
  }
})
export class VerticalNavContainerComponent {
  private readonly elementRef = inject(ElementRef);
  readonly itemsList = contentChildren(VerticalNavItemComponent);

  readonly highlightedIndex = signal(0);
  readonly isExpanded = signal(false);

  focusHighlightedItem() {
    setTimeout(() => {
      const activeItem = this.itemsList()[this.highlightedIndex()];
      activeItem?.focus();
    }, 0);
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      if (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) return;
      if (active.closest('a, button')) return;
    }

    const target = event.target;
    if (target !== document.body && (!(target instanceof HTMLElement) || !this.elementRef.nativeElement.contains(target))) {
      return;
    }

    if (this.isExpanded()) {
      if (event.key === 'Escape') {
        this.collapseActiveItem();
        event.preventDefault();
      }
      return;
    }

    const items = this.itemsList();
    const itemsCount = items.length;
    if (itemsCount === 0) return;

    // ↑/↓ walk the tiles in reading order, even laid out two across: ← → belong
    // to page navigation, so this is the only way arrow keys reach every tile.
    if (event.key === 'ArrowUp') {
      this.highlightedIndex.update(i => Math.max(0, i - 1));
      this.focusHighlightedItem();
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      this.highlightedIndex.update(i => Math.min(itemsCount - 1, i + 1));
      this.focusHighlightedItem();
      event.preventDefault();
    } else if (event.key === 'Enter' || event.key === ' ') {
      this.isExpanded.set(true);
      event.preventDefault();
    }
  }

  setHighlight(item: VerticalNavItemComponent) {
    const index = this.itemsList().indexOf(item);
    if (index !== -1) {
      this.highlightedIndex.set(index);
    }
  }

  expandItem(item: VerticalNavItemComponent) {
    this.setHighlight(item);
    this.isExpanded.set(true);
  }

  collapseActiveItem() {
    const activeItem = this.itemsList()[this.highlightedIndex()];
    if (activeItem) {
      activeItem.triggerClose();
    } else {
      this.isExpanded.set(false);
    }
  }
}
