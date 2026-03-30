import { Component, inject, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, Validators } from '@angular/forms';

import {
  getPasswordFieldValidators,
  PASSWORD_COMPLEXITY_ERROR_KEY,
  passwordMatchValidator
} from '@services/auth-password.utils';
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'page-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: false
})
export class ResetPasswordPage implements OnDestroy {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private jwtToken = '';

  readonly form = this.formBuilder.nonNullable.group({
    password: ['', getPasswordFieldValidators()],
    confirmPassword: ['', [Validators.required]]
  }, { validators: passwordMatchValidator() });
  readonly passwordComplexityErrorKey = PASSWORD_COMPLEXITY_ERROR_KEY;
  readonly resetPasswordError = this.authService.resetPasswordError;
  readonly passwordResetCompleted = this.authService.passwordResetCompleted;
  readonly passwordResetInProgress = this.authService.passwordResetInProgress;

  ionViewWillEnter(): void {
    this.initializeResetState();
  }

  ionViewWillLeave(): void {
    this.authService.clearResetPasswordState();
  }

  ngOnDestroy(): void {
    this.authService.clearResetPasswordState();
  }

  attemptPasswordReset(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password } = this.form.getRawValue();
    this.authService.resetPassword(this.jwtToken, password);
  }

  clearFeedbackState(): void {
    this.authService.clearResetPasswordState();
  }

  private initializeResetState(): void {
    this.authService.clearResetPasswordState();
    const jwtTokenFromFragment = this.resolveJwtTokenFromFragment(this.route.snapshot.fragment);
    if (!jwtTokenFromFragment) {
      return;
    }

    this.jwtToken = jwtTokenFromFragment;
    this.scrubJwtFromAddressBar();
  }

  private scrubJwtFromAddressBar(): void {
    const rawFragment = this.route.snapshot.fragment;
    if (typeof rawFragment !== 'string' || rawFragment.length === 0) {
      return;
    }

    try {
      const fragmentParams = new URLSearchParams(rawFragment);
      if (!fragmentParams.has('jwt')) {
        return;
      }

      fragmentParams.delete('jwt');
      const currentPath = this.location.path();
      const [path, query = ''] = currentPath.split('?');
      const fragment = fragmentParams.toString();
      const sanitizedPath = `${path}${fragment ? `#${fragment}` : ''}`;
      this.location.replaceState(sanitizedPath, query);
    } catch {
      // Ignore parsing/history errors; reset flow can proceed with in-memory token.
    }
  }

  private resolveJwtTokenFromFragment(fragment: string | null): string {
    if (typeof fragment !== 'string') {
      return '';
    }

    const normalizedFragment = fragment.startsWith('#') ? fragment.slice(1) : fragment;
    return new URLSearchParams(normalizedFragment).get('jwt')?.trim() ?? '';
  }
}
