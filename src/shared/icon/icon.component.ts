import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The handful of glyphs the site needs, inlined as SVG paths so no icon font
 * has to be shipped. Paths are from Material Design Icons (Apache-2.0).
 */
const ICON_PATHS = {
  'chevron-down': 'M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z',
  'chevron-left': 'M15.41 16.59 10.83 12l4.58-4.59L14 6l-6 6 6 6z',
  'chevron-right': 'M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z',
  'exit': 'M10.09 15.59 11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
} as const;

export type IconName = keyof typeof ICON_PATHS;

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1em;
      height: 1em;
      line-height: 1;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  protected readonly path = computed(() => ICON_PATHS[this.name()]);
}
