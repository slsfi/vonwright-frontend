import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';
import { IonicServerModule } from '@ionic/angular-server';

import { AppModule } from './app.module';
import { DigitalEditionApp } from './app.component';


@NgModule({
  imports: [
    AppModule,
    ServerModule,
    IonicServerModule,
  ],
  bootstrap: [DigitalEditionApp],
})
export class AppServerModule {}
