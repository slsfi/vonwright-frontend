import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { config } from '@config';
import { Article } from '@models/article.models';
import { AUTH_ENABLED } from '@tokens/auth.tokens';
import { TopMenuComponent } from './top-menu.component';

type TestTopMenuComponent = TopMenuComponent & {
  languageHrefByCode: () => Record<string, string>;
};

describe('TopMenuComponent', () => {
  let originalArticles: Article[];
  let router: { url: string };

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

  beforeEach(async () => {
    originalArticles = config.articles ?? [];
    config.articles = [];
    router = { url: '/' };

    await TestBed.configureTestingModule({
      imports: [TopMenuComponent],
      providers: [
        { provide: AUTH_ENABLED, useValue: false },
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: Router, useValue: router }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    config.articles = originalArticles;
  });

  function createComponent() {
    const fixture = TestBed.createComponent(TopMenuComponent);
    return {
      fixture,
      component: fixture.componentInstance as TestTopMenuComponent
    };
  }

  it('preserves router query params when the input URL has the same path without query params', () => {
    router.url = '/login?rt=1';
    const { fixture, component } = createComponent();

    fixture.componentRef.setInput('currentRouterUrl', '/login');

    expect(component.languageHrefByCode()['fi']).toBe('/fi/login?rt=1');
  });

  it('uses input query params when they are already present', () => {
    router.url = '/login?rt=1';
    const { fixture, component } = createComponent();

    fixture.componentRef.setInput('currentRouterUrl', '/login?returnUrl=%2Fsearch');

    expect(component.languageHrefByCode()['fi']).toBe('/fi/login?returnUrl=%2Fsearch');
  });

  it('localizes article route names in language links', () => {
    config.articles = translatedArticles;
    router.url = '/article/om-tove-jansson';
    const { fixture, component } = createComponent();

    fixture.componentRef.setInput('currentRouterUrl', '/article/om-tove-jansson');

    expect(component.languageHrefByCode()['fi']).toBe('/fi/article/tietoa-tove-jansson');
  });

  it('preserves live router query params while localizing article route names', () => {
    config.articles = translatedArticles;
    router.url = '/article/om-tove-jansson?view=full';
    const { fixture, component } = createComponent();

    fixture.componentRef.setInput('currentRouterUrl', '/article/om-tove-jansson');

    expect(component.languageHrefByCode()['fi']).toBe('/fi/article/tietoa-tove-jansson?view=full');
  });
});
