import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A red sash across the top-right corner of a project's art ("new · v5"), for a project that just had
 * a big update. Used by the /now card and the /projects poster, so the two always match. Place it
 * inside the art's box, which must be `position: relative` and clip its overflow (the sash's ends run
 * past the corner). It's decoration: hidden from screen readers, so the host says the same words
 * beside the project's name (a visually-hidden span in its heading).
 */
@Component({
  selector: 'app-project-ribbon',
  template: '<span class="sash">{{ text() }}</span>',
  styleUrl: './project-ribbon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class ProjectRibbonComponent {
  readonly text = input.required<string>();
}
