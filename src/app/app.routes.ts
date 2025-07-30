import { Routes } from '@angular/router';
import { GreetingPageComponent } from './greeting-page/greeting-page.component';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { ProjectsPageComponent } from './projects-page/projects-page.component';
import { InterestsPageComponent } from './interests-page/interests-page.component';

export const routes: Routes = [
  {
    path: '',
    component: GreetingPageComponent,
    title: 'Greetings!',
    pathMatch: 'full',
    data: { animation: 'GreetingPage' }
  },
  {
    path: 'landing',
    component: LandingPageComponent,
    title: 'About me',
    data: { animation: 'GreetingPage' }
  },
  {
    path: 'projects',
    component: ProjectsPageComponent,
    title: 'Projects',
    data: { animation: 'GreetingPage' }
  },
  {
    path: 'interests',
    component: InterestsPageComponent,
    title: 'Interests',
    data: { animation: 'GreetingPage' }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
