import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';

@Component({
  selector: 'app-projects-page',
  imports: [BasePageComponent, UnderConstructionComponent],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsPageComponent {

}
