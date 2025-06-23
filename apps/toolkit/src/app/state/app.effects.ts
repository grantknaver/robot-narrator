import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { initializeApp, appInitialized } from './app.actions';
import { delay, map } from 'rxjs/operators';

@Injectable()
export class AppEffects {
  initialize$;
  constructor(private actions$: Actions) {
    this.initialize$ = createEffect(() =>
      this.actions$.pipe(
        ofType(initializeApp),
        delay(1000), // simulate init delay
        map(() => appInitialized())
      )
    );
  }
}
