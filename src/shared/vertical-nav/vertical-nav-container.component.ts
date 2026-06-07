import { Component, ContentChildren, QueryList, HostListener, forwardRef, ChangeDetectionStrategy, signal } from '@angular/core';
import { VerticalNavItemComponent } from './vertical-nav-item.component';

@Component({
  selector: 'app-vertical-nav-container',
  template: `<ng-content></ng-content>`,
  styleUrl: './vertical-nav-container.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerticalNavContainerComponent {
  @ContentChildren(forwardRef(() => VerticalNavItemComponent)) itemsList!: QueryList<VerticalNavItemComponent>;

  highlightedIndex = signal(0);
  isExpanded = signal(false);

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.isExpanded()) {
      if (event.key === 'Escape') {
        this.isExpanded.set(false);
        event.preventDefault();
      }
      return;
    }

    const itemsCount = this.itemsList?.length || 0;
    if (itemsCount === 0) return;

    if (event.key === 'ArrowUp') {
      this.highlightedIndex.update(i => Math.max(0, i - 1));
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      this.highlightedIndex.update(i => Math.min(itemsCount - 1, i + 1));
      event.preventDefault();
    } else if (event.key === 'Enter') {
      this.isExpanded.set(true);
      event.preventDefault();
    }
  }

  setHighlight(item: VerticalNavItemComponent) {
    const index = this.itemsList.toArray().indexOf(item);
    if (index !== -1) {
      this.highlightedIndex.set(index);
    }
  }

  expandItem(item: VerticalNavItemComponent) {
    this.setHighlight(item);
    this.isExpanded.set(true);
  }
}
