import type { MockedObject } from 'vitest';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

import { AuthService, VerifyEmailErrorCode } from '@services/auth.service';
import { VerifyEmailPage } from './verify-email.page';

describe('VerifyEmailPage', () => {
  const verifyEmailError = signal<VerifyEmailErrorCode | null>(null);
  const emailVerificationCompleted = signal(false);
  const emailVerificationInProgress = signal(false);
  const route: { snapshot: {
    fragment: string | null;
} } = {
    snapshot: { fragment: 'jwt=verify-token&campaign=fall' }
  };
  let authService: MockedObject<Pick<AuthService, 'verifyEmail' | 'clearVerifyEmailState'>>
    & Pick<AuthService, 'verifyEmailError' | 'emailVerificationCompleted' | 'emailVerificationInProgress'>;
  let location: MockedObject<Pick<Location, 'path' | 'replaceState'>>;

  beforeEach(async () => {
    verifyEmailError.set(null);
    emailVerificationCompleted.set(false);
    emailVerificationInProgress.set(false);
    route.snapshot.fragment = 'jwt=verify-token&campaign=fall';
    authService = {
      verifyEmail: vi.fn().mockName('AuthService.verifyEmail'),
      clearVerifyEmailState: vi.fn().mockName('AuthService.clearVerifyEmailState'),
      verifyEmailError,
      emailVerificationCompleted,
      emailVerificationInProgress
    };
    location = {
      path: vi.fn().mockName('Location.path'),
      replaceState: vi.fn().mockName('Location.replaceState')
    };
    location.path.mockReturnValue('/verify-email?source=email');

    await TestBed.configureTestingModule({
      imports: [VerifyEmailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: AuthService, useValue: authService },
        { provide: Location, useValue: location }
      ]
    }).compileComponents();
  });

  it('consumes the verification token once and removes it from the address bar', () => {
    const component = TestBed.createComponent(VerifyEmailPage).componentInstance;

    component.ionViewWillEnter();

    expect(authService.verifyEmail).toHaveBeenCalledTimes(1);

    expect(authService.verifyEmail).toHaveBeenCalledWith('verify-token');
    expect(location.replaceState).toHaveBeenCalledTimes(1);
    expect(location.replaceState).toHaveBeenCalledWith(
      '/verify-email#campaign=fall',
      'source=email'
    );

    route.snapshot.fragment = null;
    component.ionViewWillEnter();

    expect(authService.verifyEmail).toHaveBeenCalledTimes(1);
    expect(authService.clearVerifyEmailState).toHaveBeenCalledTimes(2);
  });

  it('renders delayed signal feedback without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(VerifyEmailPage);
    emailVerificationInProgress.set(true);
    fixture.detectChanges();

    emailVerificationInProgress.set(false);
    emailVerificationCompleted.set(true);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Din e-postadress har verifierats.');
    expect(fixture.nativeElement.textContent).not.toContain('Verifierar din e-postadress');
  });
});
