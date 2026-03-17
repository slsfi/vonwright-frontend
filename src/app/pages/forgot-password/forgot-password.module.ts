import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

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
    ForgotPasswordPageRoutingModule
  ]
})
export class ForgotPasswordPageModule {}
