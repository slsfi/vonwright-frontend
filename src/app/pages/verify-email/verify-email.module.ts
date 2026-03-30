import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';

import { AuthStatusMessageComponent } from '../../components/auth-status-message/auth-status-message.component';
import { VerifyEmailPageRoutingModule } from './verify-email-routing.module';
import { VerifyEmailPage } from './verify-email.page';

@NgModule({
  declarations: [
    VerifyEmailPage
  ],
  imports: [
    CommonModule,
    IonicModule,
    AuthStatusMessageComponent,
    VerifyEmailPageRoutingModule
  ]
})
export class VerifyEmailPageModule {}
