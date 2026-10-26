import { Component, ChangeDetectionStrategy } from '@angular/core';
import { BasePageComponent } from '../../shared/base-page/base-page.component';
import { SOCIAL_LINKS } from '../../shared/constants/social-links.const';
import { AskMorganFormComponent } from './ask-morgan-form/ask-morgan-form';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  imports: [BasePageComponent, AskMorganFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  readonly socialLinks = SOCIAL_LINKS;
}
