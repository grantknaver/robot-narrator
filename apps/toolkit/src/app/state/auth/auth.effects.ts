import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { AuthService } from '../../services/auth.service';
import * as AuthActions from './auth.actions';
import { catchError, map, of, switchMap } from 'rxjs';

@Injectable()
export class AuthEffects {
  login$;
  constructor(private actions$: Actions, private authService: AuthService) {
    this.login$ = createEffect(() =>
      this.actions$.pipe(
        ofType(AuthActions.login),
        switchMap(({ email, password }) =>
          this.authService.login({ email, password }).pipe(
            map((response) => AuthActions.loginSuccess({ user: response })),
            catchError((err) =>
              of(AuthActions.loginFailure({ error: err.message }))
            )
          )
        )
      )
    );
  }
}
