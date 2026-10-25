import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

const SCROLL_THRESHOLD_PX = 8;

/** A bouncing chevron shown while the given element can still scroll down. */
@Component({
  selector: 'app-scroll-hint',
  imports: [IconComponent],
  templateUrl: './scroll-hint.component.html',
  styleUrl: './scroll-hint.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollHintComponent {
  readonly scrollEl = input<HTMLElement | null>(null);

  protected readonly canScrollDown = signal(false);

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(onCleanup => {
      const el = this.scrollEl();
      if (!el) {
        this.canScrollDown.set(false);
        return;
      }
      const check = () => {
        const { scrollTop, scrollHeight, clientHeight } = el;
        this.canScrollDown.set(scrollHeight - scrollTop - clientHeight > SCROLL_THRESHOLD_PX);
      };
      el.addEventListener('scroll', check, { passive: true });
      const resizeObserver = new ResizeObserver(check);
      resizeObserver.observe(el);
      const mutationObserver = new MutationObserver(check);
      mutationObserver.observe(el, { childList: true, subtree: true });
      check();
      const cleanup = () => {
        el.removeEventListener('scroll', check);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      };
      onCleanup(cleanup);
      destroyRef.onDestroy(cleanup);
    });
  }
}
