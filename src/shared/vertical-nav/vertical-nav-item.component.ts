import { Component, Input, HostListener, inject, ChangeDetectionStrategy, computed } from '@angular/core';
import { VerticalNavContainerComponent } from './vertical-nav-container.component';
import { ScrollHintComponent } from '../scroll-hint/scroll-hint.component';

@Component({
  selector: 'app-vertical-nav-item',
  imports: [ScrollHintComponent],
  templateUrl: './vertical-nav-item.component.html',
  styleUrl: './vertical-nav-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerticalNavItemComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() isUnderConstruction = false;
  @Input() iconUrl?: string;

  private container = inject(VerticalNavContainerComponent);

  isHighlighted = computed(() => {
    const index = this.container.itemsList().indexOf(this);
    return index !== -1 && index === this.container.highlightedIndex();
  });

  isExpanded = computed(() => {
    return this.isHighlighted() && this.container.isExpanded();
  });

  @HostListener('click')
  onClick() {
    this.container.expandItem(this);
  }

  @HostListener('mousemove')
  onMouseMove() {
    this.container.setHighlight(this);
  }
}
