import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DefaultUrlSerializer, Router, UrlTree } from '@angular/router';

import {
  AuthRedirectStorageService,
  AUTH_REDIRECT_MARKER_QUERY_PARAM,
  AUTH_REDIRECT_MARKER_VALUE
} from '@services/auth-redirect-storage.service';
import { AuthTokenStorageService } from '@services/auth-token-storage.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let httpMock: HttpTestingController;
  let router: jasmine.SpyObj<Pick<Router, 'navigateByUrl' | 'parseUrl'>>;
  let redirectStorage: jasmine.SpyObj<Pick<AuthRedirectStorageService, 'consumeReturnUrl' | 'clearReturnUrl'>>;
  let tokenStorage: jasmine.SpyObj<Pick<AuthTokenStorageService, 'setItem' | 'getItem' | 'removeItem'>>;
  let tokenMap: Map<string, string>;

  function createService(): AuthService {
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    tokenMap = new Map<string, string>();
    const urlSerializer = new DefaultUrlSerializer();

    router = jasmine.createSpyObj<Pick<Router, 'navigateByUrl' | 'parseUrl'>>('Router', ['navigateByUrl', 'parseUrl']);
    router.navigateByUrl.and.resolveTo(true);
    router.parseUrl.and.callFake((url: string): UrlTree => urlSerializer.parse(url));
    Object.defineProperty(router, 'url', { value: '/login', writable: true });

    redirectStorage = jasmine.createSpyObj<
      Pick<AuthRedirectStorageService, 'consumeReturnUrl' | 'clearReturnUrl'>
    >('AuthRedirectStorageService', ['consumeReturnUrl', 'clearReturnUrl']);
    redirectStorage.consumeReturnUrl.and.returnValue(null);

    tokenStorage = jasmine.createSpyObj<
      Pick<AuthTokenStorageService, 'setItem' | 'getItem' | 'removeItem'>
    >('AuthTokenStorageService', ['setItem', 'getItem', 'removeItem']);
    tokenStorage.setItem.and.callFake((key: string, value: string) => {
      tokenMap.set(key, value);
    });
    tokenStorage.getItem.and.callFake((key: string) => tokenMap.get(key) ?? null);
    tokenStorage.removeItem.and.callFake((key: string) => {
      tokenMap.delete(key);
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
        { provide: AuthRedirectStorageService, useValue: redirectStorage },
        { provide: AuthTokenStorageService, useValue: tokenStorage }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('initializes isAuthenticated as false when access token is missing', () => {
    const service = createService();

    expect(service.isAuthenticated()).toBeFalse();
  });

  it('initializes isAuthenticated as true when access token exists', () => {
    tokenMap.set('access_token', 'existing-access-token');

    const service = createService();

    expect(service.isAuthenticated()).toBeTrue();
  });

  it('initializes authenticatedEmail from storage when access token exists', () => {
    tokenMap.set('access_token', 'existing-access-token');
    tokenMap.set('auth_email', 'user@example.com');

    const service = createService();

    expect(service.authenticatedEmail()).toBe('user@example.com');
  });

  it('sets tokens, navigates, and updates signal on successful login', () => {
    const service = createService();

    service.login('user@example.com', 'secret');
    expect(service.loginInProgress()).toBeTrue();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(tokenMap.get('access_token')).toBe('access-token-1');
    expect(tokenMap.get('refresh_token')).toBe('refresh-token-1');
    expect(tokenMap.get('auth_email')).toBe('user@example.com');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.authenticatedEmail()).toBe('user@example.com');
    expect(service.loginInProgress()).toBeFalse();
    expect(service.loginError()).toBeNull();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('navigates to returnUrl query param after successful login when safe', () => {
    (router as unknown as { url: string }).url = '/login?returnUrl=%2Fcollection%2F123%2Ftext';
    const service = createService();

    service.login('user@example.com', 'secret');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/collection/123/text');
  });

  it('prefers marker-based stored return URL over query returnUrl after successful login', () => {
    (router as unknown as { url: string }).url =
      `/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}&returnUrl=%2Fsearch`;
    redirectStorage.consumeReturnUrl.and.returnValue('/collection/123/text');
    const service = createService();

    service.login('user@example.com', 'secret');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(redirectStorage.consumeReturnUrl).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/collection/123/text');
  });

  it('falls back to query returnUrl when marker is present but stored target is missing', () => {
    (router as unknown as { url: string }).url =
      `/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}&returnUrl=%2Fsearch`;
    redirectStorage.consumeReturnUrl.and.returnValue(null);
    const service = createService();

    service.login('user@example.com', 'secret');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/search');
  });

  it('ignores non-matching marker value and uses query returnUrl', () => {
    (router as unknown as { url: string }).url = '/login?rt=unexpected&returnUrl=%2Fsearch';
    redirectStorage.consumeReturnUrl.and.returnValue('/collection/123/text');
    const service = createService();

    service.login('user@example.com', 'secret');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(redirectStorage.consumeReturnUrl).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/search');
  });

  it('ignores unsafe returnUrl query param after successful login', () => {
    (router as unknown as { url: string }).url = '/login?returnUrl=%2F%2Fevil.example';
    const service = createService();

    service.login('user@example.com', 'secret');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('ignores login-loop returnUrl query param after successful login', () => {
    (router as unknown as { url: string }).url = '/login?returnUrl=%2Flogin%3FreturnUrl%3D%252Fsearch';
    const service = createService();

    service.login('user@example.com', 'secret');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('ignores returnUrl when Angular router parsing of the target fails', () => {
    (router as unknown as { url: string }).url = '/login?returnUrl=%2Fbroken';
    const fallbackParser = new DefaultUrlSerializer();
    router.parseUrl.and.callFake((url: string): UrlTree => {
      if (url === '/broken') {
        throw new Error('invalid redirect target');
      }
      return fallbackParser.parse(url);
    });
    const service = createService();

    service.login('user@example.com', 'secret');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('ignores too-long returnUrl query param after successful login', () => {
    const longReturnUrl = `/${'a'.repeat(2001)}`;
    (router as unknown as { url: string }).url = `/login?returnUrl=${encodeURIComponent(longReturnUrl)}`;
    const service = createService();

    service.login('user@example.com', 'secret');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      msg: 'ok',
      user_projects: []
    });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/account');
  });

  it('clears auth state when login fails', () => {
    tokenMap.set('access_token', 'stale-access');
    tokenMap.set('refresh_token', 'stale-refresh');
    tokenMap.set('auth_email', 'stale@example.com');
    const service = createService();

    service.login('user@example.com', 'wrong-password');
    expect(service.loginInProgress()).toBeTrue();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({ detail: 'invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(service.isAuthenticated()).toBeFalse();
    expect(service.loginInProgress()).toBeFalse();
    expect(service.loginError()).toBe('invalid_credentials');
    expect(tokenMap.has('access_token')).toBeFalse();
    expect(tokenMap.has('refresh_token')).toBeFalse();
    expect(tokenMap.has('auth_email')).toBeFalse();
    expect(service.authenticatedEmail()).toBeNull();
    expect(redirectStorage.clearReturnUrl).not.toHaveBeenCalled();
  });

  it('maps NO_CREDENTIALS backend error code to no_credentials', () => {
    const service = createService();

    service.login('user@example.com', 'wrong-password');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({ msg: 'missing credentials', err: 'NO_CREDENTIALS' }, { status: 400, statusText: 'Bad Request' });

    expect(service.loginError()).toBe('no_credentials');
  });

  it('maps EMAIL_NOT_VERIFIED backend error code to email_not_verified', () => {
    const service = createService();

    service.login('user@example.com', 'wrong-password');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush(
      { msg: 'email is not verified', err: 'EMAIL_NOT_VERIFIED' },
      { status: 403, statusText: 'Forbidden' }
    );

    expect(service.loginError()).toBe('email_not_verified');
  });

  it('maps INCORRECT_CREDENTIALS backend error code to invalid_credentials', () => {
    const service = createService();

    service.login('user@example.com', 'wrong-password');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush(
      { msg: 'incorrect credentials', err: 'INCORRECT_CREDENTIALS' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(service.loginError()).toBe('invalid_credentials');
  });

  it('sets generic login error code when login fails with non-401 status', () => {
    const service = createService();

    service.login('user@example.com', 'wrong-password');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({ detail: 'server error' }, { status: 500, statusText: 'Server Error' });

    expect(service.loginError()).toBe('request_failed');
  });

  it('clears login error state explicitly', () => {
    const service = createService();

    service.login('user@example.com', 'wrong-password');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/login'));
    request.flush({ detail: 'invalid credentials' }, { status: 401, statusText: 'Unauthorized' });
    expect(service.loginError()).toBe('invalid_credentials');

    service.clearLoginError();
    expect(service.loginError()).toBeNull();
  });

  it('sets success state when register request succeeds', () => {
    const service = createService();

    service.register(' Test User ', ' user@example.com ', 'new-password-1234', ' FI ', ['personal', 'scholarly']);
    expect(service.registerInProgress()).toBeTrue();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/register'));
    expect(request.request.body).toEqual({
      name: 'Test User',
      email: 'user@example.com',
      password: 'new-password-1234',
      language: 'en',
      country: 'FI',
      intended_usage: 'personal;scholarly'
    });
    request.flush({ msg: 'User was created' }, { status: 201, statusText: 'Created' });

    expect(service.registerError()).toBeNull();
    expect(service.registerInProgress()).toBeFalse();
    expect(service.registrationCompleted()).toBeTrue();
  });

  it('omits optional register metadata when not provided', () => {
    const service = createService();

    service.register('Test User', 'user@example.com', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/register'));
    expect(request.request.body).toEqual({
      name: 'Test User',
      email: 'user@example.com',
      password: 'new-password-1234',
      language: 'en'
    });
    request.flush({ msg: 'User was created' }, { status: 201, statusText: 'Created' });
  });

  it('maps NO_CREDENTIALS backend error code for register flow', () => {
    const service = createService();

    service.register('Test User', 'user@example.com', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/register'));
    request.flush({ msg: 'missing credentials', err: 'NO_CREDENTIALS' }, { status: 400, statusText: 'Bad Request' });

    expect(service.registerError()).toBe('no_credentials');
    expect(service.registrationCompleted()).toBeFalse();
  });

  it('maps PASSWORD_TOO_SHORT backend error code for register flow', () => {
    const service = createService();

    service.register('Test User', 'user@example.com', 'short');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/register'));
    request.flush(
      { msg: 'password too short', err: 'PASSWORD_TOO_SHORT' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(service.registerError()).toBe('password_too_short');
    expect(service.registrationCompleted()).toBeFalse();
  });

  it('maps USER_ALREADY_EXISTS backend error code for register flow', () => {
    const service = createService();

    service.register('Test User', 'user@example.com', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/register'));
    request.flush(
      { msg: 'user already exists', err: 'USER_ALREADY_EXISTS' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(service.registerError()).toBe('user_already_exists');
    expect(service.registrationCompleted()).toBeFalse();
  });

  it('maps generic register request failures to request_failed', () => {
    const service = createService();

    service.register('Test User', 'user@example.com', 'new-password-1234');
    expect(service.registerInProgress()).toBeTrue();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/register'));
    request.flush({ detail: 'server error' }, { status: 500, statusText: 'Server Error' });

    expect(service.registerError()).toBe('request_failed');
    expect(service.registerInProgress()).toBeFalse();
    expect(service.registrationCompleted()).toBeFalse();
  });

  it('clears register feedback state explicitly', () => {
    const service = createService();

    service.register('Test User', 'user@example.com', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/register'));
    request.flush({ msg: 'User was created' }, { status: 201, statusText: 'Created' });
    expect(service.registrationCompleted()).toBeTrue();

    service.clearRegisterState();
    expect(service.registerError()).toBeNull();
    expect(service.registrationCompleted()).toBeFalse();
  });

  it('sets success state when forgot password request succeeds', () => {
    const service = createService();

    service.requestPasswordReset(' user@example.com ');
    expect(service.forgotPasswordInProgress()).toBeTrue();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/forgot_password'));
    expect(request.request.body).toEqual({ email: 'user@example.com', language: 'en' });
    request.flush({ msg: 'Password reset email sent' });

    expect(service.forgotPasswordError()).toBeNull();
    expect(service.forgotPasswordInProgress()).toBeFalse();
    expect(service.passwordResetRequested()).toBeTrue();
  });

  it('treats NO_CREDENTIALS backend error code as successful forgot password initiation', () => {
    const service = createService();

    service.requestPasswordReset('user@example.com');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/forgot_password'));
    request.flush({ msg: 'missing email', err: 'NO_CREDENTIALS' }, { status: 400, statusText: 'Bad Request' });

    expect(service.forgotPasswordError()).toBeNull();
    expect(service.passwordResetRequested()).toBeTrue();
  });

  it('treats INVALID_CREDENTIALS backend error code as successful forgot password initiation', () => {
    const service = createService();

    service.requestPasswordReset('user@example.com');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/forgot_password'));
    request.flush({ msg: 'user not found', err: 'INVALID_CREDENTIALS' }, { status: 400, statusText: 'Bad Request' });

    expect(service.forgotPasswordError()).toBeNull();
    expect(service.passwordResetRequested()).toBeTrue();
  });

  it('sets generic forgot password error code when request fails with non-400 status', () => {
    const service = createService();

    service.requestPasswordReset('user@example.com');
    expect(service.forgotPasswordInProgress()).toBeTrue();

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/forgot_password'));
    request.flush({ detail: 'server error' }, { status: 500, statusText: 'Server Error' });

    expect(service.forgotPasswordError()).toBe('request_failed');
    expect(service.forgotPasswordInProgress()).toBeFalse();
    expect(service.passwordResetRequested()).toBeFalse();
  });

  it('clears forgot password feedback state explicitly', () => {
    const service = createService();

    service.requestPasswordReset('user@example.com');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/forgot_password'));
    request.flush({ msg: 'Password reset email sent' });
    expect(service.passwordResetRequested()).toBeTrue();

    service.clearForgotPasswordState();
    expect(service.forgotPasswordError()).toBeNull();
    expect(service.passwordResetRequested()).toBeFalse();
  });

  it('submits new password with jwt token, logs out, and marks reset as completed on success', () => {
    tokenMap.set('access_token', 'existing-access-token');
    tokenMap.set('refresh_token', 'existing-refresh-token');
    tokenMap.set('auth_email', 'user@example.com');
    const service = createService();

    service.resetPassword(' reset-token ', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/reset_password'));
    expect(request.request.body).toEqual({ password: 'new-password-1234' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer reset-token');
    expect(service.passwordResetInProgress()).toBeTrue();
    request.flush({ msg: 'New password set for user@example.com' });

    expect(service.resetPasswordError()).toBeNull();
    expect(service.passwordResetInProgress()).toBeFalse();
    expect(service.passwordResetCompleted()).toBeTrue();
    expect(service.isAuthenticated()).toBeFalse();
    expect(tokenMap.has('access_token')).toBeFalse();
    expect(tokenMap.has('refresh_token')).toBeFalse();
    expect(tokenMap.has('auth_email')).toBeFalse();
    expect(redirectStorage.clearReturnUrl).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not call backend reset endpoint when jwt token is missing', () => {
    const service = createService();

    service.resetPassword('   ', 'new-password-1234');

    httpMock.expectNone((req) => req.url.includes('/auth/reset_password'));
    expect(service.resetPasswordError()).toBe('invalid_link');
    expect(service.passwordResetInProgress()).toBeFalse();
    expect(service.passwordResetCompleted()).toBeFalse();
  });

  it('maps NO_CREDENTIALS backend error code to no_credentials for reset password', () => {
    const service = createService();

    service.resetPassword('reset-token', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/reset_password'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer reset-token');
    request.flush({ msg: 'missing password', err: 'NO_CREDENTIALS' }, { status: 400, statusText: 'Bad Request' });

    expect(service.resetPasswordError()).toBe('no_credentials');
    expect(service.passwordResetInProgress()).toBeFalse();
    expect(service.passwordResetCompleted()).toBeFalse();
  });

  it('maps PASSWORD_TOO_SHORT backend error code to password_too_short for reset password', () => {
    const service = createService();

    service.resetPassword('reset-token', 'short');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/reset_password'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer reset-token');
    request.flush(
      { msg: 'password too short', err: 'PASSWORD_TOO_SHORT' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(service.resetPasswordError()).toBe('password_too_short');
    expect(service.passwordResetInProgress()).toBeFalse();
    expect(service.passwordResetCompleted()).toBeFalse();
  });

  it('maps 401 status to invalid_link for reset password', () => {
    const service = createService();

    service.resetPassword('reset-token', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/reset_password'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer reset-token');
    request.flush({ msg: 'token expired' }, { status: 401, statusText: 'Unauthorized' });

    expect(service.resetPasswordError()).toBe('invalid_link');
    expect(service.passwordResetInProgress()).toBeFalse();
    expect(service.passwordResetCompleted()).toBeFalse();
  });

  it('maps generic reset password failures to request_failed', () => {
    const service = createService();

    service.resetPassword('reset-token', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/reset_password'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer reset-token');
    request.flush({ detail: 'server error' }, { status: 500, statusText: 'Server Error' });

    expect(service.resetPasswordError()).toBe('request_failed');
    expect(service.passwordResetInProgress()).toBeFalse();
    expect(service.passwordResetCompleted()).toBeFalse();
  });

  it('clears reset password feedback state explicitly', () => {
    const service = createService();

    service.resetPassword('reset-token', 'new-password-1234');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/reset_password'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer reset-token');
    request.flush({ msg: 'New password set for user@example.com' });
    expect(service.passwordResetCompleted()).toBeTrue();

    service.clearResetPasswordState();
    expect(service.resetPasswordError()).toBeNull();
    expect(service.passwordResetInProgress()).toBeFalse();
    expect(service.passwordResetCompleted()).toBeFalse();
  });

  it('verifies email with jwt token and marks verification as completed on success', () => {
    const service = createService();

    service.verifyEmail(' verify-token ');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/verify_email'));
    expect(request.request.body).toBeNull();
    expect(request.request.headers.get('Authorization')).toBe('Bearer verify-token');
    expect(service.emailVerificationInProgress()).toBeTrue();
    request.flush({ msg: 'Email verified' });

    expect(service.verifyEmailError()).toBeNull();
    expect(service.emailVerificationInProgress()).toBeFalse();
    expect(service.emailVerificationCompleted()).toBeTrue();
  });

  it('does not call backend verify email endpoint when jwt token is missing', () => {
    const service = createService();

    service.verifyEmail('   ');

    httpMock.expectNone((req) => req.url.includes('/auth/verify_email'));
    expect(service.verifyEmailError()).toBe('invalid_link');
    expect(service.emailVerificationInProgress()).toBeFalse();
    expect(service.emailVerificationCompleted()).toBeFalse();
  });

  it('maps INVALID_CREDENTIALS backend error code to invalid_link for verify email', () => {
    const service = createService();

    service.verifyEmail('verify-token');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/verify_email'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer verify-token');
    request.flush(
      { msg: 'invalid token', err: 'INVALID_CREDENTIALS' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(service.verifyEmailError()).toBe('invalid_link');
    expect(service.emailVerificationInProgress()).toBeFalse();
    expect(service.emailVerificationCompleted()).toBeFalse();
  });

  it('maps generic verify email failures to request_failed', () => {
    const service = createService();

    service.verifyEmail('verify-token');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/verify_email'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer verify-token');
    request.flush({ detail: 'server error' }, { status: 500, statusText: 'Server Error' });

    expect(service.verifyEmailError()).toBe('request_failed');
    expect(service.emailVerificationInProgress()).toBeFalse();
    expect(service.emailVerificationCompleted()).toBeFalse();
  });

  it('clears verify email feedback state explicitly', () => {
    const service = createService();

    service.verifyEmail('verify-token');

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/verify_email'));
    request.flush({ msg: 'Email verified' });
    expect(service.emailVerificationCompleted()).toBeTrue();

    service.clearVerifyEmailState();
    expect(service.verifyEmailError()).toBeNull();
    expect(service.emailVerificationInProgress()).toBeFalse();
    expect(service.emailVerificationCompleted()).toBeFalse();
  });

  it('clears stored marker return URL on logout when authenticated', () => {
    tokenMap.set('access_token', 'access-token-1');
    tokenMap.set('auth_email', 'user@example.com');
    const service = createService();

    service.logout();

    expect(redirectStorage.clearReturnUrl).toHaveBeenCalledTimes(1);
    expect(tokenMap.has('auth_email')).toBeFalse();
    expect(service.authenticatedEmail()).toBeNull();
  });

  it('also clears stored marker return URL on logout when already unauthenticated', () => {
    const service = createService();

    service.logout();

    expect(redirectStorage.clearReturnUrl).toHaveBeenCalledTimes(1);
  });

  it('updates signal and access token on successful refresh', () => {
    tokenMap.set('refresh_token', 'refresh-token-1');
    const service = createService();
    let refreshedToken: string | undefined;

    service.refreshToken().subscribe((token) => {
      refreshedToken = token;
    });

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/refresh'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer refresh-token-1');
    request.flush({
      msg: 'ok',
      access_token: 'access-token-2'
    });

    expect(refreshedToken).toBe('access-token-2');
    expect(tokenMap.get('access_token')).toBe('access-token-2');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('fails fast, logs out, and skips HTTP when refresh token is missing', () => {
    tokenMap.set('access_token', 'stale-access-token');
    const service = createService();
    let receivedError: any;

    service.refreshToken().subscribe({
      next: () => fail('expected refreshToken() to error when refresh token is missing'),
      error: (error) => {
        receivedError = error;
      }
    });

    httpMock.expectNone((req) => req.url.endsWith('/auth/refresh'));
    expect(receivedError).toEqual(jasmine.any(Error));
    expect(service.isAuthenticated()).toBeFalse();
    expect(tokenMap.has('access_token')).toBeFalse();
    expect(tokenMap.has('refresh_token')).toBeFalse();
  });

  it('uses a single refresh request for concurrent callers and resolves both', () => {
    tokenMap.set('refresh_token', 'refresh-token-1');
    const service = createService();
    let firstResult: string | undefined;
    let secondResult: string | undefined;

    service.refreshToken().subscribe((token) => {
      firstResult = token;
    });
    service.refreshToken().subscribe((token) => {
      secondResult = token;
    });

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/refresh'));
    request.flush({
      msg: 'ok',
      access_token: 'access-token-3'
    });

    expect(firstResult).toBe('access-token-3');
    expect(secondResult).toBe('access-token-3');
  });

  it('does not replay stale refresh token to waiters in a new refresh cycle', () => {
    tokenMap.set('refresh_token', 'refresh-token-1');
    const service = createService();
    let firstCycleToken: string | undefined;
    let secondCyclePrimaryToken: string | undefined;
    let secondCycleWaiterToken: string | undefined;

    service.refreshToken().subscribe((token) => {
      firstCycleToken = token;
    });
    const firstCycleRequest = httpMock.expectOne((req) => req.url.endsWith('/auth/refresh'));
    firstCycleRequest.flush({
      msg: 'ok',
      access_token: 'access-token-old'
    });
    expect(firstCycleToken).toBe('access-token-old');

    service.refreshToken().subscribe((token) => {
      secondCyclePrimaryToken = token;
    });
    const secondCycleRequest = httpMock.expectOne((req) => req.url.endsWith('/auth/refresh'));

    service.refreshToken().subscribe((token) => {
      secondCycleWaiterToken = token;
    });

    expect(secondCycleWaiterToken).toBeUndefined();

    secondCycleRequest.flush({
      msg: 'ok',
      access_token: 'access-token-new'
    });

    expect(secondCyclePrimaryToken).toBe('access-token-new');
    expect(secondCycleWaiterToken).toBe('access-token-new');
  });

  it('propagates refresh errors to concurrent waiters and clears auth state', () => {
    tokenMap.set('access_token', 'access-token-1');
    tokenMap.set('refresh_token', 'refresh-token-1');
    const service = createService();
    let firstError: any;
    let secondError: any;

    service.refreshToken().subscribe({
      next: () => fail('expected first refresh subscriber to error'),
      error: (error) => {
        firstError = error;
      }
    });
    service.refreshToken().subscribe({
      next: () => fail('expected second refresh subscriber to error'),
      error: (error) => {
        secondError = error;
      }
    });

    const request = httpMock.expectOne((req) => req.url.endsWith('/auth/refresh'));
    request.flush({ detail: 'refresh failed' }, { status: 401, statusText: 'Unauthorized' });

    expect(firstError?.status).toBe(401);
    expect(secondError?.status).toBe(401);
    expect(service.isAuthenticated()).toBeFalse();
    expect(tokenMap.has('access_token')).toBeFalse();
    expect(tokenMap.has('refresh_token')).toBeFalse();
  });
});
