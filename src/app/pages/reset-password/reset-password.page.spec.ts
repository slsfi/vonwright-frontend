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
  let authService: jasmine.SpyObj<AuthService>;
  let location: jasmine.SpyObj<Location>;

  beforeEach(async () => {
    resetPasswordError.set(null);
    passwordResetCompleted.set(false);
    passwordResetInProgress.set(false);
    route.snapshot.fragment = 'jwt=reset-token';
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['resetPassword', 'clearResetPasswordState'],
      { resetPasswordError, passwordResetCompleted, passwordResetInProgress }
    );
    location = jasmine.createSpyObj<Location>('Location', ['path', 'replaceState']);
    location.path.and.returnValue('/reset-password?source=email');

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

    expect(location.replaceState).toHaveBeenCalledOnceWith('/reset-password', 'source=email');

    component.form.setValue({
      password: 'ValidPassword1',
      confirmPassword: 'ValidPassword1'
    });
    component.attemptPasswordReset();

    expect(authService.resetPassword).toHaveBeenCalledOnceWith('reset-token', 'ValidPassword1');
  });

  it('blocks invalid form submission and marks its controls as touched', () => {
    const component = TestBed.createComponent(ResetPasswordPage).componentInstance;

    component.attemptPasswordReset();

    expect(component.form.controls.password.touched).toBeTrue();
    expect(component.form.controls.confirmPassword.touched).toBeTrue();
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
