import { Route } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from './guards/auth.guard';
import { LandingComponent } from './pages/landing/landing';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', pathMatch: 'full', component: LandingComponent },
      {
        path: 'userdashboard',
        loadComponent: () =>
          import('./pages/user-dashboard/user-dashboard.component').then(
            (m) => m.UserDashboardComponent
          ),
        canActivate: [authGuard],
      },
      {
        path: 'about',
        loadComponent: () =>
          import('./pages/about/about.component').then((m) => m.AboutComponent),
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./pages/contact/contact.component').then(
            (m) => m.ContactComponent
          ),
      },
    ],
  },
];
