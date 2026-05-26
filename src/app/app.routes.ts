import { Type } from '@angular/core';
import { Routes } from '@angular/router';
import { GreetingPageComponent } from './greeting-page/greeting-page.component';
import { HomePageComponent } from './home-page/home-page.component';
import { ProjectsPageComponent } from './projects-page/projects-page.component';
import { InterestsPageComponent } from './interests-page/interests-page.component';
import { BackgroundPageComponent } from './background-page/background-page.component';
import { BlogPageComponent } from './blog-page/blog-page.component';
import { GREETING_ROUTE_PATH, MAIN_ROUTES, MainRoutePath, getMainRouteAnimation } from '../shared/main-routes';

const mainRouteComponents: Record<MainRoutePath, Type<unknown>> = {
  home: HomePageComponent,
  background: BackgroundPageComponent,
  interests: InterestsPageComponent,
  projects: ProjectsPageComponent,
  blog: BlogPageComponent,
};

export const routes: Routes = [
  {
    path: GREETING_ROUTE_PATH,
    component: GreetingPageComponent,
    title: 'Greetings!',
    pathMatch: 'full',
    data: { animation: 0 },
  },
  ...MAIN_ROUTES.map((route) => ({
    path: route.path,
    component: mainRouteComponents[route.path],
    title: route.title,
    data: { animation: getMainRouteAnimation(route.path) },
  })),
  {
    path: '**',
    redirectTo: GREETING_ROUTE_PATH,
  },
];
