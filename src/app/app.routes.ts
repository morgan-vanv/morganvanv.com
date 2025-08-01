import { Routes } from '@angular/router';
import { GreetingPageComponent } from './greeting-page/greeting-page.component';
import { HomePageComponent } from './home-page/home-page.component';
import { ProjectsPageComponent } from './projects-page/projects-page.component';
import { InterestsPageComponent } from './interests-page/interests-page.component';
import { BackgroundPageComponent } from './background-page/background-page.component';
import { BlogPageComponent } from './blog-page/blog-page.component';

export const routes: Routes = [
  {
    path: '',
    component: GreetingPageComponent,
    title: 'Greetings!',
    pathMatch: 'full',
    data: { animation: 'GreetingPage' }
  },
  {
    path: 'home',
    component: HomePageComponent,
    title: 'Home',
    data: { animation: 'HomePage' }
  },
  {
    path: 'background',
    component: BackgroundPageComponent,
    title: 'Background',
    data: { animation: 'BackgroundPage' }
  },
  {
    path: 'interests',
    component: InterestsPageComponent,
    title: 'Interests',
    data: { animation: 'InterestsPage' }
  },
  {
    path: 'projects',
    component: ProjectsPageComponent,
    title: 'Projects',
    data: { animation: 'ProjectsPage' }
  },
  {
    path: 'blog',
    component: BlogPageComponent,
    title: 'Blog',
    data: { animation: 'BlogPage' }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
