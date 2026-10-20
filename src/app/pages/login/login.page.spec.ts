import type { MockedObject } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService, LoginErrorCode } from '@services/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  const loginError = signal<LoginErrorCode | null>(null);
  const loginInProgress = signal(false);
  let authService: MockedObject<Pick<AuthService, 'login' | 'clearLoginError'>>
    & Pick<AuthService, 'loginError' | 'loginInProgress'>;

  beforeEach(async () => {
    loginError.set(null);
    loginInProgress.set(false);
    authService = {
      login: vi.fn().mockName('AuthService.login'),
      clearLoginError: vi.fn().mockName('AuthService.clearLoginError'),
      loginError,
      loginInProgress
    };

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
  });

  it('validates the form and submits valid credentials', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.attemptLogin();
    expect(component.form.controls.email.touched).toBe(true);
    expect(component.form.controls.password.touched).toBe(true);
    expect(authService.login).not.toHaveBeenCalled();

    component.form.setValue({ email: 'reader@example.org', password: 'secret' });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('ion-button').disabled).toBe(false);

    component.attemptLogin();

    expect(authService.login).toHaveBeenCalledTimes(1);

    expect(authService.login).toHaveBeenCalledWith('reader@example.org', 'secret');
  });

  it('renders signal-driven feedback without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();

    loginError.set('invalid_credentials');
    loginInProgress.set(true);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Fel e-postadress eller lösenord.');
    expect(fixture.nativeElement.textContent).toContain('Loggar in ...');
  });
});
