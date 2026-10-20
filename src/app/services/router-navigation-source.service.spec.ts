import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';

import { APPLICATION_REQUEST_CONTEXT } from '@tokens/request-context.token';
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
        { provide: APPLICATION_REQUEST_CONTEXT, useValue: { url: '/sv/index/persons?view=full' } }
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
    expect(completed).toBe(true);
  });

  for (const context of [null, { url: '' }]) {
    it(`uses the router URL when request context is ${context ? 'empty' : 'null'}`, () => {
      TestBed.configureTestingModule({
        providers: [
          ServerRouterNavigationSourceService,
          { provide: APPLICATION_REQUEST_CONTEXT, useValue: context }
        ]
      });
      const emittedUrls: string[] = [];
      TestBed.inject(ServerRouterNavigationSourceService)
        .get({ url: '/index/persons?view=full' } as Router)
        .subscribe(url => emittedUrls.push(url));

      expect(emittedUrls).toEqual(['/index/persons?view=full']);
    });
  }

  it('uses the router URL when no request-context provider is installed', () => {
    TestBed.configureTestingModule({ providers: [ServerRouterNavigationSourceService] });
    const emittedUrls: string[] = [];
    TestBed.inject(ServerRouterNavigationSourceService)
      .get({ url: '/browser-fallback?menu=open' } as Router)
      .subscribe(url => emittedUrls.push(url));

    expect(emittedUrls).toEqual(['/browser-fallback?menu=open']);
  });
});
