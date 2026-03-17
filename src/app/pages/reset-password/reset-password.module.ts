import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

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
    ResetPasswordPageRoutingModule
  ]
})
export class ResetPasswordPageModule {}
