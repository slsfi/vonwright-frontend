import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { config } from '@config';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '@services/auth.service';
import { AUTH_REDIRECT_MARKER_QUERY_PARAM, AUTH_REDIRECT_MARKER_VALUE } from '@services/auth-redirect-storage.service';
import { AUTH_ENABLED } from '@tokens/auth.tokens';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authService: MockedObject<Pick<
    AuthService,
    'getAccessToken'
    | 'getRefreshToken'
    | 'refreshToken'
    | 'expireSession'
    | 'preserveReturnUrlForReauthentication'
    | 'isRequestToConfiguredBackend'
    | 'isRequestToAuthEndpoint'
  >>;
  let router: MockedObject<Pick<Router, 'navigate'>>;
  const backendBaseURL = ensureTrailingSlash(config.app.backendBaseURL);
  const backendAuthBaseURL = ensureTrailingSlash(resolveBackendAuthBaseURLForTests());
  const backendAuthEndpointPrefix = `${backendAuthBaseURL}auth`;
  const backendProtectedURL = `${backendBaseURL}protected`;
  const backendAuthLoginURL = `${backendAuthBaseURL}auth/login`;
  const backendAuthResetPasswordURL = `${backendAuthBaseURL}auth/reset_password`;
  const nonBackendURL = 'https://example.com/non-backend';

  beforeEach(() => {
    authService = {
      getAccessToken: vi.fn().mockName('AuthService.getAccessToken'),
      getRefreshToken: vi.fn().mockName('AuthService.getRefreshToken'),
      refreshToken: vi.fn().mockName('AuthService.refreshToken'),
      expireSession: vi.fn().mockName('AuthService.expireSession'),
      preserveReturnUrlForReauthentication: vi.fn().mockName('AuthService.preserveReturnUrlForReauthentication'),
      isRequestToConfiguredBackend: vi.fn().mockName('AuthService.isRequestToConfiguredBackend'),
      isRequestToAuthEndpoint: vi.fn().mockName('AuthService.isRequestToAuthEndpoint')
    };
    router = {
      navigate: vi.fn().mockName('Router.navigate')
    };
    router.navigate.mockResolvedValue(true);
    Object.defineProperty(router, 'url', { value: '/collection/123/text?tab=notes', writable: true });
    authService.getRefreshToken.mockReturnValue('refresh-token');
    authService.preserveReturnUrlForReauthentication.mockReturnValue({
      [AUTH_REDIRECT_MARKER_QUERY_PARAM]: AUTH_REDIRECT_MARKER_VALUE
    });
    authService.isRequestToConfiguredBackend.mockImplementation((url: string) =>
      url.startsWith(backendBaseURL) || url.startsWith(backendAuthBaseURL)
    );
    authService.isRequestToAuthEndpoint.mockImplementation((url: string) => {
      if (!url.startsWith(backendAuthEndpointPrefix)) {
        return false;
      }

      const boundary = url.charAt(backendAuthEndpointPrefix.length);
      return boundary === '' || boundary === '/' || boundary === '?' || boundary === '#';
    });

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AUTH_ENABLED, useValue: true },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('adds bearer token for non-auth requests when token exists', () => {
    authService.getAccessToken.mockReturnValue('abc-token');

    http.get(backendProtectedURL).subscribe();

    const req = httpMock.expectOne(backendProtectedURL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc-token');
    req.flush({ ok: true });
  });

  it('does not add bearer token for /auth/ requests', () => {
    authService.getAccessToken.mockReturnValue('abc-token');

    http.post(backendAuthLoginURL, {}).subscribe();

    const req = httpMock.expectOne(backendAuthLoginURL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ ok: true });
  });

  it('preserves existing authorization header for reset-password auth endpoint requests', () => {
    authService.getAccessToken.mockReturnValue('abc-token');

    http.post(backendAuthResetPasswordURL, {}, {
      headers: new HttpHeaders({ Authorization: 'Bearer reset-token' })
    }).subscribe();

    const req = httpMock.expectOne(backendAuthResetPasswordURL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer reset-token');
    req.flush({ ok: true });
  });

  it('does not enter the interceptor-managed refresh flow for requests with a caller-supplied Authorization header', () => {
    authService.getAccessToken.mockReturnValue('abc-token');

    let receivedError: any;
    http.get(backendProtectedURL, {
      headers: new HttpHeaders({ Authorization: 'Bearer existing-token' })
    }).subscribe({
      error: (error) => {
        receivedError = error;
      }
    });

    const req = httpMock.expectOne(backendProtectedURL);
    expect(req.request.headers.get('Authorization')).toBe('Bearer existing-token');
    req.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(authService.expireSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(receivedError).toEqual(expect.objectContaining({ status: 401 }));
  });

  it('does not add bearer token for non-backend requests', () => {
    authService.getAccessToken.mockReturnValue('abc-token');

    http.get(nonBackendURL).subscribe();

    const req = httpMock.expectOne(nonBackendURL);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ ok: true });
  });

  it('refreshes token and retries request on 401 for non-refresh endpoint', () => {
    authService.getAccessToken.mockReturnValue('expired-token');
    authService.refreshToken.mockReturnValue(of('new-token'));

    http.get(backendProtectedURL).subscribe();

    const firstReq = httpMock.expectOne(backendProtectedURL);
    expect(firstReq.request.headers.get('Authorization')).toBe('Bearer expired-token');
    firstReq.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    const retryReq = httpMock.expectOne(backendProtectedURL);
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retryReq.flush({ ok: true });

    expect(authService.refreshToken).toHaveBeenCalledTimes(1);
  });

  it('does not try to refresh when /auth/login returns 401', () => {
    authService.getAccessToken.mockReturnValue('expired-token');

    let receivedError: any;
    http.post(backendAuthLoginURL, { email: 'u', password: 'p' }).subscribe({
      error: (error) => {
        receivedError = error;
      }
    });

    const loginReq = httpMock.expectOne(backendAuthLoginURL);
    expect(loginReq.request.headers.has('Authorization')).toBe(false);
    loginReq.flush({ message: 'invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(authService.expireSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(receivedError).toEqual(expect.objectContaining({ status: 401 }));
  });

  it('does not try to refresh when refresh token is missing', () => {
    authService.getAccessToken.mockReturnValue('expired-token');
    authService.getRefreshToken.mockReturnValue(null);

    let receivedError: any;
    http.get(backendProtectedURL).subscribe({
      error: (error) => {
        receivedError = error;
      }
    });

    const req = httpMock.expectOne(backendProtectedURL);
    req.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(authService.preserveReturnUrlForReauthentication).toHaveBeenCalledWith('/collection/123/text?tab=notes');
    expect(authService.expireSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      replaceUrl: true,
      queryParams: {
        [AUTH_REDIRECT_MARKER_QUERY_PARAM]: AUTH_REDIRECT_MARKER_VALUE
      }
    });
    expect(receivedError).toEqual(expect.objectContaining({ status: 401 }));
  });

  it('logs out and redirects to /login when refresh returns 401', () => {
    authService.getAccessToken.mockReturnValue('expired-token');
    authService.refreshToken.mockReturnValue(
      throwError(() => ({ status: 401 }))
    );

    let receivedError: any;
    http.get(backendProtectedURL).subscribe({
      error: (error) => {
        receivedError = error;
      }
    });

    const firstReq = httpMock.expectOne(backendProtectedURL);
    firstReq.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.preserveReturnUrlForReauthentication).toHaveBeenCalledWith('/collection/123/text?tab=notes');
    expect(authService.expireSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      replaceUrl: true,
      queryParams: {
        [AUTH_REDIRECT_MARKER_QUERY_PARAM]: AUTH_REDIRECT_MARKER_VALUE
      }
    });
    expect(receivedError).toEqual(expect.objectContaining({ status: 401 }));
  });

  it('does not redirect to /login when refresh fails with a non-401 error', () => {
    authService.getAccessToken.mockReturnValue('expired-token');
    authService.refreshToken.mockReturnValue(
      throwError(() => ({ status: 500 }))
    );

    let receivedError: any;
    http.get(backendProtectedURL).subscribe({
      error: (error) => {
        receivedError = error;
      }
    });

    const firstReq = httpMock.expectOne(backendProtectedURL);
    firstReq.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.preserveReturnUrlForReauthentication).not.toHaveBeenCalled();
    expect(authService.expireSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(receivedError).toEqual(expect.objectContaining({ status: 500 }));
  });

  it('logs out and redirects to /login when refreshed access token validation fails', () => {
    authService.getAccessToken.mockReturnValue('expired-token');
    authService.refreshToken.mockReturnValue(
      throwError(() => ({ status: 503, postRefreshSessionValidationFailed: true }))
    );

    let receivedError: any;
    http.get(backendProtectedURL).subscribe({
      error: (error) => {
        receivedError = error;
      }
    });

    const firstReq = httpMock.expectOne(backendProtectedURL);
    firstReq.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.preserveReturnUrlForReauthentication).toHaveBeenCalledWith('/collection/123/text?tab=notes');
    expect(authService.expireSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      replaceUrl: true,
      queryParams: {
        [AUTH_REDIRECT_MARKER_QUERY_PARAM]: AUTH_REDIRECT_MARKER_VALUE
      }
    });
    expect(receivedError).toEqual(expect.objectContaining({
      status: 503,
      postRefreshSessionValidationFailed: true
    }));
  });

  it('does not redirect to /login when refresh fails with a network error', () => {
    authService.getAccessToken.mockReturnValue('expired-token');
    authService.refreshToken.mockReturnValue(
      throwError(() => ({ status: 0 }))
    );

    let receivedError: any;
    http.get(backendProtectedURL).subscribe({
      error: (error) => {
        receivedError = error;
      }
    });

    const firstReq = httpMock.expectOne(backendProtectedURL);
    firstReq.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.preserveReturnUrlForReauthentication).not.toHaveBeenCalled();
    expect(authService.expireSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(receivedError).toEqual(expect.objectContaining({ status: 0 }));
  });

  it('does not try to refresh for non-backend 401 responses', () => {
    authService.getAccessToken.mockReturnValue('expired-token');

    let receivedError: any;
    http.get(nonBackendURL).subscribe({
      error: (error) => {
        receivedError = error;
      }
    });

    const request = httpMock.expectOne(nonBackendURL);
    request.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(authService.refreshToken).not.toHaveBeenCalled();
    expect(authService.expireSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(receivedError).toEqual(expect.objectContaining({ status: 401 }));
  });

  it('falls back to legacy returnUrl query params when marker storage is unavailable during forced re-authentication', () => {
    authService.getAccessToken.mockReturnValue('expired-token');
    authService.getRefreshToken.mockReturnValue(null);
    authService.preserveReturnUrlForReauthentication.mockReturnValue({ returnUrl: '/collection/123/text?tab=notes' });

    http.get(backendProtectedURL).subscribe({
      error: () => undefined
    });

    const req = httpMock.expectOne(backendProtectedURL);
    req.flush({ message: 'unauthorized' }, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      replaceUrl: true,
      queryParams: { returnUrl: '/collection/123/text?tab=notes' }
    });
  });
});

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

function resolveBackendAuthBaseURLForTests(): string {
  const backendAuthBaseURL = config?.app?.auth?.backendAuthBaseURL;
  if (typeof backendAuthBaseURL === 'string' && backendAuthBaseURL.trim().length > 0) {
    return backendAuthBaseURL;
  }

  const backendBaseURL = config?.app?.backendBaseURL;
  if (typeof backendBaseURL !== 'string' || backendBaseURL.trim().length === 0) {
    return '';
  }

  try {
    const parsed = new URL(backendBaseURL);
    return `${parsed.protocol}//${parsed.host}/`;
  } catch {
    return '';
  }
}
