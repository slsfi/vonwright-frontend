import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { REQUEST } from 'src/express.tokens';
import {
  BrowserRouterNavigationSourceService,
  ServerRouterNavigationSourceService
} from './router-navigation-source.service';

describe('RouterNavigationSourceService', () => {
  it('emits the final URL after redirects including query params', () => {
    const events = new Subject<NavigationEnd>();
    const emittedUrls: string[] = [];
    const service = new BrowserRouterNavigationSourceService();

    service.get({ events: events.asObservable() } as Router)
      .subscribe((url) => emittedUrls.push(url));

    events.next(new NavigationEnd(1, '/login', '/login?rt=1'));

    expect(emittedUrls).toEqual(['/login?rt=1']);
  });

  it('emits one server request URL and completes', () => {
    TestBed.configureTestingModule({
      providers: [
        ServerRouterNavigationSourceService,
        { provide: REQUEST, useValue: { url: '/sv/index/persons?view=full' } }
      ]
    });
    const service = TestBed.inject(ServerRouterNavigationSourceService);
    const emittedUrls: string[] = [];
    let completed = false;

    service.get({ url: '/router-fallback' } as Router).subscribe({
      next: (url) => emittedUrls.push(url),
      complete: () => completed = true
    });

    expect(emittedUrls).toEqual(['/sv/index/persons?view=full']);
    expect(completed).toBeTrue();
  });
});
