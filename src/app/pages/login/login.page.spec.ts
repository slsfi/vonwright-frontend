import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService, LoginErrorCode } from '@services/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  const loginError = signal<LoginErrorCode | null>(null);
  const loginInProgress = signal(false);
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    loginError.set(null);
    loginInProgress.set(false);
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['login', 'clearLoginError'],
      { loginError, loginInProgress }
    );

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
    expect(component.form.controls.email.touched).toBeTrue();
    expect(component.form.controls.password.touched).toBeTrue();
    expect(authService.login).not.toHaveBeenCalled();

    component.form.setValue({ email: 'reader@example.org', password: 'secret' });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('ion-button').disabled).toBeFalse();

    component.attemptLogin();

    expect(authService.login).toHaveBeenCalledOnceWith('reader@example.org', 'secret');
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
