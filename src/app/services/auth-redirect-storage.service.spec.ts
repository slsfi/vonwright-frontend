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
      vi.restoreAllMocks();
      sessionStorage.removeItem(storageKey);
    });

    it('stores and consumes return URL with one-time semantics', () => {
      expect(service.storeReturnUrl('/account')).toBe(true);
      expect(service.consumeReturnUrl()).toBe('/account');
      expect(service.consumeReturnUrl()).toBeNull();
    });

    it('clears stored return URL', () => {
      expect(service.storeReturnUrl('/collection/123/text')).toBe(true);

      service.clearReturnUrl();

      expect(service.consumeReturnUrl()).toBeNull();
    });

    it('returns false when storing fails', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });

      expect(service.storeReturnUrl('/account')).toBe(false);
    });

    it('returns null when consuming fails', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage failure');
      });

      expect(service.consumeReturnUrl()).toBeNull();
    });

    it('swallows errors when clearing fails', () => {
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')
        .mockImplementation(() => {
          throw new Error('storage failure');
        });

      expect(() => service.clearReturnUrl()).not.toThrow();

      removeItemSpy.mockRestore();
    });
  });

  describe('ServerAuthRedirectStorageService', () => {
    let service: ServerAuthRedirectStorageService;

    beforeEach(() => {
      service = new ServerAuthRedirectStorageService();
    });

    it('does not store redirect URLs', () => {
      expect(service.storeReturnUrl('/account')).toBe(false);
    });

    it('returns null on consume', () => {
      expect(service.consumeReturnUrl()).toBeNull();
    });

    it('no-ops on clear', () => {
      expect(() => service.clearReturnUrl()).not.toThrow();
    });
  });
});
