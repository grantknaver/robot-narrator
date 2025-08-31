import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { exhaustMap, of, mergeMap, catchError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { initializeApp, appInitialized } from './app.actions';
import * as AuthActions from '../state/auth/auth.actions';
import { UserResponse, UserService } from '../services/user.service';
import { getUserIdFromToken, hasValidToken } from '../shared/utils/jwtUtils';

@Injectable()
export class AppEffects {
  initialize$;

  constructor(
    private actions$: Actions,
    private authService: AuthService,
    private userService: UserService
  ) {
    this.initialize$ = createEffect(() =>
      this.actions$.pipe(
        ofType(initializeApp),
        exhaustMap(() => {
          if (!hasValidToken()) {
            return of(appInitialized());
          }
          const userId = getUserIdFromToken();
          if (!userId) {
            return of(appInitialized());
          }

          return this.userService.getUser(userId).pipe(
            mergeMap((userResponse: UserResponse) =>
              of(
                AuthActions.loginSuccess({ user: userResponse.data }),
                appInitialized()
              )
            ),
            catchError((err) =>
              of(
                AuthActions.loginFailure({ error: this.errMsg(err) }),
                appInitialized()
              )
            )
          );
        })
      )
    );
  }

  private errMsg(e: any): string {
    return e?.error?.message ?? e?.message ?? 'Unable to restore session';
  }
}
