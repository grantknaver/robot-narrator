import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { Store } from '@ngrx/store';
import { login } from '../../../state/auth/auth.actions';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit {
  @Output() cancelEvent = new EventEmitter<void>();
  form: FormGroup;

  constructor(private fb: FormBuilder, private store: Store) {}

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  onSubmit() {
    if (this.form.valid) {
      console.log('Form submitted:', this.form.value);
      this.store.dispatch(
        login({
          email: this.form.value.email,
          password: this.form.value.password,
        })
      );
    } else {
      this.form.markAllAsTouched();
    }
  }

  onCancel() {
    this.cancelEvent.emit();
  }
}
