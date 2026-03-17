import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '@services/auth.service';

@Component({
  selector: 'page-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
  standalone: false
})
export class VerifyEmailPage {
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly jwtToken: string = this.resolveJwtTokenFromFragment(this.route.snapshot.fragment);

  readonly verifyEmailError = this.authService.verifyEmailError;
  readonly emailVerificationCompleted = this.authService.emailVerificationCompleted;
  readonly emailVerificationInProgress = this.authService.emailVerificationInProgress;

  constructor() {
    this.authService.clearVerifyEmailState();
    this.scrubJwtFromAddressBar();
    this.authService.verifyEmail(this.jwtToken);
  }

  private scrubJwtFromAddressBar(): void {
    const windowRef = this.document.defaultView;
    if (!windowRef) {
      return;
    }

    try {
      const url = new URL(windowRef.location.href);
      const rawFragment = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
      const fragmentParams = new URLSearchParams(rawFragment);
      if (!fragmentParams.has('jwt')) {
        return;
      }

      fragmentParams.delete('jwt');
      const fragment = fragmentParams.toString();
      const sanitizedUrl = `${url.pathname}${url.search}${fragment ? `#${fragment}` : ''}`;
      windowRef.history.replaceState(windowRef.history.state, '', sanitizedUrl);
    } catch {
      // Ignore parsing/history errors; verification can proceed with in-memory token.
    }
  }

  private resolveJwtTokenFromFragment(fragment: string | null): string {
    if (typeof fragment !== 'string') {
      return '';
    }

    const normalizedFragment = fragment.startsWith('#') ? fragment.slice(1) : fragment;
    return new URLSearchParams(normalizedFragment).get('jwt')?.trim() ?? '';
  }
}
