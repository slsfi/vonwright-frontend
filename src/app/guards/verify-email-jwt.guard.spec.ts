import { TestBed } from '@angular/core/testing';
import { CanActivateFn, UrlTree, provideRouter } from '@angular/router';

import { verifyEmailJwtGuard } from './verify-email-jwt.guard';

describe('verifyEmailJwtGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => verifyEmailJwtGuard(...guardParameters));

  function asUrl(value: unknown): string | null {
    return value instanceof UrlTree ? value.toString() : null;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([])
      ]
    });
  });

  it('allows route when jwt fragment parameter exists', () => {
    const result = executeGuard(
      { fragment: 'jwt=valid-token' } as any,
      {} as any
    );

    expect(result).toBe(true);
  });

  it('allows route when fragment includes a leading #', () => {
    const result = executeGuard(
      { fragment: '#jwt=valid-token' } as any,
      {} as any
    );

    expect(result).toBe(true);
  });

  it('redirects to login when jwt fragment parameter is missing', () => {
    const result = executeGuard(
      { fragment: null } as any,
      {} as any
    );

    expect(asUrl(result)).toBe('/login');
  });

  it('redirects to login when jwt fragment parameter is empty', () => {
    const result = executeGuard(
      { fragment: 'jwt=   ' } as any,
      {} as any
    );

    expect(asUrl(result)).toBe('/login');
  });
});
