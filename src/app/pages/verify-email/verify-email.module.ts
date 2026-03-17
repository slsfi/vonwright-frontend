import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IonicModule } from '@ionic/angular';

import { VerifyEmailPageRoutingModule } from './verify-email-routing.module';
import { VerifyEmailPage } from './verify-email.page';

@NgModule({
  declarations: [
    VerifyEmailPage
  ],
  imports: [
    CommonModule,
    IonicModule,
    VerifyEmailPageRoutingModule
  ]
})
export class VerifyEmailPageModule {}
