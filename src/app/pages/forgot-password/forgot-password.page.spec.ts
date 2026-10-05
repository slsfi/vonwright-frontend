import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService, ForgotPasswordErrorCode } from '@services/auth.service';
import { ForgotPasswordPage } from './forgot-password.page';

describe('ForgotPasswordPage', () => {
  const authenticatedEmail = signal<string | null>(null);
  const forgotPasswordError = signal<ForgotPasswordErrorCode | null>(null);
  const forgotPasswordInProgress = signal(false);
  const passwordResetRequested = signal(false);
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authenticatedEmail.set(null);
    forgotPasswordError.set(null);
    forgotPasswordInProgress.set(false);
    passwordResetRequested.set(false);
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['requestPasswordReset', 'clearForgotPasswordState'],
      {
        authenticatedEmail,
        forgotPasswordError,
        forgotPasswordInProgress,
        passwordResetRequested
      }
    );

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideRouter([{ path: 'change-password', component: ForgotPasswordPage }]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
  });

  it('uses change-password mode and prefills the authenticated email', async () => {
    authenticatedEmail.set('reader@example.org');
    await TestBed.inject(Router).navigateByUrl('/change-password');

    const component = TestBed.createComponent(ForgotPasswordPage).componentInstance;

    expect(component.isChangePasswordMode()).toBeTrue();
    expect(component.backRoute()).toBe('/account');
    expect(component.form.controls.email.value).toBe('reader@example.org');
  });

  it('validates and submits the password-recovery form', () => {
    const component = TestBed.createComponent(ForgotPasswordPage).componentInstance;

    component.attemptPasswordRecovery();
    expect(component.form.controls.email.touched).toBeTrue();
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();

    component.form.controls.email.setValue('reader@example.org');
    component.attemptPasswordRecovery();

    expect(authService.requestPasswordReset).toHaveBeenCalledOnceWith('reader@example.org');
  });

  it('renders signal-driven confirmation without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    fixture.detectChanges();

    passwordResetRequested.set(true);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('en återställningslänk skickats');
  });
});
