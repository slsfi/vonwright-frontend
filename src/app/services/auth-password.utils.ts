import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

/**
 * Minimum accepted password length for auth forms that create/update credentials.
 */
export const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * Shared validation error key for group-level password confirmation mismatch.
 */
export const PASSWORD_MISMATCH_ERROR_KEY = 'password_mismatch';
/**
 * Shared validation error key for password complexity requirements.
 */
export const PASSWORD_COMPLEXITY_ERROR_KEY = 'password_complexity';

/**
 * Creates a group-level validator that compares two sibling controls.
 *
 * Intended for form groups containing a primary password field and a
 * confirmation field (for example register/reset-password forms).
 *
 * Validation behavior:
 * - Returns `null` while either value is missing (so required/minLength validators
 *   can handle first-pass input feedback).
 * - Returns `{ password_mismatch: true }` when both values are present but differ.
 */
export function passwordMatchValidator(
  passwordControlName: string = 'password',
  confirmPasswordControlName: string = 'confirmPassword'
) {
  return (control: AbstractControl): ValidationErrors | null => {
    const password = control.get(passwordControlName)?.value;
    const confirmPassword = control.get(confirmPasswordControlName)?.value;

    if (typeof password !== 'string' || typeof confirmPassword !== 'string') {
      return null;
    }

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword
      ? null
      : { [PASSWORD_MISMATCH_ERROR_KEY]: true };
  };
}

/**
 * Validates that password includes lowercase + uppercase + at least one
 * non-letter character (digit or symbol).
 *
 * Returns `null` for empty values so `required` can handle missing input.
 */
export function passwordComplexityValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }

    // Use Unicode-aware categories so Nordic letters (for example å/ä/ö/æ/ø)
    // are treated as letters with proper lower/upper case detection.
    const hasLowercase = /\p{Ll}/u.test(value);
    const hasUppercase = /\p{Lu}/u.test(value);
    const hasNonLetter = /\P{L}/u.test(value);

    return hasLowercase && hasUppercase && hasNonLetter
      ? null
      : { [PASSWORD_COMPLEXITY_ERROR_KEY]: true };
  };
}

/**
 * Shared password field validators for auth forms.
 */
export function getPasswordFieldValidators(minLength: number = MINIMUM_PASSWORD_LENGTH): ValidatorFn[] {
  return [
    Validators.required,
    Validators.minLength(minLength),
    passwordComplexityValidator()
  ];
}
