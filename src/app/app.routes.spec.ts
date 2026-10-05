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
import { routes } from './app.routes';

type RouteExpectation = {
  url: string;
  componentName: string;
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
    expect(navigated).withContext(expectation.url).toBeTrue();

    const leaf = getLeafSnapshot(router.routerState.snapshot.root);
    const componentName = (leaf.component as { name?: string } | null)?.name;
    expect(componentName).withContext(expectation.url).toBe(expectation.componentName);

    if (expectation.parentPath !== undefined) {
      expect(leaf.parent?.routeConfig?.path)
        .withContext(`${expectation.url}: parent route`)
        .toBe(expectation.parentPath);
    }

    for (const [name, value] of Object.entries(expectation.params ?? {})) {
      expect(leaf.paramMap.get(name))
        .withContext(`${expectation.url}: ${name}`)
        .toBe(value);
    }

    for (const [name, value] of Object.entries(expectation.queryParams ?? {})) {
      expect(leaf.queryParamMap.get(name))
        .withContext(`${expectation.url}: query parameter ${name}`)
        .toBe(value);
    }

    return leaf;
  }

  it('recognizes the home, about, policy, article, and content routes', async () => {
    const expectations: RouteExpectation[] = [
      { url: '/', componentName: 'HomePage' },
      { url: '/about', componentName: 'AboutPage', parentPath: 'about' },
      {
        url: '/about/03-01',
        componentName: 'AboutPage',
        parentPath: 'about',
        params: { id: '03-01' }
      },
      {
        url: '/article/example',
        componentName: 'ArticlePage',
        parentPath: 'article',
        params: { name: 'example' }
      },
      { url: '/content', componentName: 'ContentPage' }
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
      const leaf = await expectRecognizedRoute({ url, componentName: 'AboutPage' });
      expect(leaf.parent?.routeConfig?.path).withContext(url).toBe(url.slice(1));
      expect(leaf.parent?.data['backendPageId']).withContext(url).toBe(backendPageId);
      expect(leaf.data['backendPageId']).withContext(`${url}: inherited data`).toBe(backendPageId);
    }
  });

  it('recognizes collection front matter and inherited collection parameters', async () => {
    const expectations: RouteExpectation[] = [
      {
        url: '/collection/203/cover',
        componentName: 'CollectionCoverPage',
        params: { collectionID: '203' }
      },
      {
        url: '/collection/203/title',
        componentName: 'CollectionTitlePage',
        params: { collectionID: '203' }
      },
      {
        url: '/collection/203/foreword',
        componentName: 'CollectionForewordPage',
        params: { collectionID: '203' }
      },
      {
        url: '/collection/203/introduction',
        componentName: 'CollectionIntroductionPage',
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
      componentName: 'CollectionTextPage',
      parentPath: 'collection/:collectionID/text',
      params: { collectionID: '203', publicationID: '1' }
    });
    await expectRecognizedRoute({
      url: '/collection/203/text/1/2',
      componentName: 'CollectionTextPage',
      parentPath: 'collection/:collectionID/text',
      params: { collectionID: '203', publicationID: '1', chapterID: '2' }
    });
  });

  it('recognizes every ebook, search, media collection, and index shape', async () => {
    const expectations: RouteExpectation[] = [
      { url: '/ebook', componentName: 'EbookPage', parentPath: 'ebook' },
      {
        url: '/ebook/example.epub',
        componentName: 'EbookPage',
        parentPath: 'ebook',
        params: { filename: 'example.epub' }
      },
      {
        url: '/ebook/collection/example',
        componentName: 'EbookPage',
        parentPath: 'ebook',
        params: { type: 'collection', name: 'example' }
      },
      { url: '/search', componentName: 'ElasticSearchPage' },
      {
        url: '/search?query=motiv',
        componentName: 'ElasticSearchPage',
        queryParams: { query: 'motiv' }
      },
      { url: '/search/tove', componentName: 'PageNotFoundPage' },
      {
        url: '/media-collection',
        componentName: 'MediaCollectionPage',
        parentPath: 'media-collection'
      },
      {
        url: '/media-collection/portraits',
        componentName: 'MediaCollectionPage',
        parentPath: 'media-collection',
        params: { mediaCollectionID: 'portraits' }
      },
      { url: '/index/persons', componentName: 'IndexPage', params: { type: 'persons' } }
    ];

    for (const expectation of expectations) {
      await expectRecognizedRoute(expectation);
    }
  });

  it('recognizes all auth route entries when their guards allow matching', async () => {
    const expectations: RouteExpectation[] = [
      { url: '/login', componentName: 'LoginPage' },
      { url: '/register', componentName: 'RegisterPage' },
      { url: '/forgot-password', componentName: 'ForgotPasswordPage' },
      { url: '/change-password', componentName: 'ForgotPasswordPage' },
      { url: '/reset-password', componentName: 'ResetPasswordPage' },
      { url: '/verify-email', componentName: 'VerifyEmailPage' },
      { url: '/account', componentName: 'AccountPage' }
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
      expect(route.loadComponent).withContext(path).toBeDefined();
      expect(route.loadChildren).withContext(path).toBeUndefined();
      expect(route.children).withContext(path).toBeUndefined();
    }
  });

  it('preserves redirects, wildcard handling, auth guards, and route data', async () => {
    await expectRecognizedRoute({ url: '/home', componentName: 'HomePage' });
    expect(router.url).toBe('/');

    await expectRecognizedRoute({ url: '/does/not/exist', componentName: 'PageNotFoundPage' });

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
      expect(getConfiguredRoute(path).canMatch).withContext(path)
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
      expect(getConfiguredRoute(path).canActivate).withContext(path).toContain(authGuard);
    }

    expect(getConfiguredRoute('reset-password').canActivate).toContain(resetPasswordJwtGuard);
    expect(getConfiguredRoute('verify-email').canActivate).toContain(verifyEmailJwtGuard);
    expect(getConfiguredRoute('account').data?.['requiresSessionValidation']).toBeTrue();
    expect(getConfiguredRoute('home')).toEqual(jasmine.objectContaining({
      redirectTo: '',
      pathMatch: 'full'
    }));
    expect(routes.at(-1)?.path).toBe('**');
  });

  function getConfiguredRoute(path: string): Route {
    const route = routes.find((candidate: Route) => candidate.path === path);
    expect(route).withContext(path).toBeDefined();
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
