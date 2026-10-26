import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';
import { isUnderConstruction } from '../../shared/constants/under-construction.const';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';

@Component({
  selector: 'app-blog-page',
  imports: [BasePageComponent, PageHeaderComponent, UnderConstructionComponent],
  templateUrl: './blog-page.component.html',
  styleUrl: './blog-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPageComponent {
  readonly underConstruction = isUnderConstruction('blog');
}
