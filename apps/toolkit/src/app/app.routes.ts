import { Route } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { LandingComponent } from './pages/landing/landing';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      { path: '', pathMatch: 'full', component: LandingComponent },
      // {
      //   path: '',
      //   pathMatch: 'full',
      //   loadComponent: () =>
      //     import('./pages/home/home.component').then((m) => m.HomeComponent),
      // },
      {
        path: 'home',
        loadComponent: () =>
          import('./pages/home/home.component').then((m) => m.HomeComponent),
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
