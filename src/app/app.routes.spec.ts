import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Route,
  Router,
  Routes,
  withRouterConfig
} from '@angular/router';

import { authFeatureEnabledMatchGuard } from '@guards/auth-feature-enabled-match.guard';
import { authGuard } from '@guards/auth.guard';
import { resetPasswordJwtGuard } from '@guards/reset-password-jwt.guard';
import { verifyEmailJwtGuard } from '@guards/verify-email-jwt.guard';
import { HomePage } from './pages/home/home.page';
import { AboutPage } from './pages/about/about.page';
import { ArticlePage } from './pages/article/article.page';
import { ContentPage } from './pages/content/content.page';
import { CollectionCoverPage } from './pages/collection/cover/collection-cover.page';
import { CollectionTitlePage } from './pages/collection/title/collection-title.page';
import { CollectionForewordPage } from './pages/collection/foreword/collection-foreword.page';
import { CollectionIntroductionPage } from './pages/collection/introduction/collection-introduction.page';
import { CollectionTextPage } from './pages/collection/text/collection-text.page';
import { EbookPage } from './pages/ebook/ebook.page';
import { ElasticSearchPage } from './pages/elastic-search/elastic-search.page';
import { MediaCollectionPage } from './pages/media-collection/media-collection.page';
import { IndexPage } from './pages/index/index.page';
import { PageNotFoundPage } from './pages/page-not-found/page-not-found.page';
import { LoginPage } from './pages/login/login.page';
import { RegisterPage } from './pages/register/register.page';
import { ForgotPasswordPage } from './pages/forgot-password/forgot-password.page';
import { ResetPasswordPage } from './pages/reset-password/reset-password.page';
import { VerifyEmailPage } from './pages/verify-email/verify-email.page';
import { AccountPage } from './pages/account/account.page';
import { routes } from './app.routes';

type RouteExpectation = {
  url: string;
  component: Type<unknown>;
  parentPath?: string;
  params?: Record<string, string>;
  queryParams?: Record<string, string>;
};

