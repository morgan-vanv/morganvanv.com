import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PROJECTS } from '../../shared/constants/projects.const';
import { ProjectPosterComponent } from '../../shared/project-poster/project-poster.component';

/** The showcase: every project as a poster, three across, one column on tablets and phones. */
@Component({
  selector: 'app-projects-page',
  imports: [BasePageComponent, PageHeaderComponent, ProjectPosterComponent],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  readonly projects = PROJECTS;
}
