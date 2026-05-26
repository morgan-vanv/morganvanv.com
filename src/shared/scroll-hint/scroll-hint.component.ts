import { Component, Input, OnChanges, OnDestroy, signal, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-scroll-hint',
  imports: [MatIconModule],
  templateUrl: './scroll-hint.component.html',
  styleUrl: './scroll-hint.component.scss',
})
export class ScrollHintComponent implements OnChanges, OnDestroy {
  @Input() scrollEl: HTMLElement | null = null;

  protected canScrollDown = signal(false);

  private readonly scrollHandler = () => this.checkScroll();
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private attachedEl: HTMLElement | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scrollEl']) {
      this.detach();
      this.attach(this.scrollEl);
    }
  }

  ngOnDestroy(): void {
    this.detach();
  }

  private attach(el: HTMLElement | null): void {
    if (!el) return;
    this.attachedEl = el;
    el.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.resizeObserver = new ResizeObserver(() => this.checkScroll());
    this.resizeObserver.observe(el);
    this.mutationObserver = new MutationObserver(() => this.checkScroll());
    this.mutationObserver.observe(el, { childList: true, subtree: true });
    this.checkScroll();
  }

  private detach(): void {
    if (this.attachedEl) {
      this.attachedEl.removeEventListener('scroll', this.scrollHandler);
      this.attachedEl = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
  }

  private checkScroll(): void {
    if (!this.attachedEl) {
      this.canScrollDown.set(false);
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = this.attachedEl;
    this.canScrollDown.set(scrollHeight - scrollTop - clientHeight > 8);
  }
}
