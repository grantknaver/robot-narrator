import { Route } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

import { LandingComponent } from './pages/landing/landing';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LayoutComponent,
    children: [{ path: '', pathMatch: 'full', component: LandingComponent }],
  },
];
