import { animate, group, query, style, transition, trigger } from '@angular/animations';

const positioned = query(':enter, :leave', [
  style({ position: 'absolute', width: '100%', height: '100%' })
], { optional: true });

const verticalTransition = [
  positioned,
  group([
    query(':leave', [
      animate('500ms ease-in-out', style({ opacity: 0, transform: 'translateY(-120vh)' }))
    ], { optional: true }),
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(120vh)' }),
      animate('500ms ease-in-out', style({ opacity: 1, transform: 'translateY(0)' }))
    ], { optional: true }),
  ])
];

const slideRightTransition = [
  positioned,
  group([
    query(':leave', [
      animate('400ms ease-in-out', style({ opacity: 0, transform: 'translateX(-100%)' }))
    ], { optional: true }),
    query(':enter', [
      style({ opacity: 0, transform: 'translateX(100%)' }),
      animate('400ms ease-in-out', style({ opacity: 1, transform: 'translateX(0)' }))
    ], { optional: true }),
  ])
];

const slideLeftTransition = [
  positioned,
  group([
    query(':leave', [
      animate('400ms ease-in-out', style({ opacity: 0, transform: 'translateX(100%)' }))
    ], { optional: true }),
    query(':enter', [
      style({ opacity: 0, transform: 'translateX(-100%)' }),
      animate('400ms ease-in-out', style({ opacity: 1, transform: 'translateX(0)' }))
    ], { optional: true }),
  ])
];

export const defaultRouteTransition = trigger('routeAnimations', [
  // Greeting page (index 0) always slides vertically — checked before :increment/:decrement
  transition('0 => *', verticalTransition),
  transition('* => 0', verticalTransition),

  // Main pages (1–5) slide horizontally based on index direction
  transition(':increment', slideRightTransition),
  transition(':decrement', slideLeftTransition),
]);
