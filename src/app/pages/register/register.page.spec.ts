import type { MockedObject } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService, RegisterErrorCode } from '@services/auth.service';
import { RegisterPage } from './register.page';

describe('RegisterPage', () => {
  const registerError = signal<RegisterErrorCode | null>(null);
  const registerInProgress = signal(false);
  const registrationCompleted = signal(false);
  let authService: MockedObject<Pick<AuthService, 'register' | 'clearRegisterState'>>
    & Pick<AuthService, 'registerError' | 'registerInProgress' | 'registrationCompleted'>;

  beforeEach(async () => {
    registerError.set(null);
    registerInProgress.set(false);
    registrationCompleted.set(false);
    authService = {
      register: vi.fn().mockName('AuthService.register'),
      clearRegisterState: vi.fn().mockName('AuthService.clearRegisterState'),
      registerError,
      registerInProgress,
      registrationCompleted
    };

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
    expect(component.form.controls.name.touched).toBe(true);
    expect(component.form.controls.email.touched).toBe(true);
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

    expect(fixture.nativeElement.querySelector('ion-button[type="submit"]').disabled).toBe(false);

    component.attemptRegistration();

    expect(authService.register).toHaveBeenCalledTimes(1);

    expect(authService.register).toHaveBeenCalledWith(
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

    expect(fixture.componentInstance.form.controls.country.disabled).toBe(true);
    expect(fixture.componentInstance.form.controls.intendedUsage.disabled).toBe(true);

    registerInProgress.set(false);
    registrationCompleted.set(true);
    await fixture.whenStable();

    expect(fixture.componentInstance.form.controls.country.enabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Kontot har skapats.');
    expect(fixture.nativeElement.querySelector('ion-input')).toBeNull();
  });
});
