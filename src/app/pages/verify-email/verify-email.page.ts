import { Component, inject, OnDestroy } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

import { AuthService } from '@services/auth.service';

@Component({
  selector: 'page-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
  standalone: false
})
export class VerifyEmailPage implements OnDestroy {
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private hasConsumedJwtToken = false;

  readonly verifyEmailError = this.authService.verifyEmailError;
  readonly emailVerificationCompleted = this.authService.emailVerificationCompleted;
  readonly emailVerificationInProgress = this.authService.emailVerificationInProgress;

  ionViewWillEnter(): void {
    const jwtToken = this.resolveJwtTokenFromFragment(this.route.snapshot.fragment);
    if (jwtToken) {
      this.hasConsumedJwtToken = true;
      this.startVerificationFlow(jwtToken);
      return;
    }

    if (this.hasConsumedJwtToken) {
      this.authService.clearVerifyEmailState();
      return;
    }

    this.startVerificationFlow('');
  }

  ionViewWillLeave(): void {
    this.authService.clearVerifyEmailState();
  }

  ngOnDestroy(): void {
    this.authService.clearVerifyEmailState();
  }

  private startVerificationFlow(jwtToken: string = this.resolveJwtTokenFromFragment(this.route.snapshot.fragment)): void {
    this.authService.clearVerifyEmailState();
    this.scrubJwtFromAddressBar();
    this.authService.verifyEmail(jwtToken);
  }

  private scrubJwtFromAddressBar(): void {
    const rawFragment = this.route.snapshot.fragment;
    if (typeof rawFragment !== 'string' || rawFragment.length === 0) {
      return;
    }

    try {
      const fragmentParams = new URLSearchParams(rawFragment);
      if (!fragmentParams.has('jwt')) {
        return;
      }

      fragmentParams.delete('jwt');
      const currentPath = this.location.path();
      const [path, query = ''] = currentPath.split('?');
      const fragment = fragmentParams.toString();
      const sanitizedPath = `${path}${fragment ? `#${fragment}` : ''}`;
      this.location.replaceState(sanitizedPath, query);
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
