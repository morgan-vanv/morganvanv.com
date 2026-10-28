import { Routes, Route } from '@angular/router';
import { GREETING_ROUTE_PATH, MAIN_ROUTES, MainRoutePath, SIDE_ROUTES, SideRoutePath, getMainRouteAnimation, getSideRouteAnimation } from '../shared/main-routes';

const lazyRouteComponents: Record<MainRoutePath, Route['loadComponent']> = {
  home: () => import('./home-page/home-page.component').then(m => m.HomePageComponent),
  now: () => import('./now-page/now-page.component').then(m => m.NowPageComponent),
  background: () => import('./background-page/background-page.component').then(m => m.BackgroundPageComponent),
  social: () => import('./social-page/social-page.component').then(m => m.SocialPageComponent),
  interests: () => import('./interests-page/interests-page.component').then(m => m.InterestsPageComponent),
  projects: () => import('./projects-page/projects-page.component').then(m => m.ProjectsPageComponent),
  blog: () => import('./blog-page/blog-page.component').then(m => m.BlogPageComponent),
};

const lazySideRouteComponents: Record<SideRoutePath, Route['loadComponent']> = {
  colophon: () => import('./colophon-page/colophon-page.component').then(m => m.ColophonPageComponent),
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
    data: { animation: getMainRouteAnimation(route.path), description: route.description },
  })),
  ...SIDE_ROUTES.map((route) => ({
    path: route.path,
    loadComponent: lazySideRouteComponents[route.path],
    title: route.title,
    data: { animation: getSideRouteAnimation(route.path), description: route.description },
  })),
  {
    path: '**',
    redirectTo: GREETING_ROUTE_PATH,
  },
];

