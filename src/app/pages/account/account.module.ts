import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

import { AccountPageRoutingModule } from './account-routing.module';
import { AccountPage } from './account.page';

@NgModule({
  declarations: [
    AccountPage
  ],
  imports: [
    CommonModule,
    IonicModule,
    AccountPageRoutingModule
  ]
})
export class AccountPageModule {}
