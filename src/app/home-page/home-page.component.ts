import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { ScrollHintComponent } from '../../shared/scroll-hint/scroll-hint.component';
import { SOCIAL_LINKS } from '../../shared/constants/social-links.const';
import { AskMorganFormComponent } from './ask-morgan-form/ask-morgan-form';
import { ScrollRegionDirective } from '../../shared/scroll-region/scroll-region.directive';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  imports: [BasePageComponent, ScrollHintComponent, AskMorganFormComponent, ScrollRegionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  readonly socialLinks = SOCIAL_LINKS;
}

