import { Route } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./pages/landing/landing').then((c) => c.LandingComponent),
      },
    ],
  },
];
