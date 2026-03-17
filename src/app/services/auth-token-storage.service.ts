import { Injectable } from '@angular/core';

/**
 * Platform-agnostic token storage contract used by AuthService.
 *
 * Why this exists:
 * - Browser code can persist auth tokens in web storage.
 * - Server-side rendering must not touch browser globals such as localStorage.
 *
 * Platform-specific implementations are provided in AppModule/AppServerModule.
 */
export abstract class AuthTokenStorageService {
  /**
   * Stores a string value for the given key.
   */
  abstract setItem(key: string, value: string): void;
  /**
   * Reads a string value for the given key, or null if missing.
   */
  abstract getItem(key: string): string | null;
  /**
   * Removes the given key from storage.
   */
  abstract removeItem(key: string): void;
}

/**
 * Browser implementation backed by localStorage.
 */
@Injectable()
export class BrowserAuthTokenStorageService extends AuthTokenStorageService {
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value);
  }

  getItem(key: string): string | null {
    return localStorage.getItem(key);
  }

  removeItem(key: string): void {
    localStorage.removeItem(key);
  }
}

/**
 * Server (SSR) implementation.
 *
 * Tokens are intentionally not persisted on the server in this setup.
 * Reads return null and writes/removes are no-ops.
 */
@Injectable()
export class ServerAuthTokenStorageService extends AuthTokenStorageService {
  setItem(_key: string, _value: string): void {}

  getItem(_key: string): string | null {
    return null;
  }

  removeItem(_key: string): void {}
}
