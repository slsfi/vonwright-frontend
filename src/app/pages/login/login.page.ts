import { Component, inject, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonSpinner
} from '@ionic/angular';

import { AuthStatusMessageComponent } from '@components/auth-status-message/auth-status-message.component';
import { config } from '@config';
import { getAuthRedirectNavigationQueryParams } from '@services/auth-redirect-url.utils';
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'page-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [
    AuthStatusMessageComponent,
    IonButton,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonSpinner,
    ReactiveFormsModule,
    RouterLink
  ]
})
export class LoginPage implements OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });
  readonly loginError = this.authService.loginError;
  readonly loginInProgress = this.authService.loginInProgress;
  readonly showTermsLink: boolean = config.component?.mainSideMenu?.items?.termsOfUse === true;
  readonly showPrivacyPolicyLink: boolean = config.component?.mainSideMenu?.items?.privacyPolicy === true;

  get authRedirectNavigationQueryParams(): Record<string, unknown> {
    return getAuthRedirectNavigationQueryParams(this.router, this.router.url);
  }

  ionViewWillLeave(): void {
    this.clearFeedbackState();
  }

  ngOnDestroy(): void {
    this.clearFeedbackState();
  }

  attemptLogin(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.authService.login(email.trim(), password);
  }

  clearAuthError(): void {
    this.authService.clearLoginError();
  }

  private clearFeedbackState(): void {
    this.authService.clearLoginError();
  }
}
