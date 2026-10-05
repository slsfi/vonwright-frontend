const assert = require('assert/strict');
const fs = require('fs');
const common = require('../prebuild-common-fns');
const { generateStaticCollectionMenus } = require('../prebuild-generate-static-collection-menus');


async function testSharedTocDataIsFetchedOnce() {
  const original = {
    appendFileSync: fs.appendFileSync,
    writeFileSync: fs.writeFileSync,
    fetchWithRetry: common.fetchWithRetry,
    getConfig: common.getConfig,
    getTranslation: common.getTranslation,
    sleep: common.sleep,
    consoleLog: console.log,
    consoleWarn: console.warn
  };
  const fetchCalls = [];
  const initializedFiles = [];

  try {
    common.getConfig = () => ({
      app: {
        auth: { enabled: false },
        backendBaseURL: 'https://api.example.test',
        i18n: {
          languages: [{ code: 'sv' }, { code: 'fi' }],
          multilingualCollectionTableOfContents: false
        },
        prebuild: { staticCollectionMenus: true },
        projectNameDB: 'edition',
        ssr: { collectionSideMenu: false }
      },
      collections: {
        frontMatterPages: {},
        order: [[1, 2]]
      }
    });
    common.getTranslation = () => 'translation';
    common.fetchWithRetry = async (...args) => {
      fetchCalls.push(args);
      if (args[0].endsWith('/collections')) {
        return [
          { id: 1, title: 'Collection 1' },
          { id: 2, title: 'Collection 2' }
        ];
      }
      const collectionId = Number(args[0].split('/').pop());
      return {
        collectionId,
        children: [{ itemId: `${collectionId}_100`, text: `Text ${collectionId}` }]
      };
    };
    common.sleep = async () => {};
    fs.writeFileSync = filePath => initializedFiles.push(filePath);
    fs.appendFileSync = () => {};
    console.log = () => {};
    console.warn = () => {};

    await generateStaticCollectionMenus();

    assert.deepEqual(
      fetchCalls.map(call => call[0]),
      [
        'https://api.example.test/edition/collections',
        'https://api.example.test/edition/toc/1',
        'https://api.example.test/edition/toc/2'
      ]
    );
    assert.deepEqual(fetchCalls[1].slice(1), [3, 2000, 1000]);
    assert.deepEqual(fetchCalls[2].slice(1), [3, 2000, 1000]);
    assert.deepEqual(
      initializedFiles.map(filePath => filePath.split(/[\\/]/).pop()).sort(),
      ['1_fi.htm', '1_sv.htm', '2_fi.htm', '2_sv.htm']
    );
  } finally {
    fs.appendFileSync = original.appendFileSync;
    fs.writeFileSync = original.writeFileSync;
    common.fetchWithRetry = original.fetchWithRetry;
    common.getConfig = original.getConfig;
    common.getTranslation = original.getTranslation;
    common.sleep = original.sleep;
    console.log = original.consoleLog;
    console.warn = original.consoleWarn;
  }
}


async function testRetryCountAndIncrementalCooldown() {
  const originalFetch = global.fetch;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const warnings = [];
  const errors = [];
  let fetchCount = 0;

  try {
    global.fetch = async () => {
      fetchCount++;
      return { ok: false, status: 503 };
    };
    console.warn = message => warnings.push(message);
    console.error = message => errors.push(message);

    const result = await common.fetchWithRetry('https://api.example.test/toc/1', 3, 0, 1);
    const retryWarnings = warnings.filter(message => message.startsWith('Fetch failed'));

    assert.equal(result, null);
    assert.equal(fetchCount, 4);
    assert.deepEqual(retryWarnings, [
      'Fetch failed for https://api.example.test/toc/1. Retrying (1/3) in 0ms...',
      'Fetch failed for https://api.example.test/toc/1. Retrying (2/3) in 1ms...',
      'Fetch failed for https://api.example.test/toc/1. Retrying (3/3) in 2ms...'
    ]);
    assert.deepEqual(errors, [
      'Fetch failed for https://api.example.test/toc/1 after 4 attempts (3 retries).'
    ]);
  } finally {
    global.fetch = originalFetch;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  }
}


async function run() {
  await testSharedTocDataIsFetchedOnce();
  await testRetryCountAndIncrementalCooldown();
  console.log('Static collection menu prebuild tests passed.');
}


run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
