import {
  BrowserAuthRedirectStorageService,
  ServerAuthRedirectStorageService
} from './auth-redirect-storage.service';

describe('AuthRedirectStorageService', () => {
  const storageKey = 'auth.returnUrl';

  describe('BrowserAuthRedirectStorageService', () => {
    let service: BrowserAuthRedirectStorageService;

    beforeEach(() => {
      service = new BrowserAuthRedirectStorageService();
      sessionStorage.removeItem(storageKey);
    });

    afterEach(() => {
      sessionStorage.removeItem(storageKey);
    });

    it('stores and consumes return URL with one-time semantics', () => {
      expect(service.storeReturnUrl('/account')).toBeTrue();
      expect(service.consumeReturnUrl()).toBe('/account');
      expect(service.consumeReturnUrl()).toBeNull();
    });

    it('clears stored return URL', () => {
      expect(service.storeReturnUrl('/collection/123/text')).toBeTrue();

      service.clearReturnUrl();

      expect(service.consumeReturnUrl()).toBeNull();
    });

    it('returns false when storing fails', () => {
      spyOn(Storage.prototype, 'setItem').and.throwError('quota exceeded');

      expect(service.storeReturnUrl('/account')).toBeFalse();
    });

    it('returns null when consuming fails', () => {
      spyOn(Storage.prototype, 'getItem').and.throwError('storage failure');

      expect(service.consumeReturnUrl()).toBeNull();
    });

    it('swallows errors when clearing fails', () => {
      spyOn(Storage.prototype, 'removeItem').and.throwError('storage failure');

      expect(() => service.clearReturnUrl()).not.toThrow();
    });
  });

  describe('ServerAuthRedirectStorageService', () => {
    let service: ServerAuthRedirectStorageService;

    beforeEach(() => {
      service = new ServerAuthRedirectStorageService();
    });

    it('does not store redirect URLs', () => {
      expect(service.storeReturnUrl('/account')).toBeFalse();
    });

    it('returns null on consume', () => {
      expect(service.consumeReturnUrl()).toBeNull();
    });

    it('no-ops on clear', () => {
      expect(() => service.clearReturnUrl()).not.toThrow();
    });
  });
});
