import { DefaultUrlSerializer, Router, UrlTree } from '@angular/router';

import {
  AuthRedirectStorageService,
  AUTH_REDIRECT_MARKER_QUERY_PARAM,
  AUTH_REDIRECT_MARKER_VALUE
} from '@services/auth-redirect-storage.service';
import { createLoginRedirectQueryParams, getAuthRedirectNavigationQueryParams } from './auth-redirect-url.utils';

describe('auth-redirect-url utils', () => {
  function createRouter(): Pick<Router, 'parseUrl'> {
    const serializer = new DefaultUrlSerializer();
    return {
      parseUrl: (url: string): UrlTree => serializer.parse(url)
    };
  }

  it('forwards marker and safe returnUrl query params for auth navigation links', () => {
    const router = createRouter();

    const result = getAuthRedirectNavigationQueryParams(
      router as Router,
      `/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}&returnUrl=%2Fcollection%2F123%2Ftext`
    );

    expect(result).toEqual({
      [AUTH_REDIRECT_MARKER_QUERY_PARAM]: AUTH_REDIRECT_MARKER_VALUE,
      returnUrl: '/collection/123/text'
    });
  });

  it('does not forward invalid redirect marker value', () => {
    const router = createRouter();

    const result = getAuthRedirectNavigationQueryParams(
      router as Router,
      '/login?rt=unexpected&returnUrl=%2Fsearch'
    );

    expect(result).toEqual({
      returnUrl: '/search'
    });
  });

  it('does not forward unsafe returnUrl values', () => {
    const router = createRouter();

    const result = getAuthRedirectNavigationQueryParams(
      router as Router,
      `/login?${AUTH_REDIRECT_MARKER_QUERY_PARAM}=${AUTH_REDIRECT_MARKER_VALUE}&returnUrl=%2F%2Fevil.example`
    );

    expect(result).toEqual({
      [AUTH_REDIRECT_MARKER_QUERY_PARAM]: AUTH_REDIRECT_MARKER_VALUE
    });
  });

  it('does not forward guest auth loop returnUrl values', () => {
    const router = createRouter();

    const result = getAuthRedirectNavigationQueryParams(
      router as Router,
      '/register?returnUrl=%2Flogin%3FreturnUrl%3D%252Fsearch'
    );

    expect(result).toEqual({});
  });

  it('returns empty query params when URL parsing fails', () => {
    const router = {
      parseUrl: (_url: string): UrlTree => {
        throw new Error('failed to parse');
      }
    };

    const result = getAuthRedirectNavigationQueryParams(router as Router, '/login?returnUrl=%2Fsearch');

    expect(result).toEqual({});
  });

  it('builds marker-based login redirect params when storage is available', () => {
    const router = createRouter();
    const authRedirectStorage: Pick<AuthRedirectStorageService, 'storeReturnUrl' | 'clearReturnUrl'> = {
      storeReturnUrl: () => true,
      clearReturnUrl: jasmine.createSpy('clearReturnUrl')
    };

    const result = createLoginRedirectQueryParams(router as Router, authRedirectStorage, '/collection/123/text');

    expect(authRedirectStorage.clearReturnUrl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      [AUTH_REDIRECT_MARKER_QUERY_PARAM]: AUTH_REDIRECT_MARKER_VALUE
    });
  });

  it('falls back to legacy returnUrl when storage is unavailable', () => {
    const router = createRouter();
    const authRedirectStorage: Pick<AuthRedirectStorageService, 'storeReturnUrl' | 'clearReturnUrl'> = {
      storeReturnUrl: () => false,
      clearReturnUrl: jasmine.createSpy('clearReturnUrl')
    };

    const result = createLoginRedirectQueryParams(router as Router, authRedirectStorage, '/collection/123/text');

    expect(result).toEqual({ returnUrl: '/collection/123/text' });
  });

  it('returns undefined redirect params for unsafe targets', () => {
    const router = createRouter();
    const authRedirectStorage: Pick<AuthRedirectStorageService, 'storeReturnUrl' | 'clearReturnUrl'> = {
      storeReturnUrl: jasmine.createSpy('storeReturnUrl').and.returnValue(true),
      clearReturnUrl: jasmine.createSpy('clearReturnUrl')
    };

    const result = createLoginRedirectQueryParams(router as Router, authRedirectStorage, '//evil.example');

    expect(authRedirectStorage.clearReturnUrl).toHaveBeenCalledTimes(1);
    expect(authRedirectStorage.storeReturnUrl).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
