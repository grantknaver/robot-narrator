import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Store } from '@ngrx/store';
import { initializeApp } from './state/app.actions';
import { selectInitialized } from './state/app.selectors';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  constructor(private store: Store) {}

  ngOnInit(): void {
    this.store.dispatch(initializeApp());
    this.store.select(selectInitialized).subscribe(console.log);
  }
}
