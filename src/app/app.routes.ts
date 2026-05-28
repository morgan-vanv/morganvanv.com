import { Routes, Route } from '@angular/router';
import { GREETING_ROUTE_PATH, MAIN_ROUTES, MainRoutePath, getMainRouteAnimation } from '../shared/main-routes';

const lazyRouteComponents: Record<MainRoutePath, Route['loadComponent']> = {
  home: () => import('./home-page/home-page.component').then(m => m.HomePageComponent),
  background: () => import('./background-page/background-page.component').then(m => m.BackgroundPageComponent),
  interests: () => import('./interests-page/interests-page.component').then(m => m.InterestsPageComponent),
  projects: () => import('./projects-page/projects-page.component').then(m => m.ProjectsPageComponent),
  blog: () => import('./blog-page/blog-page.component').then(m => m.BlogPageComponent),
};

export const routes: Routes = [
  {
    path: GREETING_ROUTE_PATH,
    loadComponent: () => import('./greeting-page/greeting-page.component').then(m => m.GreetingPageComponent),
    title: 'Greetings!',
    pathMatch: 'full',
    data: { animation: 0 },
  },
  ...MAIN_ROUTES.map((route) => ({
    path: route.path,
    loadComponent: lazyRouteComponents[route.path],
    title: route.title,
    data: { animation: getMainRouteAnimation(route.path) },
  })),
  {
    path: '**',
    redirectTo: GREETING_ROUTE_PATH,
  },
];

