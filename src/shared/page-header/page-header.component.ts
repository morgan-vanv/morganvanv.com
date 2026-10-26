import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The compact header at the top of a page: the page's visible <h1>, a dim
 * one-line description, and an optional meta on the right ("updated …").
 * For a description with links in it, project `<span pageDescription>…</span>`
 * instead of passing `description`; project `<span pageMeta>` for the meta.
 */
@Component({
  selector: 'app-page-header',
  template: `
    <div class="text">
      <h1>{{ title() }}</h1>
      <p class="desc">@if (description(); as text) {{{ text }}}<ng-content select="[pageDescription]" /></p>
    </div>
    <div class="meta"><ng-content select="[pageMeta]" /></div>
  `,
  styleUrl: './page-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string>();
}
