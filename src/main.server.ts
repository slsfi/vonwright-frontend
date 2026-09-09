import {
  ApplicationRef,
  provideZoneChangeDetection,
} from '@angular/core';
import type { BootstrapContext } from '@angular/platform-browser';

import { AppServerModule } from './app/app.server.module';

const bootstrap = async (
  context: BootstrapContext,
): Promise<ApplicationRef> => {
  const moduleRef = await context.platformRef.bootstrapModule(
    AppServerModule,
    {
      applicationProviders: [provideZoneChangeDetection()],
    },
  );

  return moduleRef.injector.get(ApplicationRef);
};

export default bootstrap;
