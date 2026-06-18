import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { BrowserRouterNavigationSourceService } from './router-navigation-source.service';

describe('BrowserRouterNavigationSourceService', () => {
  it('emits the final URL after redirects including query params', () => {
    const events = new Subject<NavigationEnd>();
    const emittedUrls: string[] = [];
    const service = new BrowserRouterNavigationSourceService();

    service.get({ events: events.asObservable() } as Router)
      .subscribe((url) => emittedUrls.push(url));

    events.next(new NavigationEnd(1, '/login', '/login?rt=1'));

    expect(emittedUrls).toEqual(['/login?rt=1']);
  });
});
