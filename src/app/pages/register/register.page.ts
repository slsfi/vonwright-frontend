import { Component, inject, LOCALE_ID, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';

import { config } from '@config';
import { RegisterIntendedUsage } from '@models/auth.models';
import { getAuthRedirectNavigationQueryParams } from '@services/auth-redirect-url.utils';
import {
  getPasswordFieldValidators,
  PASSWORD_COMPLEXITY_ERROR_KEY,
  passwordMatchValidator
} from '@services/auth-password.utils';
import { AuthService } from '@services/auth.service';
import { REGISTER_COUNTRY_CODES } from './register-country-codes';

const REGISTER_NAME_MAX_LENGTH = 255;

/**
 * Rejects null, empty, and whitespace-only input values.
 */
function requiredTrimmedTextValidator(control: AbstractControl<string | null>): ValidationErrors | null {
  const value = control.value;

  return typeof value === 'string' && value.trim().length > 0
    ? null
    : { required: true };
}

interface SelectOption<TValue extends string = string> {
  value: TValue;
  label: string;
}

/**
 * Builds a localized, alphabetized list of country options for the register form.
 */
function createCountryOptions(localeId: string): ReadonlyArray<SelectOption> {
  const localeCandidates = [localeId, localeId.split('-')[0], 'en']
    .filter((candidate, index, candidates) => candidate && candidates.indexOf(candidate) === index);

  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames(localeCandidates, { type: 'region' });
  } catch {
    try {
      displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      displayNames = null;
    }
  }

  return REGISTER_COUNTRY_CODES
    .map((countryCode) => ({
      value: countryCode,
      label: displayNames?.of(countryCode) ?? countryCode
    }))
    .sort((a, b) => a.label.localeCompare(b.label, localeCandidates[0] ?? 'en'));
}

@Component({
  selector: 'page-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  host: { ngSkipHydration: 'true' },
  standalone: false
})
export class RegisterPage implements OnDestroy {
  private readonly formBuilder = inject(FormBuilder);
  private readonly localeId = inject(LOCALE_ID);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  readonly showTermsOfUse: boolean = config.component?.mainSideMenu?.items?.termsOfUse === true;
  readonly showPrivacyPolicy: boolean = config.component?.mainSideMenu?.items?.privacyPolicy === true;
  readonly registerNameMaxLength = REGISTER_NAME_MAX_LENGTH;
  readonly countryOptions = createCountryOptions(this.localeId);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [requiredTrimmedTextValidator, Validators.maxLength(REGISTER_NAME_MAX_LENGTH)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', getPasswordFieldValidators()],
    confirmPassword: ['', [Validators.required]],
    country: [''],
    intendedUsage: this.formBuilder.nonNullable.control<RegisterIntendedUsage[]>([]),
    acceptTermsOfUse: [false, this.showTermsOfUse ? [Validators.requiredTrue] : []],
    acceptPrivacyPolicy: [false, this.showPrivacyPolicy ? [Validators.requiredTrue] : []]
  }, { validators: passwordMatchValidator() });
  readonly passwordComplexityErrorKey = PASSWORD_COMPLEXITY_ERROR_KEY;
  readonly registerError = this.authService.registerError;
  readonly registerInProgress = this.authService.registerInProgress;
  readonly registrationCompleted = this.authService.registrationCompleted;

  /**
   * Preserves any auth redirect target when navigating back to login.
   */
  get authRedirectNavigationQueryParams(): Record<string, unknown> {
    return getAuthRedirectNavigationQueryParams(this.router, this.router.url);
  }

  /**
   * Clears transient register state when leaving the Ionic view.
   */
  ionViewWillLeave(): void {
    this.authService.clearRegisterState();
  }

  /**
   * Clears transient register state when the component is destroyed.
   */
  ngOnDestroy(): void {
    this.authService.clearRegisterState();
  }

  /**
   * Submits the normalized form values once validation has passed.
   */
  attemptRegistration(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, password, country, intendedUsage } = this.form.getRawValue();
    this.authService.register(
      name.trim(),
      email.trim(),
      password,
      country.trim() || undefined,
      intendedUsage.length > 0 ? intendedUsage : undefined
    );
  }

  /**
   * Resets backend-driven success and error feedback after user input changes.
   */
  clearFeedbackState(): void {
    this.authService.clearRegisterState();
  }

  /**
   * Returns whether a touched control currently exposes the requested validation error.
   */
  showControlError(controlName: 'name' | 'email' | 'acceptTermsOfUse' | 'acceptPrivacyPolicy', errorKey: string): boolean {
    const control = this.form.controls[controlName];

    return control.touched && control.hasError(errorKey);
  }

  /**
   * Shows the password requirements error after the password field has been touched.
   */
  showPasswordRequirementsError(): boolean {
    const passwordControl = this.form.controls.password;

    return passwordControl.touched
      && (
        passwordControl.hasError('minlength')
        || passwordControl.hasError('required')
        || passwordControl.hasError(this.passwordComplexityErrorKey)
      );
  }

  /**
   * Indicates whether the form-level password confirmation validator has failed.
   */
  showPasswordMismatchError(): boolean {
    const confirmPasswordControl = this.form.controls.confirmPassword;
    return (
      this.form.hasError('password_mismatch')
      || (
        this.form.controls.password.valid
        && confirmPasswordControl.touched
        && confirmPasswordControl.hasError('required')
      )
    );
  }
}
