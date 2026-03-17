import { Injectable } from '@angular/core';

const AUTH_REDIRECT_STORAGE_KEY = 'auth.returnUrl';

export const AUTH_REDIRECT_MARKER_QUERY_PARAM = 'rt';
export const AUTH_REDIRECT_MARKER_VALUE = '1';

/**
 * Platform-agnostic storage contract for intended post-login redirect URLs.
 *
 * Browser can store ephemeral redirect state in sessionStorage.
 * Server (SSR) implementation is intentionally a no-op.
 */
export abstract class AuthRedirectStorageService {
  /**
   * Stores a return URL for one-time post-login use.
   * Returns true when stored successfully.
   */
  abstract storeReturnUrl(value: string): boolean;

  /**
   * Reads and clears the stored return URL (one-time semantics).
   */
  abstract consumeReturnUrl(): string | null;

  /**
   * Clears any stored return URL.
   */
  abstract clearReturnUrl(): void;
}

/**
 * Browser implementation backed by sessionStorage.
 */
@Injectable()
export class BrowserAuthRedirectStorageService extends AuthRedirectStorageService {
  storeReturnUrl(value: string): boolean {
    try {
      sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, value);
      return true;
    } catch {
      return false;
    }
  }

  consumeReturnUrl(): string | null {
    try {
      const value = sessionStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
      return value;
    } catch {
      return null;
    }
  }

  clearReturnUrl(): void {
    try {
      sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
    } catch {
      // no-op
    }
  }
}

/**
 * Server (SSR) implementation.
 *
 * Redirect targets are not persisted across requests in this setup.
 */
@Injectable()
export class ServerAuthRedirectStorageService extends AuthRedirectStorageService {
  storeReturnUrl(_value: string): boolean {
    return false;
  }

  consumeReturnUrl(): string | null {
    return null;
  }

  clearReturnUrl(): void {}
}
