import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { RouterPreloadingStrategyService } from '@services/router-preloading-strategy.service';
import { routes } from './app.routes';

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      preloadingStrategy: RouterPreloadingStrategyService,
      initialNavigation: 'enabledBlocking'
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
