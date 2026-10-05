import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';

import { AuthService } from '@services/auth.service';

@Component({
  selector: 'page-account',
  templateUrl: './account.page.html',
  styleUrls: ['./account.page.scss'],
  imports: [IonButton, IonContent, RouterLink]
})
export class AccountPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly authenticatedEmail = this.authService.authenticatedEmail;

  logout(): void {
    this.authService.logout();
    this.router.navigateByUrl('/login');
  }
}
