import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable, of, Subject, throwError } from 'rxjs';

import {
  AuthRedirectStorageService,
  AUTH_REDIRECT_MARKER_QUERY_PARAM,
  AUTH_REDIRECT_MARKER_VALUE
} from '@services/auth-redirect-storage.service';
import { AuthService } from '@services/auth.service';
import { AUTH_ENABLED } from '@tokens/auth.tokens';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => authGuard(...guardParameters));
  const isAuthenticated = signal<boolean>(false);
  let validateSessionIfStale: jasmine.Spy<() => any>;
  let waitForStartupValidation: jasmine.Spy<() => any>;
  let authRedirectStorage: jasmine.SpyObj<
    Pick<AuthRedirectStorageService, 'storeReturnUrl' | 'consumeReturnUrl' | 'clearReturnUrl'>
  >;

  function asUrl(value: unknown): string | null {
    return value instanceof UrlTree ? value.toString() : null;
  }

  async function resolveGuardResult(result: unknown): Promise<unknown> {
    if (result instanceof Promise) {
      return result;
    }

    if (isObservable(result)) {
      return firstValueFrom(result);
    }

    return result;
  }

  function runGuard(url: string, routeData: Record<string, unknown> = {}): unknown {
    return executeGuard({ data: routeData } as any, { url } as any);
  }

  describe('when auth feature is disabled', () => {
    beforeEach(() => {
      isAuthenticated.set(false);
      validateSessionIfStale = jasmine.createSpy('validateSessionIfStale').and.returnValue(of(true));
      waitForStartupValidation = jasmine.createSpy('waitForStartupValidation').and.returnValue(of(true));
      authRedirectStorage = jasmine.createSpyObj<
        Pick<AuthRedirectStorageService, 'storeReturnUrl' | 'consumeReturnUrl' | 'clearReturnUrl'>
      >('AuthRedirectStorageService', ['storeReturnUrl', 'consumeReturnUrl', 'clearReturnUrl']);
      authRedirectStorage.storeReturnUrl.and.returnValue(true);
      authRedirectStorage.consumeReturnUrl.and.returnValue(null);
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: AUTH_ENABLED, useValue: false },
          { provide: AuthService, useValue: { isAuthenticated, validateSessionIfStale, waitForStartupValidation } },
          { provide: AuthRedirectStorageService, useValue: authRedirectStorage }
        ]
      });
    });

    it('is a no-op and always allows', () => {
      const protectedResult = runGuard('/collection/123/text');
      const loginResult = runGuard('/login');

      expect(protectedResult).toBe(true);
      expect(loginResult).toBe(true);
      expect(validateSessionIfStale).not.toHaveBeenCalled();
    });
  });

  describe('when auth feature is enabled', () => {
    beforeEach(() => {
      isAuthenticated.set(false);
      validateSessionIfStale = jasmine.createSpy('validateSessionIfStale').and.returnValue(of(true));
      waitForStartupValidation = jasmine.createSpy('waitForStartupValidation').and.returnValue(of(true));
      authRedirectStorage = jasmine.createSpyObj<
        Pick<AuthRedirectStorageService, 'storeReturnUrl' | 'consumeReturnUrl' | 'clearReturnUrl'>
      >('AuthRedirectStorageService', ['storeReturnUrl', 'consumeReturnUrl', 'clearReturnUrl']);
      authRedirectStorage.storeReturnUrl.and.returnValue(true);
      authRedirectStorage.consumeReturnUrl.and.returnValue(null);
      TestBed.configureTestingModule({
        providers: [
          provideRouter([]),
          { provide: AUTH_ENABLED, useValue: true },
          { provide: AuthService, useValue: { isAuthenticated, validateSessionIfStale, waitForStartupValidation } },
          { provide: AuthRedirectStorageService, useValue: authRedirectStorage }
        ]
      });
    });

    it('allows protected route when authenticated', async () => {
      isAuthenticated.set(true);

      const result = runGuard('/collection/123/text');

      expect(await resolveGuardResult(result)).toBe(true);
      expect(validateSessionIfStale).not.toHaveBeenCalled();
    });

    it('waits for startup validation before allowing a protected route', async () => {
      const startupValidation = new Subject<boolean>();
      waitForStartupValidation.and.returnValue(startupValidation.asObservable());
      const result = runGuard('/collection/123/text');
      const resolvedResult = resolveGuardResult(result);

      expect(authRedirectStorage.storeReturnUrl).not.toHaveBeenCalled();
      isAuthenticated.set(true);
      startupValidation.next(true);
      startupValidation.complete();

      expect(await resolvedResult).toBe(true);
      expect(validateSessionIfStale).not.toHaveBeenCalled();
    });

    it('redirects protected route to /login when startup validation fails', async () => {
      waitForStartupValidation.and.returnValue(of(false));

      const result = runGuard('/collection/123/text');
      const resolvedResult = await resolveGuardResult(result);

      expect(authRedirectStorage.storeReturnUrl).toHaveBeenCalledWith('/collection/123/text');
      expect(asUrl(resolvedResult)).toBe(`/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}`);
    });

    it('allows /login when startup validation fails', async () => {
      waitForStartupValidation.and.returnValue(of(false));

      const result = runGuard('/login');

      expect(await resolveGuardResult(result)).toBe(true);
    });

    it('validates session for routes requiring session validation when authenticated', async () => {
      isAuthenticated.set(true);
      validateSessionIfStale.and.returnValue(of(true));

      const result = runGuard('/account', { requiresSessionValidation: true });

      expect(await resolveGuardResult(result)).toBe(true);
      expect(validateSessionIfStale).toHaveBeenCalledTimes(1);
    });

    it('redirects to /login when session validation fails with 401', async () => {
      isAuthenticated.set(true);
      validateSessionIfStale.and.returnValue(throwError(() => ({ status: 401 })));

      const result = runGuard('/account', { requiresSessionValidation: true });
      const resolvedResult = await resolveGuardResult(result);

      expect(resolvedResult).toEqual(jasmine.any(UrlTree));
      expect(authRedirectStorage.storeReturnUrl).toHaveBeenCalledWith('/account');
      expect(asUrl(resolvedResult)).toBe(
        `/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}`
      );
    });

    it('redirects to /login when session validation fails with 422', async () => {
      isAuthenticated.set(true);
      validateSessionIfStale.and.returnValue(throwError(() => ({ status: 422 })));

      const result = runGuard('/account', { requiresSessionValidation: true });
      const resolvedResult = await resolveGuardResult(result);

      expect(resolvedResult).toEqual(jasmine.any(UrlTree));
      expect(authRedirectStorage.storeReturnUrl).toHaveBeenCalledWith('/account');
      expect(asUrl(resolvedResult)).toBe(
        `/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}`
      );
    });

    it('fails open when session validation fails with non-401 error', async () => {
      isAuthenticated.set(true);
      validateSessionIfStale.and.returnValue(throwError(() => ({ status: 503 })));

      const result = runGuard('/account', { requiresSessionValidation: true });

      expect(await resolveGuardResult(result)).toBe(true);
      expect(authRedirectStorage.storeReturnUrl).not.toHaveBeenCalled();
    });

    it('redirects protected route to /login when unauthenticated', async () => {
      const result = runGuard('/collection/123/text');
      const resolvedResult = await resolveGuardResult(result);

      expect(authRedirectStorage.clearReturnUrl).toHaveBeenCalledTimes(1);
      expect(authRedirectStorage.storeReturnUrl).toHaveBeenCalledWith('/collection/123/text');
      expect(asUrl(resolvedResult)).toBe(`/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}`);
    });

    it('falls back to legacy returnUrl query param when marker storage fails', async () => {
      authRedirectStorage.storeReturnUrl.and.returnValue(false);

      const result = runGuard('/collection/123/text');
      const resolvedResult = await resolveGuardResult(result);

      expect(authRedirectStorage.clearReturnUrl).toHaveBeenCalledTimes(1);
      expect(asUrl(resolvedResult)).toBe('/login?returnUrl=%2Fcollection%2F123%2Ftext');
    });

    it('allows /login when unauthenticated', async () => {
      const result = runGuard('/login');

      expect(await resolveGuardResult(result)).toBe(true);
    });

    it('allows /register when unauthenticated', async () => {
      const result = runGuard('/register');

      expect(await resolveGuardResult(result)).toBe(true);
    });

    it('allows /login marker flow when unauthenticated without consuming stored return URL', async () => {
      const result = runGuard(`/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}`);

      expect(await resolveGuardResult(result)).toBe(true);
      expect(authRedirectStorage.consumeReturnUrl).not.toHaveBeenCalled();
    });

    it('redirects /login to / when authenticated and returnUrl is missing', async () => {
      isAuthenticated.set(true);

      const result = runGuard('/login');
      const resolvedResult = await resolveGuardResult(result);

      expect(asUrl(resolvedResult)).toBe('/');
    });

    it('redirects /register to / when authenticated', async () => {
      isAuthenticated.set(true);

      const result = runGuard('/register');
      const resolvedResult = await resolveGuardResult(result);

      expect(asUrl(resolvedResult)).toBe('/');
    });

    it('redirects /login to returnUrl when authenticated', async () => {
      isAuthenticated.set(true);

      const result = runGuard('/login?returnUrl=%2Fsearch');
      const resolvedResult = await resolveGuardResult(result);

      expect(asUrl(resolvedResult)).toBe('/search');
    });

    it('redirects /login marker flow to stored URL when authenticated', async () => {
      isAuthenticated.set(true);
      authRedirectStorage.consumeReturnUrl.and.returnValue('/collection/123/text');

      const result = runGuard(`/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}`);
      const resolvedResult = await resolveGuardResult(result);

      expect(authRedirectStorage.consumeReturnUrl).toHaveBeenCalledTimes(1);
      expect(asUrl(resolvedResult)).toBe('/collection/123/text');
    });

    it('ignores non-matching marker value and uses legacy returnUrl when authenticated', async () => {
      isAuthenticated.set(true);

      const result = runGuard('/login?rt=unexpected&returnUrl=%2Fsearch');
      const resolvedResult = await resolveGuardResult(result);

      expect(authRedirectStorage.consumeReturnUrl).not.toHaveBeenCalled();
      expect(asUrl(resolvedResult)).toBe('/search');
    });

    it('falls back to / when stored marker URL is missing or invalid', async () => {
      isAuthenticated.set(true);
      authRedirectStorage.consumeReturnUrl.and.returnValue('//evil.example');

      const result = runGuard(`/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}`);
      const resolvedResult = await resolveGuardResult(result);

      expect(asUrl(resolvedResult)).toBe('/');
    });

    it('ignores unsafe returnUrl and redirects /login to / when authenticated', async () => {
      isAuthenticated.set(true);

      const result = runGuard('/login?returnUrl=%2F%2Fevil.example');
      const resolvedResult = await resolveGuardResult(result);

      expect(asUrl(resolvedResult)).toBe('/');
    });

    it('ignores login-loop returnUrl and redirects /login to / when authenticated', async () => {
      isAuthenticated.set(true);

      const result = runGuard('/login?returnUrl=%2Flogin%3FreturnUrl%3D%252Fsearch');
      const resolvedResult = await resolveGuardResult(result);

      expect(asUrl(resolvedResult)).toBe('/');
    });

    it('ignores too-long returnUrl and redirects /login to / when authenticated', async () => {
      isAuthenticated.set(true);
      const longReturnUrl = `/${'a'.repeat(2001)}`;

      const result = runGuard(`/login?returnUrl=${encodeURIComponent(longReturnUrl)}`);
      const resolvedResult = await resolveGuardResult(result);

      expect(asUrl(resolvedResult)).toBe('/');
    });
  });
});
