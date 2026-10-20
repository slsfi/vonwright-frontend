import { DOCUMENT, Injector, REQUEST } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { config } from '../project/config';
import { APPLICATION_REQUEST_CONTEXT } from '../app/tokens/request-context.token';
import { createServerRequestContext, provideServerRequestContext } from './server-request-context';

/** Creates a Node-like incoming request with User-Agent available to the browser-run adapter tests. */
function incomingRequest(url: string, userAgent: string): Request {
  const request = new Request(url);
  // Chrome strips User-Agent from guarded Request headers; Node's incoming Request retains it.
  Object.defineProperty(request, 'headers', { value: new Headers({ 'user-agent': userAgent }) });
  return request;
}

describe('Angular Web Request context adapter', () => {
  let originalSiteOrigin: unknown;

  beforeEach(() => {
    originalSiteOrigin = config.app.siteURLOrigin;
    config.app.siteURLOrigin = 'https://edition.example';
  });

  afterEach(() => {
    config.app.siteURLOrigin = originalSiteOrigin;
  });

  it('strips the locale base path while preserving query strings and escaped characters', () => {
    expect(createServerRequestContext(new Request('http://localhost:4201/fi/about/a%20b?search=a%2Bb'), '/fi/'))
      .toEqual({ url: '/about/a%20b?search=a%2Bb', publicOrigin: 'http://localhost:4201', userAgent: undefined });
  });

  it('uses the document base path for custom locale subpaths and nested deployment paths', () => {
    const document = window.document.implementation.createHTMLDocument();
    const base = document.createElement('base');
    base.href = '/edition/francais/';
    document.head.appendChild(base);
    TestBed.configureTestingModule({ providers: [
      { provide: DOCUMENT, useValue: document },
      { provide: REQUEST, useValue: new Request('https://edition.example/edition/francais/about?menu=open') },
      provideServerRequestContext()
    ] });
    expect(TestBed.inject(APPLICATION_REQUEST_CONTEXT)?.url).toBe('/about?menu=open');
  });

  it('maps a locale root to the app root and leaves an unrelated prefix intact', () => {
    expect(createServerRequestContext(new Request('http://localhost:4201/fi/?menu=open'), '/fi/')?.url).toBe('/?menu=open');
    expect(createServerRequestContext(new Request('http://localhost:4201/fi-about'), '/fi/')?.url).toBe('/fi-about');
  });

  it('preserves an unprefixed request path', () => {
    expect(createServerRequestContext(new Request('http://localhost:4201/collection/203/introduction?menu=open'))?.url)
      .toBe('/collection/203/introduction?menu=open');
  });

  it('keeps the configured public HTTPS origin for a matching public host', () => {
    expect(createServerRequestContext(new Request('http://edition.example/fi/'))?.publicOrigin)
      .toBe('https://edition.example');
  });

  it('uses the resolved Web Request origin and does not reinterpret raw forwarding headers', () => {
    const request = new Request('https://localhost:4201/sv/', {
      headers: { 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'http' }
    });
    expect(createServerRequestContext(request)?.publicOrigin).toBe('https://localhost:4201');
  });

  it('copies the complete user agent into an immutable scalar context', () => {
    const request = incomingRequest('http://localhost:4201/fi/', 'Mobile, browser/1.0');
    const context = createServerRequestContext(request);
    request.headers.set('user-agent', 'Desktop');

    expect(context).toEqual({ url: '/fi/', publicOrigin: 'http://localhost:4201', userAgent: 'Mobile, browser/1.0' });
  });

  it('leaves an absent user agent unset', () => {
    expect(createServerRequestContext(new Request('https://edition.example/sv/'))?.userAgent).toBeUndefined();
  });

  it('returns null without a request in browser and build-time contexts', () => {
    expect(createServerRequestContext()).toBeNull();
    expect(createServerRequestContext(null)).toBeNull();
    TestBed.configureTestingModule({ providers: [provideServerRequestContext()] });
    expect(TestBed.inject(APPLICATION_REQUEST_CONTEXT)).toBeNull();
  });

  it('accepts the explicit null value of Angular REQUEST during route extraction', () => {
    TestBed.configureTestingModule({ providers: [
      { provide: REQUEST, useValue: null }, provideServerRequestContext()
    ] });
    expect(TestBed.inject(APPLICATION_REQUEST_CONTEXT)).toBeNull();
  });

  it('resolves Angular REQUEST from the parent and isolates contexts between render injectors', () => {
    const firstParent = Injector.create({ providers: [{ provide: REQUEST, useValue:
      incomingRequest('http://localhost:4201/sv/', 'Desktop')
    }] });
    const secondParent = Injector.create({ providers: [{ provide: REQUEST, useValue:
      incomingRequest('https://edition.example/fi/', 'Mobile')
    }] });
    const first = Injector.create({ parent: firstParent, providers: [provideServerRequestContext()] });
    const second = Injector.create({ parent: secondParent, providers: [provideServerRequestContext()] });

    expect(first.get(APPLICATION_REQUEST_CONTEXT))
      .toEqual({ url: '/sv/', publicOrigin: 'http://localhost:4201', userAgent: 'Desktop' });
    expect(second.get(APPLICATION_REQUEST_CONTEXT))
      .toEqual({ url: '/fi/', publicOrigin: 'https://edition.example', userAgent: 'Mobile' });
  });
});
