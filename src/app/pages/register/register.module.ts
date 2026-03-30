import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AuthStatusMessageComponent } from '../../components/auth-status-message/auth-status-message.component';
import { RegisterPageRoutingModule } from './register-routing.module';
import { RegisterPage } from './register.page';

@NgModule({
  declarations: [
    RegisterPage
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    AuthStatusMessageComponent,
    RegisterPageRoutingModule
  ]
})
export class RegisterPageModule {}
