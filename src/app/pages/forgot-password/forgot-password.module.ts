import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AuthStatusMessageComponent } from '../../components/auth-status-message/auth-status-message.component';
import { ForgotPasswordPageRoutingModule } from './forgot-password-routing.module';
import { ForgotPasswordPage } from './forgot-password.page';

@NgModule({
  declarations: [
    ForgotPasswordPage
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    AuthStatusMessageComponent,
    ForgotPasswordPageRoutingModule
  ]
})
export class ForgotPasswordPageModule {}
