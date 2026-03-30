import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AuthStatusMessageComponent } from '../../components/auth-status-message/auth-status-message.component';
import { LoginPageRoutingModule } from './login-routing.module';
import { LoginPage } from './login.page';

@NgModule({
  declarations: [
    LoginPage
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    AuthStatusMessageComponent,
    LoginPageRoutingModule
  ]
})
export class LoginPageModule {}
