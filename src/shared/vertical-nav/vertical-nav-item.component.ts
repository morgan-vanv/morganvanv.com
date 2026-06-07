import { Component, Input, HostListener, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { VerticalNavContainerComponent } from './vertical-nav-container.component';

@Component({
  selector: 'app-vertical-nav-item',
  templateUrl: './vertical-nav-item.component.html',
  styleUrl: './vertical-nav-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerticalNavItemComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() isUnderConstruction = false;

  private container = inject(VerticalNavContainerComponent);

  isHighlighted = computed(() => {
    const index = this.container.itemsList?.toArray().indexOf(this);
    return index !== -1 && index === this.container.highlightedIndex();
  });

  isExpanded = computed(() => {
    return this.isHighlighted() && this.container.isExpanded();
  });

  @HostListener('click')
  onClick() {
    this.container.expandItem(this);
  }

  @HostListener('mouseenter')
  onHover() {
    this.container.setHighlight(this);
  }
}
