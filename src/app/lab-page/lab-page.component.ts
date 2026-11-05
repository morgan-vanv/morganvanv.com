import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { isUnderConstruction } from '../../shared/constants/under-construction.const';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';

/** /lab, off the homelab's poster on Projects: the machines in Morgan's closet. A stub for now. */
@Component({
  selector: 'app-lab-page',
  imports: [BasePageComponent, PageHeaderComponent, UnderConstructionComponent],
  templateUrl: './lab-page.component.html',
  styleUrl: './lab-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabPageComponent {
  readonly underConstruction = isUnderConstruction('lab');
}
