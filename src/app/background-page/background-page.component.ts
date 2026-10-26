import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { PageHeaderComponent } from '../../shared/page-header/page-header.component';

@Component({
  selector: 'app-background-page',
  imports: [BasePageComponent, PageHeaderComponent],
  templateUrl: './background-page.component.html',
  styleUrl: './background-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackgroundPageComponent {}
