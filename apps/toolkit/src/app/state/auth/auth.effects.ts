import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { AuthService } from '../../services/auth.service';
import * as AuthActions from './auth.actions';
import { catchError, exhaustMap, map, of, tap } from 'rxjs';
import { Router } from '@angular/router';

@Injectable()
export class AuthEffects {
  login$;
  toDashboardOnAuth$;
  toLoginOnLogout$;
  constructor(
    private actions$: Actions,
    private authService: AuthService,
    private router: Router
  ) {
    this.login$ = createEffect(() =>
      this.actions$.pipe(
        ofType(AuthActions.login),
        exhaustMap(({ email, password }) =>
          this.authService.login({ email, password }).pipe(
            map((res) => AuthActions.loginSuccess({ user: res })),
            catchError((error) => of(AuthActions.loginFailure({ error })))
          )
        )
      )
    );

    this.toDashboardOnAuth$ = createEffect(
      () =>
        this.actions$.pipe(
          ofType(AuthActions.loginSuccess, AuthActions.tokenRestored),
          tap(() => {
            console.log('in todashboardonauth, routing!');
            this.router.navigateByUrl('/userdashboard');
          })
        ),
      { dispatch: false }
    );

    this.toLoginOnLogout$ = createEffect(
      () =>
        this.actions$.pipe(
          ofType(AuthActions.logout),
          tap(() => this.router.navigateByUrl('/home'))
        ),
      { dispatch: false }
    );
  }
}
