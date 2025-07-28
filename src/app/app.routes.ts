import { Routes } from '@angular/router';
import { GreetingPageComponent } from './greeting-page/greeting-page.component';
import { LandingPageComponent } from './landing-page/landing-page.component';

export const routes: Routes = [
  {
    path: '',
    component: GreetingPageComponent,
    title: 'Greetings!',
    pathMatch: 'full'
  },
  {
    path: 'landing',
    component: LandingPageComponent,
    title: 'About me'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
