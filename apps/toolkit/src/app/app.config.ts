import {
  ApplicationConfig,
  isDevMode,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { appRoutes } from './app.routes';
import { provideStore, provideState } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { appReducer } from './state/app.reducer';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { AppEffects } from './state/app.effects';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeng/themes/lara';
console.log('Aura preset present?', !!Lara); // should log true
import { HTTP_INTERCEPTORS, provideHttpClient } from '@angular/common/http';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthErrorInterceptor } from './interceptors/auth-error.interceptor';
import { authReducer } from './state/auth/auth.reducer';
import { AuthEffects } from './state/auth/auth.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthErrorInterceptor,
      multi: true,
    },
    provideRouter(appRoutes),
    provideHttpClient(),
    provideStore(),
    provideState('app', appReducer),
    provideEffects(AppEffects),
    provideState('auth', authReducer),
    provideEffects(AuthEffects),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: !isDevMode(), // restrict in production
      trace: false,
    }),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Lara,
      },
      ripple: true,
      inputVariant: 'outlined',
    }),
  ],
};
