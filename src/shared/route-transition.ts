import { animate, group, query, style, transition, trigger } from '@angular/animations';

export const defaultRouteTransition = trigger('routeAnimations', [
  // whenever the route state changes in either direction...
  transition('* <=> *', [
    // position new and old views absolutely
    query(':enter, :leave', [
      style({ position: 'absolute', width: '100%' })
    ], { optional: true }),

    group([
      // animate the old view out
      query(':leave', [
        animate('500ms ease-in-out', style({ opacity: 0, transform: 'translateY(-120vh)' }))
      ], { optional: true }),

      // animate the new view in
      query(':enter', [
        style({ opacity: 0, transform: 'translateY(120vh)' }),
        animate('500ms ease-in-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ], { optional: true }),
    ])
  ])
]);
