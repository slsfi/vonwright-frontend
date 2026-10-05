import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService, RegisterErrorCode } from '@services/auth.service';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  const registerError = signal<RegisterErrorCode | null>(null);
  const registerInProgress = signal(false);
  const registrationCompleted = signal(false);
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    registerError.set(null);
    registerInProgress.set(false);
    registrationCompleted.set(false);
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['register', 'clearRegisterState'],
      { registerError, registerInProgress, registrationCompleted }
    );

    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
  });

  it('validates the form and submits normalized registration data', async () => {
    const fixture = TestBed.createComponent(RegisterPage);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.attemptRegistration();
    expect(component.form.controls.name.touched).toBeTrue();
    expect(component.form.controls.email.touched).toBeTrue();
    expect(authService.register).not.toHaveBeenCalled();

    component.form.setValue({
      name: '  Test Reader  ',
      email: 'reader@example.org',
      password: 'Verysecure12',
      confirmPassword: 'Verysecure12',
      country: ' FI ',
      intendedUsage: ['scholarly'],
      acceptTermsOfUse: false,
      acceptPrivacyPolicy: false
    });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('ion-button[type="submit"]').disabled).toBeFalse();

    component.attemptRegistration();

    expect(authService.register).toHaveBeenCalledOnceWith(
      'Test Reader',
      'reader@example.org',
      'Verysecure12',
      'FI',
      ['scholarly']
    );
  });

  it('renders signal-driven completion without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(RegisterPage);
    fixture.detectChanges();

    registerInProgress.set(true);
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.country.disabled).toBeTrue();
    expect(fixture.componentInstance.form.controls.intendedUsage.disabled).toBeTrue();

    registerInProgress.set(false);
    registrationCompleted.set(true);
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.country.enabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Kontot har skapats.');
    expect(fixture.nativeElement.querySelector('ion-input')).toBeNull();
  });
});
