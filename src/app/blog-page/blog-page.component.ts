import { Component } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { UnderConstructionComponent } from '../../shared/under-construction/under-construction.component';

@Component({
  selector: 'app-blog-page',
  imports: [BasePageComponent, UnderConstructionComponent],
  templateUrl: './blog-page.component.html',
  styleUrl: './blog-page.component.scss'
})
export class BlogPageComponent {

}
