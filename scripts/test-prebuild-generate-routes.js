/*
 * Regression tests for the route parser and browser/server route generation.
 *
 * Usage (from the repository root, with dependencies installed):
 *   npm run test:routes-parser
 *   node scripts/test-prebuild-generate-routes.js
 *
 * Coverage:
 *   - Route extraction with comments, quote styles, parameters, and lazy routes.
 *   - Feature filtering and auth-dependent server/client rendering metadata.
 *   - Omitted search-button settings and sitemap default-language selection.
 *   - Deterministic generated browser routes and Angular server-rendering routes.
 *   - Generated ServerRoute[] compatibility with the installed Angular SSR types.
 *   - Parsing the repository's canonical src/app/app.routes.ts.
 *
 * Run after generator changes or generator-facing route syntax changes. Uses fixture
 * configuration and intercepts generated file writes; no build, backend, or running
 * app is required. TypeScript checks run without emitting files.
 *
 * Exit codes:
 *   0: all checks passed.
 *   1: an assertion or runtime error occurred.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('node:vm');
const common = require('../prebuild-common-fns');
const {
  generateRoutes,
  createRouteGenerationPlan,
  extractRouteBlocks,
  extractRoutesArrayBody,
  getAuthProtectedRoutePaths,
  getServerRoutes,
  extractAuthProtectedRoutePaths,
  getRoutePath,
  isAuthProtectedRouteBlock,
  stripCommentsPreserveLiterals
} = require('../prebuild-generate-routes');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function readServerRoutes(content) {
  return Array.from(content.matchAll(/\{ path: ("(?:[^"\\]|\\.)*"), renderMode: RenderMode\.(Client|Server) \}/g), match => ({
    path: JSON.parse(match[1]), renderMode: match[2]
  }));
}

function assertServerRouteTypes(content) {
  const filename = path.resolve(__dirname, '../src/app/app.routes.server.generated.ts');
  const options = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    types: []
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile;
  host.readFile = file => path.resolve(file) === filename ? content : readFile(file);
  const program = ts.createProgram([filename], options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error);
  assert.strictEqual(errors.length, 0, ts.formatDiagnostics(errors, {
    getCanonicalFileName: file => file,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n'
  }));
}

const standaloneRoutesSource = `
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage)
  },
  // This comment contains } ] and should not break parsing.
  /* This block comment contains { [ ] } and should not break parsing. */
  {
    path: "about",
    loadChildren: () => import('./pages/about/about.routes').then(m => m.aboutRoutes)
  },
  {
    path: 'content',
    data: {
      label: 'text'
    },
    // Inline comment with ] and }
    loadComponent: () => import('./pages/content/content.page').then(m => m.ContentPage),
    canActivate: [authGuard]
  },
  {
    path: 'article',
    loadChildren: () => import('./pages/article/article.routes').then(m => m.articleRoutes)
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/elastic-search/elastic-search.page').then(m => m.ElasticSearchPage),
    canActivate: [authGuard]
  },
  {
    path: \`**\`,
    loadComponent: () => import('./pages/page-not-found/page-not-found.page').then(m => m.PageNotFoundPage)
  }
];
`;

function createGeneratorConfig(featureBasedRoutes, authEnabled) {
  return {
    app: {
      auth: { enabled: authEnabled },
      prebuild: { featureBasedRoutes }
    },
    articles: [{ name: 'example' }],
    collections: { order: [] },
    component: {
      mainSideMenu: {
        items: {
          about: true,
          articles: false,
          search: false
        }
      },
      topMenu: { showElasticSearchButton: false }
    },
    ebooks: []
  };
}

test('extractRouteBlocks handles standalone routes and comments containing braces and brackets', () => {
  const blocks = extractRouteBlocks(standaloneRoutesSource);
  assert.strictEqual(blocks.length, 6);
  assert.deepStrictEqual(
    blocks.map(getRoutePath),
    ['', 'about', 'content', 'article', 'search', '**']
  );
  assert.match(blocks[0], /loadComponent/);
  assert.match(blocks[1], /about\.routes/);
  assert.match(blocks[3], /article\.routes/);
});

test('feature-based mode false preserves all top-level standalone routes', () => {
  const plan = createRouteGenerationPlan(
    standaloneRoutesSource,
    createGeneratorConfig(false, true)
  );

  assert.strictEqual(plan.featureBasedRoutes, false);
  assert.strictEqual(plan.authEnabled, true);
  assert.strictEqual(plan.routesFileContent, standaloneRoutesSource);
  assert.strictEqual(plan.unknownRoutePaths.size, 0);
  assert.deepStrictEqual(
    plan.routeBlocks.map(getRoutePath),
    ['', 'about', 'content', 'article', 'search', '**']
  );
  assert.deepStrictEqual(
    getAuthProtectedRoutePaths(plan.routeBlocks, plan.authEnabled),
    ['content', 'search']
  );
});

test('feature-based mode true filters standalone routes by top-level path', () => {
  const plan = createRouteGenerationPlan(
    standaloneRoutesSource,
    createGeneratorConfig(true, true)
  );

  assert.strictEqual(plan.featureBasedRoutes, true);
  assert.strictEqual(plan.authEnabled, true);
  assert.strictEqual(plan.unknownRoutePaths.size, 0);
  assert.deepStrictEqual(
    plan.routeBlocks.map(getRoutePath),
    ['', 'about', 'content', '**']
  );
  assert.match(plan.routesFileContent, /loadComponent/);
  assert.match(plan.routesFileContent, /about\.routes/);
  assert.doesNotMatch(plan.routesFileContent, /article\.routes/);
  assert.doesNotMatch(plan.routesFileContent, /ElasticSearchPage/);
  assert.deepStrictEqual(
    getAuthProtectedRoutePaths(plan.routeBlocks, plan.authEnabled),
    ['content']
  );
});

test('extractRoutesArrayBody ignores comments while finding closing bracket', () => {
  const source = `
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'a',
    data: {
      note: 'literal ] text'
    } // ] in comment should be ignored
  }
];

const trailing = [1, 2, 3];
`;

  const body = extractRoutesArrayBody(source);
  assert.match(body, /path:\s*'a'/);
  assert.doesNotMatch(body, /const trailing/);
});

test('getRoutePath supports single, double and template literal paths', () => {
  assert.strictEqual(getRoutePath(`{ path: 'single' }`), 'single');
  assert.strictEqual(getRoutePath(`{ path: "double" }`), 'double');
  assert.strictEqual(getRoutePath(`{ path: \`template\` }`), 'template');
  assert.strictEqual(getRoutePath(`{ path: '' }`), '');
  assert.strictEqual(getRoutePath(`{ redirectTo: '' }`), null);
});

test('isAuthProtectedRouteBlock detects authGuard in canActivate array', () => {
  assert.strictEqual(
    isAuthProtectedRouteBlock(`{ path: 'account', canActivate: [authGuard] }`),
    true
  );
  assert.strictEqual(
    isAuthProtectedRouteBlock(`{ path: 'account', canActivate: [authGuard, otherGuard] }`),
    true
  );
  assert.strictEqual(
    isAuthProtectedRouteBlock(`{ path: 'about', canActivate: [otherGuard] }`),
    false
  );
});

test('isAuthProtectedRouteBlock detects authFeatureEnabledMatchGuard in canMatch array', () => {
  assert.strictEqual(
    isAuthProtectedRouteBlock(`{ path: 'forgot-password', canMatch: [authFeatureEnabledMatchGuard] }`),
    true
  );
  assert.strictEqual(
    isAuthProtectedRouteBlock(`{ path: 'reset-password', canMatch: [authFeatureEnabledMatchGuard, otherGuard] }`),
    true
  );
  assert.strictEqual(
    isAuthProtectedRouteBlock(`{ path: 'about', canMatch: [otherGuard] }`),
    false
  );
});

test('extractAuthProtectedRoutePaths returns unique client-rendered auth route paths', () => {
  const blocks = [
    `{ path: 'account', canActivate: [authGuard] }`,
    `{ path: 'search', canActivate: [authGuard, anotherGuard] }`,
    `{ path: 'forgot-password', canMatch: [authFeatureEnabledMatchGuard] }`,
    `{ path: 'reset-password', canMatch: [authFeatureEnabledMatchGuard] }`,
    `{ path: 'about' }`,
    `{ path: 'account', canActivate: [authGuard] }`
  ];
  const paths = extractAuthProtectedRoutePaths(blocks);
  assert.deepStrictEqual(paths, ['account', 'forgot-password', 'reset-password', 'search']);
});

test('getAuthProtectedRoutePaths returns empty list when auth is disabled', () => {
  const blocks = [
    `{ path: 'account', canActivate: [authGuard] }`,
    `{ path: 'search', canActivate: [authGuard, anotherGuard] }`
  ];
  const paths = getAuthProtectedRoutePaths(blocks, false);
  assert.deepStrictEqual(paths, []);
});

test('auth-disabled server metadata contains only the server-rendered wildcard', () => {
  assert.deepStrictEqual(getServerRoutes(extractRouteBlocks(standaloneRoutesSource), false), [
    { path: '**', renderMode: 'Server' }
  ]);
});

test('auth-enabled server metadata covers parameterized and lazy top-level paths before the wildcard', () => {
  const source = `export const routes: Routes = [
    { path: '', loadComponent: () => import('./home') },
    { path: 'collection/:collectionID/introduction', canActivate: [authGuard] },
    { path: 'collection/:collectionID/text', canActivate: [authGuard], loadChildren: () => import('./text.routes') },
    { path: 'index/:type', canActivate: [authGuard] },
    { path: 'media-collection', canActivate: [authGuard], loadChildren: () => import('./media.routes') },
    { path: 'forgot-password', canMatch: [authFeatureEnabledMatchGuard] },
    { path: 'about', loadChildren: () => import('./about.routes') },
    { path: '**', loadComponent: () => import('./not-found') }
  ];`;
  assert.deepStrictEqual(getServerRoutes(extractRouteBlocks(source), true), [
    { path: 'collection/:collectionID/introduction', renderMode: 'Client' },
    { path: 'collection/:collectionID/text', renderMode: 'Client' },
    { path: 'collection/:collectionID/text/**', renderMode: 'Client' },
    { path: 'forgot-password', renderMode: 'Client' },
    { path: 'index/:type', renderMode: 'Client' },
    { path: 'media-collection', renderMode: 'Client' },
    { path: 'media-collection/**', renderMode: 'Client' },
    { path: '**', renderMode: 'Server' }
  ]);
});

test('server metadata covers protected inline children and deduplicates repeated parents', () => {
  const source = `export const routes: Routes = [
    { path: 'members', canActivate: [authGuard], children: [{ path: ':id' }] },
    { path: 'members', canActivate: [authGuard] },
    { path: 'public', data: { note: 'no children' }, /* loadChildren: ignored */ loadComponent: () => import('./public') },
    { path: '**' }
  ];`;
  assert.deepStrictEqual(getServerRoutes(extractRouteBlocks(source), true), [
    { path: 'members', renderMode: 'Client' },
    { path: 'members/**', renderMode: 'Client' },
    { path: '**', renderMode: 'Server' }
  ]);
});

test('server metadata keeps fork-specific protected paths independent of locales and base-app features', () => {
  const source = `export const routes: Routes = [
    { path: '', loadComponent: () => import('./home') },
    { path: 'edition/:editionID/documents', canActivate: [authGuard], loadChildren: () => import('./documents.routes') },
    { path: '**' }
  ];`;
  const plan = createRouteGenerationPlan(source, createGeneratorConfig(true, true));
  assert.deepStrictEqual(Array.from(plan.unknownRoutePaths), ['edition/:editionID/documents']);
  assert.deepStrictEqual(plan.serverRoutes, [
    { path: 'edition/:editionID/documents', renderMode: 'Client' },
    { path: 'edition/:editionID/documents/**', renderMode: 'Client' },
    { path: '**', renderMode: 'Server' }
  ]);
});

test('server metadata rejects protected catch-all paths instead of overriding their client mode with SSR', () => {
  for (const route of [
    `{ path: '**', canActivate: [authGuard] }`,
    `{ path: '', canActivate: [authGuard], loadChildren: () => import('./children.routes') }`
  ]) {
    assert.throws(() => getServerRoutes([route], true), /Auth-protected catch-all routes conflict/);
  }
});

for (const featureBasedRoutes of [false, true]) {
  for (const authEnabled of [false, true]) {
    test(`protected metadata follows filtered routes (features: ${featureBasedRoutes}, auth: ${authEnabled})`, () => {
      const source = `export const routes: Routes = [
        { path: '', loadComponent: () => import('./home') },
        { path: 'collection/:collectionID/cover', canActivate: [authGuard], loadComponent: () => import('./cover') },
        { path: 'collection/:collectionID/introduction', canActivate: [authGuard], loadComponent: () => import('./introduction') },
        { path: 'collection/:collectionID/text', canActivate: [authGuard], loadChildren: () => import('./text.routes') },
        { path: 'index/:type', canActivate: [authGuard], loadComponent: () => import('./index') },
        { path: 'media-collection', canActivate: [authGuard], loadChildren: () => import('./media.routes') },
        { path: 'search', canActivate: [authGuard], loadComponent: () => import('./search') },
        { path: 'account', canMatch: [authFeatureEnabledMatchGuard], canActivate: [authGuard] },
        { path: 'forgot-password', canMatch: [authFeatureEnabledMatchGuard] },
        { path: '**', loadComponent: () => import('./not-found') }
      ];`;
      const config = createGeneratorConfig(featureBasedRoutes, authEnabled);
      config.collections = { order: [203], frontMatterPages: { introduction: true, cover: false } };
      config.component.mainSideMenu.items.collections = true;
      config.component.mainSideMenu.items.indexPersons = true;
      config.component.mainSideMenu.items.mediaCollections = false;

      const plan = createRouteGenerationPlan(source, config);
      const protectedPaths = getAuthProtectedRoutePaths(plan.routeBlocks, plan.authEnabled);
      const expectedProtectedPaths = !authEnabled ? [] : featureBasedRoutes ? [
        'account', 'collection/:collectionID/introduction', 'collection/:collectionID/text',
        'forgot-password', 'index/:type'
      ] : [
        'account', 'collection/:collectionID/cover', 'collection/:collectionID/introduction',
        'collection/:collectionID/text', 'forgot-password', 'index/:type', 'media-collection', 'search'
      ];

      assert.deepStrictEqual(protectedPaths, expectedProtectedPaths);
      const expectedServerPaths = expectedProtectedPaths.flatMap(routePath =>
        ['collection/:collectionID/text', 'media-collection'].includes(routePath)
          ? [routePath, `${routePath}/**`] : [routePath]
      ).sort();
      assert.deepStrictEqual(plan.serverRoutes, [
        ...expectedServerPaths.map(routePath => ({ path: routePath, renderMode: 'Client' })),
        { path: '**', renderMode: 'Server' }
      ]);
      assert.strictEqual(plan.unknownRoutePaths.size, 0);
      assert.deepStrictEqual(
        getAuthProtectedRoutePaths(extractRouteBlocks(plan.routesFileContent), authEnabled),
        expectedProtectedPaths
      );
      assert.deepStrictEqual(
        createRouteGenerationPlan(source, config),
        plan
      );
      if (featureBasedRoutes) {
        const paths = plan.routeBlocks.map(getRoutePath);
        assert.ok(paths.includes(''));
        assert.ok(paths.includes('**'));
        assert.ok(paths.includes('collection/:collectionID/text'));
        assert.ok(paths.includes('index/:type'));
        assert.ok(!paths.includes('collection/:collectionID/cover'));
        assert.ok(!paths.includes('media-collection'));
        assert.ok(!paths.includes('search'));
        assert.strictEqual(paths.includes('account'), authEnabled);
        assert.strictEqual(paths.includes('forgot-password'), authEnabled);
      }
    });
  }
}

test('an omitted top-menu search setting retains the route for the visible button', () => {
  const config = createGeneratorConfig(true, false);
  delete config.component.topMenu.showElasticSearchButton;
  const plan = createRouteGenerationPlan(standaloneRoutesSource, config);
  assert.ok(plan.routeBlocks.some(block => getRoutePath(block) === 'search'));

  config.component.topMenu.showElasticSearchButton = false;
  const disabled = createRouteGenerationPlan(standaloneRoutesSource, config);
  assert.ok(!disabled.routeBlocks.some(block => getRoutePath(block) === 'search'));
});

test('sitemap URLs use the first configured language when defaultLanguage is omitted', () => {
  const source = fs.readFileSync(path.join(__dirname, '../prebuild-generate-sitemap.js'), 'utf8');
  for (const [languages, defaultLanguage, expected] of [
    [[{ code: 'fi' }, { code: 'sv' }], undefined, 'fi'],
    [[{ code: 'fi' }, { code: 'sv' }], 'sv', 'sv'],
    [[], undefined, 'sv']
  ]) {
    const config = {
      app: {
        backendBaseURL: 'https://api.example.test', projectNameDB: 'edition',
        siteURLOrigin: 'https://edition.example', i18n: { languages, defaultLanguage }
      },
      component: { topMenu: { showElasticSearchButton: false } }
    };
    let sitemap = '';
    vm.runInNewContext(source, {
      __dirname: path.resolve(__dirname, '..'),
      console: { log() {}, error(message) { throw new Error(message); } },
      require: name => {
        if (name === './prebuild-common-fns') {
          return { ...common, getConfig: () => config };
        }
        if (name === './prebuild-generate-routes') {
          return require('../prebuild-generate-routes');
        }
        if (name === 'fs') {
          return {
            writeFileSync: (_filename, content) => { sitemap = content; },
            appendFileSync: (_filename, content) => { sitemap += content; }
          };
        }
        return require(name);
      }
    });
    assert.strictEqual(sitemap, 'https://edition.example/' + expected + '/\n'
      + 'https://edition.example/' + expected + '/content\n');
  }
});

test('protected lazy routes are included when their feature is enabled from the top menu', () => {
  const source = `export const routes: Routes = [
    { path: '', loadComponent: () => import('./home') },
    { path: 'media-collection', canActivate: [authGuard], loadChildren: () => import('./media.routes') },
    { path: 'search', canActivate: [authGuard], loadComponent: () => import('./search') },
    { path: '**', loadComponent: () => import('./not-found') }
  ];`;
  const config = createGeneratorConfig(true, true);
  config.component.mainSideMenu.items.mediaCollections = true;
  config.component.topMenu.showElasticSearchButton = true;
  const plan = createRouteGenerationPlan(source, config);

  assert.deepStrictEqual(getAuthProtectedRoutePaths(plan.routeBlocks, true), ['media-collection', 'search']);
  assert.deepStrictEqual(plan.serverRoutes, [
    { path: 'media-collection', renderMode: 'Client' },
    { path: 'media-collection/**', renderMode: 'Client' },
    { path: 'search', renderMode: 'Client' },
    { path: '**', renderMode: 'Server' }
  ]);
});

test('generation writes reproducible filtered metadata with parameterized paths and no disabled-auth paths', () => {
  const originalGetConfig = common.getConfig;
  const originalWrite = fs.writeFileSync;
  const originalLog = console.log;
  const config = createGeneratorConfig(true, true);
  config.collections = { order: [203], frontMatterPages: { introduction: true } };
  config.component.mainSideMenu.items.collections = true;
  config.component.mainSideMenu.items.indexPersons = true;
  const files = new Map();

  try {
    common.getConfig = () => config;
    fs.writeFileSync = (filename, content) => files.set(path.basename(filename), content);
    console.log = () => {};
    generateRoutes();
    const browserRoutes = files.get('app.routes.generated.ts');
    const serverRoutes = files.get('app.routes.server.generated.ts');
    assert.doesNotMatch(browserRoutes, /path: 'collection\/:collectionID\/cover'/);
    assert.doesNotMatch(browserRoutes, /path: 'search'/);
    assert.doesNotMatch(browserRoutes, /path: 'media-collection'/);
    assert.deepStrictEqual(Array.from(files.keys()).sort(), [
      'app.routes.generated.ts', 'app.routes.server.generated.ts'
    ]);
    assert.deepStrictEqual(readServerRoutes(serverRoutes), [
      { path: 'account', renderMode: 'Client' },
      { path: 'change-password', renderMode: 'Client' },
      { path: 'collection/:collectionID/introduction', renderMode: 'Client' },
      { path: 'collection/:collectionID/text', renderMode: 'Client' },
      { path: 'collection/:collectionID/text/**', renderMode: 'Client' },
      { path: 'content', renderMode: 'Client' },
      { path: 'forgot-password', renderMode: 'Client' },
      { path: 'index/:type', renderMode: 'Client' },
      { path: 'login', renderMode: 'Client' },
      { path: 'register', renderMode: 'Client' },
      { path: 'reset-password', renderMode: 'Client' },
      { path: 'verify-email', renderMode: 'Client' },
      { path: '**', renderMode: 'Server' }
    ]);
    assert.match(serverRoutes, /Feature-based route filtering: true/);
    assert.match(serverRoutes, /Auth feature enabled: true/);
    assert.doesNotMatch(serverRoutes, /RenderMode\.Prerender/);
    assertServerRouteTypes(serverRoutes);
    generateRoutes();
    assert.strictEqual(files.get('app.routes.generated.ts'), browserRoutes);
    assert.strictEqual(files.get('app.routes.server.generated.ts'), serverRoutes);

    config.app.auth.enabled = false;
    generateRoutes();
    const disabledServerRoutes = files.get('app.routes.server.generated.ts');
    assert.match(disabledServerRoutes, /Auth feature enabled: false/);
    assert.deepStrictEqual(readServerRoutes(disabledServerRoutes), [{ path: '**', renderMode: 'Server' }]);
    assert.doesNotMatch(disabledServerRoutes, /RenderMode\.(Client|Prerender)/);
    assertServerRouteTypes(disabledServerRoutes);
    generateRoutes();
    assert.strictEqual(files.get('app.routes.server.generated.ts'), disabledServerRoutes);
  } finally {
    common.getConfig = originalGetConfig;
    fs.writeFileSync = originalWrite;
    console.log = originalLog;
  }
});

test('stripCommentsPreserveLiterals keeps string literals and length stable', () => {
  const source = `const a = "/* not a comment */"; // remove this
const b = '// also not a comment';
/* remove
   this block comment */
const c = \`template // text\`;`;
  const stripped = stripCommentsPreserveLiterals(source);

  assert.strictEqual(stripped.length, source.length);
  assert.match(stripped, /\/\* not a comment \*\//);
  assert.match(stripped, /'\/\/ also not a comment'/);
  assert.match(stripped, /`template \/\/ text`/);
  assert.doesNotMatch(stripped, /remove this/);
});

test('current app.routes.ts parses and all top-level paths have feature keys', () => {
  const routesPath = path.join(__dirname, '../src/app/app.routes.ts');
  const source = fs.readFileSync(routesPath, 'utf-8');
  const blocks = extractRouteBlocks(source);
  const paths = blocks.map(getRoutePath).filter((routePath) => routePath !== null);
  const featureBasedPlan = createRouteGenerationPlan(
    source,
    createGeneratorConfig(true, false)
  );

  assert.ok(blocks.length > 0);
  assert.ok(paths.includes(''));
  assert.ok(paths.includes('**'));
  assert.strictEqual(featureBasedPlan.unknownRoutePaths.size, 0);
});

test('current app.routes.ts yields no protected paths when auth is disabled', () => {
  const routesPath = path.join(__dirname, '../src/app/app.routes.ts');
  const source = fs.readFileSync(routesPath, 'utf-8');
  const blocks = extractRouteBlocks(source);
  const paths = getAuthProtectedRoutePaths(blocks, false);

  assert.deepStrictEqual(paths, []);
  assert.deepStrictEqual(getServerRoutes(blocks, false), [{ path: '**', renderMode: 'Server' }]);
});

test('current app.routes.ts preserves the complete protected path list when auth is enabled', () => {
  const routesPath = path.join(__dirname, '../src/app/app.routes.ts');
  const source = fs.readFileSync(routesPath, 'utf-8');
  const blocks = extractRouteBlocks(source);
  const paths = getAuthProtectedRoutePaths(blocks, true);

  assert.deepStrictEqual(paths, [
    'account',
    'change-password',
    'collection/:collectionID/cover',
    'collection/:collectionID/foreword',
    'collection/:collectionID/introduction',
    'collection/:collectionID/text',
    'collection/:collectionID/title',
    'content',
    'forgot-password',
    'index/:type',
    'login',
    'media-collection',
    'register',
    'reset-password',
    'search',
    'verify-email'
  ]);
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(error);
    process.exit(1);
  }
}

console.log(`All parser smoke tests passed (${passed}/${tests.length}).`);
