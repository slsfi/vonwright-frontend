import { Route } from '@angular/router';
import { of } from 'rxjs';

import {
  BrowserRouterPreloadingStrategyService,
  ServerRouterPreloadingStrategyService
} from './router-preloading-strategy.service';

describe('RouterPreloadingStrategyService', () => {
  it('preloads eager browser routes immediately', () => {
    const service = new BrowserRouterPreloadingStrategyService();
    const load = jasmine.createSpy('load').and.returnValue(of('loaded'));
    let result: string | undefined;

    service.preload({ data: { preload: 'eager' } } as Route, load)
      .subscribe((value) => result = value);

    expect(load).toHaveBeenCalledTimes(1);
    expect(result).toBe('loaded');
  });

  it('does not preload browser routes configured as off', () => {
    const service = new BrowserRouterPreloadingStrategyService();
    const load = jasmine.createSpy('load').and.returnValue(of('loaded'));

    service.preload({ data: { preload: 'off' } } as Route, load).subscribe();

    expect(load).not.toHaveBeenCalled();
  });

  it('preloads idle browser routes after the fallback delay', () => {
    const service = new BrowserRouterPreloadingStrategyService();
    const load = jasmine.createSpy('load').and.returnValue(of('loaded'));
    const win = window as unknown as { requestIdleCallback?: unknown };
    const requestIdleCallback = win.requestIdleCallback;
    win.requestIdleCallback = undefined;
    jasmine.clock().install();

    try {
      service.preload({ data: { preload: 'idle' } } as Route, load).subscribe();
      jasmine.clock().tick(299);
      expect(load).not.toHaveBeenCalled();

      jasmine.clock().tick(1);
      expect(load).toHaveBeenCalledTimes(1);
    } finally {
      jasmine.clock().uninstall();
      win.requestIdleCallback = requestIdleCallback;
    }
  });

  it('cancels deferred browser preloading when unsubscribed', () => {
    const service = new BrowserRouterPreloadingStrategyService();
    const load = jasmine.createSpy('load').and.returnValue(of('loaded'));
    const win = window as unknown as { requestIdleCallback?: unknown };
    const requestIdleCallback = win.requestIdleCallback;
    win.requestIdleCallback = undefined;
    jasmine.clock().install();

    try {
      const subscription = service.preload(
        { data: { preload: 'idle' } } as Route,
        load
      ).subscribe();
      subscription.unsubscribe();
      jasmine.clock().tick(300);

      expect(load).not.toHaveBeenCalled();
    } finally {
      jasmine.clock().uninstall();
      win.requestIdleCallback = requestIdleCallback;
    }
  });

  it('never preloads routes on the server', () => {
    const service = new ServerRouterPreloadingStrategyService();
    const load = jasmine.createSpy('load').and.returnValue(of('loaded'));

    service.preload({ data: { preload: 'eager' } } as Route, load).subscribe();

    expect(load).not.toHaveBeenCalled();
  });
});