describe('application routes', () => {
  let router: Router;

  beforeEach(() => {
    const recognitionRoutes: Routes = routes.map((route: Route) => ({
      ...route,
      canActivate: [],
      canMatch: []
    }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          recognitionRoutes,
          withRouterConfig({ paramsInheritanceStrategy: 'emptyOnly' })
        )
      ]
    });

    router = TestBed.inject(Router);
  });

  async function expectRecognizedRoute(expectation: RouteExpectation): Promise<ActivatedRouteSnapshot> {
    const navigated = await router.navigateByUrl(expectation.url);
    expect(navigated, expectation.url).toBe(true);

    const leaf = getLeafSnapshot(router.routerState.snapshot.root);
    expect(leaf.component, expectation.url).toBe(expectation.component);

    if (expectation.parentPath !== undefined) {
      expect(leaf.parent?.routeConfig?.path, `${expectation.url}: parent route`)
        .toBe(expectation.parentPath);
    }

    for (const [name, value] of Object.entries(expectation.params ?? {})) {
      expect(leaf.paramMap.get(name), `${expectation.url}: ${name}`)
        .toBe(value);
    }

    for (const [name, value] of Object.entries(expectation.queryParams ?? {})) {
      expect(leaf.queryParamMap.get(name), `${expectation.url}: query parameter ${name}`)
        .toBe(value);
    }

    return leaf;
  }

  it('recognizes the home, about, policy, article, and content routes', async () => {
    const expectations: RouteExpectation[] = [
      { url: '/', component: HomePage },
      { url: '/about', component: AboutPage, parentPath: 'about' },
      {
        url: '/about/03-01',
        component: AboutPage,
        parentPath: 'about',
        params: { id: '03-01' }
      },
      {
        url: '/article/example',
        component: ArticlePage,
        parentPath: 'article',
        params: { name: 'example' }
      },
      { url: '/content', component: ContentPage }
    ];

    for (const expectation of expectations) {
      await expectRecognizedRoute(expectation);
    }

    const policyPageIds: Record<string, string> = {
      '/cookie-policy': '05-01',
      '/privacy-policy': '05-02',
      '/terms': '05-03',
      '/accessibility-statement': '05-04'
    };

    for (const [url, backendPageId] of Object.entries(policyPageIds)) {
      const leaf = await expectRecognizedRoute({ url, component: AboutPage });
      expect(leaf.parent?.routeConfig?.path, url).toBe(url.slice(1));
      expect(leaf.parent?.data['backendPageId'], url).toBe(backendPageId);
      expect(leaf.data['backendPageId'], `${url}: inherited data`).toBe(backendPageId);
    }
  });

  it('recognizes collection front matter and inherited collection parameters', async () => {
    const expectations: RouteExpectation[] = [
      {
        url: '/collection/203/cover',
        component: CollectionCoverPage,
        params: { collectionID: '203' }
      },
      {
        url: '/collection/203/title',
        component: CollectionTitlePage,
        params: { collectionID: '203' }
      },
      {
        url: '/collection/203/foreword',
        component: CollectionForewordPage,
        params: { collectionID: '203' }
      },
      {
        url: '/collection/203/introduction',
        component: CollectionIntroductionPage,
        params: { collectionID: '203' }
      }
    ];

    for (const expectation of expectations) {
      await expectRecognizedRoute(expectation);
    }
  });

  it('recognizes collection text routes with publication and optional chapter parameters', async () => {
    await expectRecognizedRoute({
      url: '/collection/203/text/1',
      component: CollectionTextPage,
      parentPath: 'collection/:collectionID/text',
      params: { collectionID: '203', publicationID: '1' }
    });
    await expectRecognizedRoute({
      url: '/collection/203/text/1/2',
      component: CollectionTextPage,
      parentPath: 'collection/:collectionID/text',
      params: { collectionID: '203', publicationID: '1', chapterID: '2' }
    });
  });

  it('recognizes every ebook, search, media collection, and index shape', async () => {
    const expectations: RouteExpectation[] = [
      { url: '/ebook', component: EbookPage, parentPath: 'ebook' },
      {
        url: '/ebook/example.epub',
        component: EbookPage,
        parentPath: 'ebook',
        params: { filename: 'example.epub' }
      },
      {
        url: '/ebook/collection/example',
        component: EbookPage,
        parentPath: 'ebook',
        params: { type: 'collection', name: 'example' }
      },
      { url: '/search', component: ElasticSearchPage },
      {
        url: '/search?query=motiv',
        component: ElasticSearchPage,
        queryParams: { query: 'motiv' }
      },
      { url: '/search/tove', component: PageNotFoundPage },
      {
        url: '/media-collection',
        component: MediaCollectionPage,
        parentPath: 'media-collection'
      },
      {
        url: '/media-collection/portraits',
        component: MediaCollectionPage,
        parentPath: 'media-collection',
        params: { mediaCollectionID: 'portraits' }
      },
      { url: '/index/persons', component: IndexPage, params: { type: 'persons' } }
    ];

    for (const expectation of expectations) {
      await expectRecognizedRoute(expectation);
    }
  });

  it('recognizes all auth route entries when their guards allow matching', async () => {
    const expectations: RouteExpectation[] = [
      { url: '/login', component: LoginPage },
      { url: '/register', component: RegisterPage },
      { url: '/forgot-password', component: ForgotPasswordPage },
      { url: '/change-password', component: ForgotPasswordPage },
      { url: '/reset-password', component: ResetPasswordPage },
      { url: '/verify-email', component: VerifyEmailPage },
      { url: '/account', component: AccountPage }
    ];

    for (const expectation of expectations) {
      await expectRecognizedRoute(expectation);
    }
  });

  it('loads simple routes directly as standalone components', () => {
    const simpleRoutePaths = [
      '',
      'content',
      'collection/:collectionID/cover',
      'collection/:collectionID/title',
      'collection/:collectionID/foreword',
      'collection/:collectionID/introduction',
      'login',
      'register',
      'forgot-password',
      'change-password',
      'reset-password',
      'verify-email',
      'account',
      'index/:type',
      'search',
      '**'
    ];

    for (const path of simpleRoutePaths) {
      const route = getConfiguredRoute(path);
      expect(route.loadComponent, path).toBeDefined();
      expect(route.loadChildren, path).toBeUndefined();
      expect(route.children, path).toBeUndefined();
    }
  });

  it('preserves redirects, wildcard handling, auth guards, and route data', async () => {
    await expectRecognizedRoute({ url: '/home', component: HomePage });
    expect(router.url).toBe('/');

    await expectRecognizedRoute({ url: '/does/not/exist', component: PageNotFoundPage });

    const authOnlyPaths = [
      'login',
      'register',
      'forgot-password',
      'change-password',
      'reset-password',
      'verify-email',
      'account'
    ];
    for (const path of authOnlyPaths) {
      expect(getConfiguredRoute(path).canMatch, path)
        .toContain(authFeatureEnabledMatchGuard);
    }

    const authGuardPaths = [
      'content',
      'collection/:collectionID/cover',
      'collection/:collectionID/title',
      'collection/:collectionID/foreword',
      'collection/:collectionID/introduction',
      'collection/:collectionID/text',
      'login',
      'register',
      'change-password',
      'account',
      'index/:type',
      'media-collection',
      'search'
    ];
    for (const path of authGuardPaths) {
      expect(getConfiguredRoute(path).canActivate, path).toContain(authGuard);
    }

    expect(getConfiguredRoute('reset-password').canActivate).toContain(resetPasswordJwtGuard);
    expect(getConfiguredRoute('verify-email').canActivate).toContain(verifyEmailJwtGuard);
    expect(getConfiguredRoute('account').data?.['requiresSessionValidation']).toBe(true);
    expect(getConfiguredRoute('home')).toEqual(expect.objectContaining({
      redirectTo: '',
      pathMatch: 'full'
    }));
    expect(routes.at(-1)?.path).toBe('**');
  });

  function getConfiguredRoute(path: string): Route {
    const route = routes.find((candidate: Route) => candidate.path === path);
    expect(route, path).toBeDefined();
    return route as Route;
  }

  function getLeafSnapshot(root: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = root;
    while (current.firstChild) {
      current = current.firstChild;
    }
    return current;
  }
});
