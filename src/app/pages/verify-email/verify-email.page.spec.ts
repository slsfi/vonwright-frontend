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
  const route: { snapshot: { fragment: string | null } } = {
    snapshot: { fragment: 'jwt=verify-token&campaign=fall' }
  };
  let authService: jasmine.SpyObj<AuthService>;
  let location: jasmine.SpyObj<Location>;

  beforeEach(async () => {
    verifyEmailError.set(null);
    emailVerificationCompleted.set(false);
    emailVerificationInProgress.set(false);
    route.snapshot.fragment = 'jwt=verify-token&campaign=fall';
    authService = jasmine.createSpyObj<AuthService>(
      'AuthService',
      ['verifyEmail', 'clearVerifyEmailState'],
      { verifyEmailError, emailVerificationCompleted, emailVerificationInProgress }
    );
    location = jasmine.createSpyObj<Location>('Location', ['path', 'replaceState']);
    location.path.and.returnValue('/verify-email?source=email');

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

    expect(authService.verifyEmail).toHaveBeenCalledOnceWith('verify-token');
    expect(location.replaceState).toHaveBeenCalledOnceWith(
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
