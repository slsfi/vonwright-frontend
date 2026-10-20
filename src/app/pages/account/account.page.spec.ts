import type { MockedObject } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '@services/auth.service';
import { AccountPage } from './account.page';

describe('AccountPage', () => {
  const authenticatedEmail = signal<string | null>(null);
  let authService: MockedObject<Pick<AuthService, 'logout'>>
    & Pick<AuthService, 'authenticatedEmail'>;

  beforeEach(async () => {
    authenticatedEmail.set(null);
    authService = {
      logout: vi.fn().mockName('AuthService.logout'),
      authenticatedEmail
    };

    await TestBed.configureTestingModule({
      imports: [AccountPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();
  });

  it('renders authenticated-email changes without a manual change-detection pass', async () => {
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();

    authenticatedEmail.set('reader@example.org');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('reader@example.org');
  });

  it('logs out and redirects to login', () => {
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const component = TestBed.createComponent(AccountPage).componentInstance;

    component.logout();

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith('/login');
  });
});
