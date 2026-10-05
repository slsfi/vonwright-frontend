const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  createRouteGenerationPlan,
  extractRouteBlocks,
  extractRoutesArrayBody,
  getAuthProtectedRoutePaths,
  extractAuthProtectedRoutePaths,
  getRoutePath,
  isAuthProtectedRouteBlock,
  stripCommentsPreserveLiterals
} = require('../prebuild-generate-routes');

/**
 * Parser smoke tests for prebuild route generation.
 *
 * What this script does:
 * - Exercises key parsing helpers in `prebuild-generate-routes.js`.
 * - Verifies behavior for common edge cases (comments, quote styles, route extraction).
 * - Fails fast with a non-zero exit code if any assertion fails.
 *
 * What this script is NOT:
 * - Not a full unit test suite.
 * - Not an end-to-end production build test.
 *
 * How to run:
 * - Recommended npm command:
 *   `npm run test:routes-parser`
 * - Directly with Node:
 *   `node ./scripts/test-prebuild-generate-routes.js`
 *
 * Typical usage:
 * - Run after changes to `prebuild-generate-routes.js`.
 * - Run after route syntax refactors in `src/app/app.routes.ts`.
 */
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
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
