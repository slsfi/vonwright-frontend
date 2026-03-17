import { TestBed } from '@angular/core/testing';

import { AUTH_ENABLED } from '@tokens/auth.tokens';
import { authFeatureEnabledMatchGuard } from './auth-feature-enabled-match.guard';

describe('authFeatureEnabledMatchGuard', () => {
  it('returns false when auth feature is disabled', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_ENABLED, useValue: false }
      ]
    });

    const result = TestBed.runInInjectionContext(() =>
      authFeatureEnabledMatchGuard({} as any, [] as any)
    );

    expect(result).toBe(false);
  });

  it('returns true when auth feature is enabled', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AUTH_ENABLED, useValue: true }
      ]
    });

    const result = TestBed.runInInjectionContext(() =>
      authFeatureEnabledMatchGuard({} as any, [] as any)
    );

    expect(result).toBe(true);
  });
});
