import { Component, HostListener, ChangeDetectionStrategy, signal, contentChildren } from '@angular/core';
import { VerticalNavItemComponent } from './vertical-nav-item.component';

@Component({
  selector: 'app-vertical-nav-container',
  template: `<ng-content></ng-content>`,
  styleUrl: './vertical-nav-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.has-expanded-item]': 'isExpanded()'
  }
})
export class VerticalNavContainerComponent {
  itemsList = contentChildren(VerticalNavItemComponent);

  highlightedIndex = signal(0);
  isExpanded = signal(false);

  @HostListener('document:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
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

    if (event.key === 'ArrowUp') {
      this.highlightedIndex.update(i => Math.max(0, i - 1));
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      this.highlightedIndex.update(i => Math.min(itemsCount - 1, i + 1));
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
