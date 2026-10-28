import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { SITE_CONFIG } from '../../shared/config/site.config';
import { BUILD_INFO } from '../../build-info';

/**
 * The colophon: how the site is built, what powers each live panel, what stays in a visitor's
 * browser, and who to thank. Off the navbar; reached from the site's own poster on /projects.
 * Every fact here mirrors the code (site.config.ts, the badges, humans.txt): keep them in step.
 */
@Component({
  selector: 'app-colophon-page',
  imports: [BasePageComponent, PageHeaderComponent, RouterLink],
  templateUrl: './colophon-page.component.html',
  styleUrl: './colophon-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColophonPageComponent {
  readonly config = SITE_CONFIG;
  readonly build = BUILD_INFO;
}
