import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { PRIMARY_OUTLET, Router } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';

import { AuthService } from '@services/auth.service';

type PasswordFlowMode = 'forgot' | 'change';

@Component({
  selector: 'page-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: false
})
export class ForgotPasswordPage implements OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly flowMode = signal<PasswordFlowMode>('forgot');
  readonly isChangePasswordMode = computed(() => this.flowMode() === 'change');
  readonly backRoute = computed(() => this.isChangePasswordMode() ? '/account' : '/login');

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });
  readonly forgotPasswordError = this.authService.forgotPasswordError;
  readonly passwordResetRequested = this.authService.passwordResetRequested;

  constructor() {
    this.syncFlowModeFromRoute();
    this.prefillAuthenticatedEmailForChangeMode();
  }

  attemptPasswordRecovery(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email } = this.form.getRawValue();
    this.authService.requestPasswordReset(email.trim());
  }

  clearFeedbackState(): void {
    this.authService.clearForgotPasswordState();
  }

  ionViewWillLeave(): void {
    this.authService.clearForgotPasswordState();
  }

  ionViewWillEnter(): void {
    this.syncFlowModeFromRoute();
    this.prefillAuthenticatedEmailForChangeMode();
  }

  ngOnDestroy(): void {
    this.authService.clearForgotPasswordState();
  }

  private syncFlowModeFromRoute(): void {
    this.flowMode.set(this.resolveFlowModeFromUrlSegments());
  }

  private prefillAuthenticatedEmailForChangeMode(): void {
    if (!this.isChangePasswordMode()) {
      return;
    }

    const authenticatedEmail = this.authService.authenticatedEmail();
    if (authenticatedEmail) {
      this.form.controls.email.setValue(authenticatedEmail);
    }
  }

  private resolveFlowModeFromUrlSegments(): PasswordFlowMode {
    try {
      const urlTree = this.router.parseUrl(this.router.url);
      const urlSegments = urlTree.root.children[PRIMARY_OUTLET]?.segments?.map((segment) => segment.path) ?? [];
      if (urlSegments.includes('change-password')) {
        return 'change';
      }
      return 'forgot';
    } catch {
      return 'forgot';
    }
  }
}
