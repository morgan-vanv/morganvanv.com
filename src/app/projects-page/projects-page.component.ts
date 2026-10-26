import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { isUnderConstruction } from '../../shared/constants/under-construction.const';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';

@Component({
  selector: 'app-projects-page',
  imports: [BasePageComponent, PageHeaderComponent, UnderConstructionComponent],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {
  readonly underConstruction = isUnderConstruction('projects');
}
