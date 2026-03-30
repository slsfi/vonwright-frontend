import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AuthStatusMessageComponent } from '../../components/auth-status-message/auth-status-message.component';
import { ResetPasswordPageRoutingModule } from './reset-password-routing.module';
import { ResetPasswordPage } from './reset-password.page';

@NgModule({
  declarations: [
    ResetPasswordPage
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    AuthStatusMessageComponent,
    ResetPasswordPageRoutingModule
  ]
})
export class ResetPasswordPageModule {}
