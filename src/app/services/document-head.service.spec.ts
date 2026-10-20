import { DOCUMENT, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { config } from '@config';
import { APPLICATION_REQUEST_CONTEXT, ApplicationRequestContext } from '@tokens/request-context.token';
import { DocumentHeadService } from './document-head.service';

describe('DocumentHeadService request context', () => {
  let testDocument: Document;
  let originalOrigin: unknown;
  let originalI18n: typeof config.app.i18n;
  let originalHome: typeof config.page.home;
  let originalOpenGraph: typeof config.app.openGraphMetaTags;

  beforeEach(() => {
    testDocument = document.implementation.createHTMLDocument('SEO test');
    originalOrigin = config.app.siteURLOrigin;
    originalI18n = config.app.i18n;
    originalHome = config.page.home;
    originalOpenGraph = config.app.openGraphMetaTags;
    config.app.siteURLOrigin = 'https://edition.example';
    config.app.i18n = { defaultLanguage: 'sv', languages: [{ code: 'sv' }, { code: 'fi' }] };
    config.app.openGraphMetaTags = { enabled: true, image: { fi: { URL: 'assets/banner.png' } } };
  });

  afterEach(() => {
    config.app.siteURLOrigin = originalOrigin;
    config.app.i18n = originalI18n;
    config.app.openGraphMetaTags = originalOpenGraph;
    config.page.home = originalHome;
  });

  function createService(context?: ApplicationRequestContext, browserOrigin?: string): DocumentHeadService {
    if (browserOrigin) {
      Object.defineProperty(testDocument, 'defaultView', { value: { location: { origin: browserOrigin } } });
    }
    TestBed.configureTestingModule({
      providers: [
        { provide: DOCUMENT, useValue: testDocument },
        { provide: LOCALE_ID, useValue: 'fi' },
        ...(context ? [{ provide: APPLICATION_REQUEST_CONTEXT, useValue: context }] : [])
      ]
    });
    return TestBed.inject(DocumentHeadService);
  }

  function canonical(): string | null | undefined {
    return testDocument.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
  }

  function ogUrl(): string | null | undefined {
    return testDocument.head.querySelector('meta[property="og:url"]')?.getAttribute('content');
  }

  it('uses the first configured language for canonical and default hreflang links when the default is omitted', () => {
    config.app.i18n = { languages: [{ code: 'fi' }, { code: 'sv' }] };
    const service = createService();
    service.setLinks('/');

    expect(canonical()).toBe('https://edition.example/fi/');
    expect(testDocument.head.querySelector('link[hreflang="x-default"]')?.getAttribute('href'))
      .toBe('https://edition.example/fi/');
  });

  it('uses the home-page default image when both image settings are omitted', () => {
    config.app.openGraphMetaTags = { enabled: true };
    config.page.home = {};
    const service = createService();
    service.setCommonOpenGraphTags();

    expect(testDocument.head.querySelector('meta[property="og:image"]')?.getAttribute('content'))
      .toBe('https://edition.example/fi/assets/images/home-page-banner.jpg');
  });

  it('uses context origin and locale-prefixed request fallback, removing query parameters from SEO URLs', () => {
    const service = createService({
      url: '/fi/collection/211/text/20128?views=(type:readingtext)', publicOrigin: 'https://public.example'
    }, 'http://internal.example:4201');
    service.setLinks('/');
    service.setOpenGraphURLProperty('/');
    service.setCommonOpenGraphTags();

    expect(canonical()).toBe('https://public.example/sv/collection/211/text/20128');
    expect(ogUrl()).toBe('https://public.example/fi/collection/211/text/20128');
    expect(testDocument.head.querySelector('link[hreflang="fi"]')?.getAttribute('href'))
      .toBe('https://public.example/fi/collection/211/text/20128');
    expect(testDocument.head.querySelector('meta[property="og:image"]')?.getAttribute('content'))
      .toBe('https://public.example/fi/assets/banner.png');
  });

  it('preserves the mounted path when it has no locale prefix', () => {
    const service = createService({ url: '/index/persons?view=full', publicOrigin: 'http://localhost:4201' });
    service.setLinks('/');
    service.setOpenGraphURLProperty('/');

    expect(canonical()).toBe('http://localhost:4201/sv/index/persons');
    expect(ogUrl()).toBe('http://localhost:4201/fi/index/persons');
  });

  it('prefers an explicit router path over the initial request snapshot', () => {
    const service = createService({ url: '/collection/203/introduction', publicOrigin: 'https://edition.example' });
    service.setLinks('/about/03-01-01?view=full');
    service.setOpenGraphURLProperty('/about/03-01-01?view=full');

    expect(canonical()).toBe('https://edition.example/sv/about/03-01-01');
    expect(ogUrl()).toBe('https://edition.example/fi/about/03-01-01');
  });

  it('handles a locale root without a trailing slash', () => {
    const service = createService({ url: '/fi?menu=open', publicOrigin: 'https://edition.example' });
    service.setLinks('/');
    service.setOpenGraphURLProperty('/');

    expect(canonical()).toBe('https://edition.example/sv/');
    expect(ogUrl()).toBe('https://edition.example/fi/');
  });

  it('uses browser origin and router URL when request context is unavailable', () => {
    const service = createService(undefined, 'http://localhost:9876');
    service.setLinks('/index/persons?view=full');
    service.setOpenGraphURLProperty('/index/persons?view=full');

    expect(canonical()).toBe('http://localhost:9876/sv/index/persons');
    expect(ogUrl()).toBe('http://localhost:9876/fi/index/persons');
  });

  it('uses browser origin if the context has no public origin', () => {
    const service = createService({ url: '/fi/index/persons?view=full' }, 'http://localhost:9876');
    service.setLinks('/');

    expect(canonical()).toBe('http://localhost:9876/sv/index/persons');
  });

  it('uses configured origin if context and browser location are absent', () => {
    const service = createService();
    service.setLinks('/index/persons');

    expect(canonical()).toBe('https://edition.example/sv/index/persons');
  });

  it('does not invent a localhost origin if all origin sources are absent', () => {
    config.app.siteURLOrigin = undefined;
    const service = createService();
    service.setLinks('/');

    expect(canonical()).toBe('/sv/');
  });
});
