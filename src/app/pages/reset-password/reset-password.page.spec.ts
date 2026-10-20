import type { MockedObject } from 'vitest';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { AuthService, ResetPasswordErrorCode } from '@services/auth.service';
import { ResetPasswordPage } from './reset-password.page';

describe('ResetPasswordPage', () => {
  const resetPasswordError = signal<ResetPasswordErrorCode | null>(null);
  const passwordResetCompleted = signal(false);
  const passwordResetInProgress = signal(false);
  const route = { snapshot: { fragment: 'jwt=reset-token' } };
  let authService: MockedObject<Pick<AuthService, 'resetPassword' | 'clearResetPasswordState'>>
    & Pick<AuthService, 'resetPasswordError' | 'passwordResetCompleted' | 'passwordResetInProgress'>;
  let location: MockedObject<Pick<Location, 'path' | 'replaceState'>>;

  beforeEach(async () => {
    resetPasswordError.set(null);
    passwordResetCompleted.set(false);
    passwordResetInProgress.set(false);
    route.snapshot.fragment = 'jwt=reset-token';
    authService = {
      resetPassword: vi.fn().mockName('AuthService.resetPassword'),
      clearResetPasswordState: vi.fn().mockName('AuthService.clearResetPasswordState'),
      resetPasswordError,
      passwordResetCompleted,
      passwordResetInProgress
    };
    location = {
      path: vi.fn().mockName('Location.path'),
      replaceState: vi.fn().mockName('Location.replaceState')
    };
    location.path.mockReturnValue('/reset-password?source=email');

    await TestBed.configureTestingModule({
      imports: [ResetPasswordPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: AuthService, useValue: authService },
        { provide: Location, useValue: location }
      ]
    }).compileComponents();
  });

  it('consumes and scrubs the reset token before submitting a valid form', () => {
    const component = TestBed.createComponent(ResetPasswordPage).componentInstance;
    component.ionViewWillEnter();

    expect(location.replaceState).toHaveBeenCalledTimes(1);

    expect(location.replaceState).toHaveBeenCalledWith('/reset-password', 'source=email');

    component.form.setValue({
      password: 'ValidPassword1',
      confirmPassword: 'ValidPassword1'
    });
    component.attemptPasswordReset();

    expect(authService.resetPassword).toHaveBeenCalledTimes(1);

    expect(authService.resetPassword).toHaveBeenCalledWith('reset-token', 'ValidPassword1');
  });

  it('blocks invalid form submission and marks its controls as touched', () => {
    const component = TestBed.createComponent(ResetPasswordPage).componentInstance;

    component.attemptPasswordReset();

    expect(component.form.controls.password.touched).toBe(true);
    expect(component.form.controls.confirmPassword.touched).toBe(true);
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('renders signal-driven invalid-link feedback without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(ResetPasswordPage);
    fixture.detectChanges();

    resetPasswordError.set('invalid_link');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('ogiltig eller har löpt ut');
    expect(fixture.nativeElement.querySelector('ion-input')).toBeNull();
  });
});
