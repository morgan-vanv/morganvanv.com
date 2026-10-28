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
  /** "Three so far, none of them finished." Draft; counts itself so it can't drift. */
  readonly countLine = `${COUNT_WORDS[PROJECTS.length] ?? PROJECTS.length} so far, none of them finished.`;
}

const COUNT_WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
