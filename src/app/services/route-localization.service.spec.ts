import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { config } from '@config';
import { Article } from '@models/article.models';
import { RouteLocalizationService } from './route-localization.service';

describe('RouteLocalizationService', () => {
  let originalArticles: Article[];
  let service: RouteLocalizationService;

  const translatedArticles: Article[] = [
    {
      id: '04-01',
      language: 'sv',
      routeName: 'om-tove-jansson'
    },
    {
      id: '04-01',
      language: 'fi',
      routeName: 'tietoa-tove-jansson'
    }
  ];

  beforeEach(() => {
    originalArticles = config.articles ?? [];
    config.articles = translatedArticles;

    TestBed.configureTestingModule({
      providers: [
        { provide: LOCALE_ID, useValue: 'sv' }
      ]
    });

    service = TestBed.inject(RouteLocalizationService);
  });

  afterEach(() => {
    config.articles = originalArticles;
  });

  it('localizes article route names for the target locale', () => {
    expect(
      service.localizeRouterUrl('/article/om-tove-jansson', 'fi')
    ).toBe('/article/tietoa-tove-jansson');
  });

  it('preserves query params and fragments while localizing article routes', () => {
    expect(
      service.localizeRouterUrl('/article/om-tove-jansson?view=full#intro', 'fi')
    ).toBe('/article/tietoa-tove-jansson?view=full#intro');
  });

  it('can resolve stale article route names from another locale', () => {
    expect(
      service.localizeRouterUrl('/article/tietoa-tove-jansson', 'sv')
    ).toBe('/article/om-tove-jansson');
  });

  it('recognizes article route names after a locale prefix', () => {
    expect(
      service.localizeRouterUrl('/sv/article/om-tove-jansson', 'fi')
    ).toBe('/article/tietoa-tove-jansson');
  });

  it('leaves non-localized routes unchanged', () => {
    expect(
      service.localizeRouterUrl('/search?query=tove', 'fi')
    ).toBe('/search?query=tove');
  });
});
