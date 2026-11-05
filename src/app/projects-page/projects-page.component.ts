import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { PROJECTS } from '../../shared/constants/projects.const';
import { ProjectPosterComponent } from '../../shared/project-poster/project-poster.component';
import { NextProjectSlotComponent, nextSlotSpan } from './next-project-slot/next-project-slot';

/** Posters across on wide screens (the grid reads it as --columns). */
const COLUMNS = 3;

/**
 * The showcase: every project as a poster, three across, one column on tablets and phones, and an
 * empty "next project" slot filling the rest of the last row.
 */
@Component({
  selector: 'app-projects-page',
  imports: [BasePageComponent, PageHeaderComponent, ProjectPosterComponent, NextProjectSlotComponent],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  readonly projects = PROJECTS;
  readonly columns = COLUMNS;
  readonly slotSpan = nextSlotSpan(PROJECTS.length, COLUMNS);
  /** "Five so far, none of them finished." Approved by Morgan (2026-10-28); counts itself so it can't drift. */
  readonly countLine = `${COUNT_WORDS[PROJECTS.length] ?? PROJECTS.length} so far, none of them finished.`;
}

const COUNT_WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
