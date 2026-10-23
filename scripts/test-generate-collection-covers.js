#!/usr/bin/env node

// Run with npm run test:collection-covers. Uses fixtures, with no network requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const { generateCollectionCovers } = require('./migrations/generate-collection-covers');

function projectConfig() {
  return {
    app: {
      backendBaseURL: 'https://api.example.test/digitaledition/',
      projectNameDB: 'edition',
      i18n: { languages: [{ code: 'sv' }, { code: 'fi' }, { code: 'sv' }] }
    },
    collections: { order: [[2], [1, 2]], useStaticCoverData: false }
  };
}

function outputFile(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-covers-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'data', 'collection-covers.ts');
}

function readCovers(file) {
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }, reportDiagnostics: true
  });
  assert.equal(result.diagnostics.length, 0);
  const exports = {};
  new Function('exports', result.outputText)(exports);
  return { source, covers: exports.collectionCovers };
}

test('generates localized paths and alt texts once per configured ID and locale', async t => {
  const config = projectConfig();
  const file = outputFile(t);
  const requests = [];
  const fetchJson = async url => {
    requests.push(url);
    const node = url.split('/').pop();
    return { content: `![Omslag ${node}](assets/images/${node}.jpg)\n![Ignore](second.jpg)` };
  };

  assert.deepEqual(await generateCollectionCovers(config, file, fetchJson), { generated: 4, skipped: 0 });
  assert.deepEqual(requests, ['sv-08-2', 'fi-08-2', 'sv-08-1', 'fi-08-1'].map(node =>
    `https://api.example.test/digitaledition/edition/md/${node}`
  ));
  const { source, covers } = readCovers(file);
  for (const id of [1, 2]) {
    for (const locale of ['sv', 'fi']) {
      assert.deepEqual(covers[id][locale], {
        imageURL: `assets/images/${locale}-08-${id}.jpg`, imageAltText: `Omslag ${locale}-08-${id}`
      });
    }
  }
  assert.ok(source.indexOf('  2: {') < source.indexOf('  1: {'), 'Retain configured collection order.');
  assert.ok(source.endsWith('\n'));
  assert.equal(config.collections.useStaticCoverData, false);
  // Regeneration should not create a diff when the backend data has not changed.
  await generateCollectionCovers(config, file, fetchJson);
  assert.equal(fs.readFileSync(file, 'utf8'), source);
});

test('escapes quotes, backslashes, and control characters in generated TypeScript', async t => {
  const config = projectConfig();
  config.app.i18n.languages = [{ code: 'sv-FI' }];
  config.collections.order = [[2]];
  const file = outputFile(t);
  const alt = "Bokens 'omslag'\t\\ baksida";
  const image = "assets/images/book's\\cover.jpg";
  await generateCollectionCovers(config, file, async () => ({ content: `![${alt}](${image})` }));
  assert.deepEqual(readCovers(file).covers[2]['sv-FI'], { imageURL: image, imageAltText: alt });
});

test('omits absent images and retains empty alt text instead of inventing translations', async t => {
  const file = outputFile(t);
  const config = projectConfig();
  config.collections.order = [[1]];
  t.mock.method(console, 'warn', () => {});
  const result = await generateCollectionCovers(config, file, async url => ({
    content: url.endsWith('/sv-08-1') ? '![](assets/sv.jpg)' : null
  }));
  assert.deepEqual(result, { generated: 1, skipped: 1 });
  assert.deepEqual(readCovers(file).covers, { 1: { sv: { imageURL: 'assets/sv.jpg', imageAltText: '' } } });
  assert.match(console.warn.mock.calls[0].arguments[0], /fi-08-1/);
});

for (const failure of ['null response', 'invalid Markdown', 'network error']) {
  test(`preserves the existing file after a later request fails: ${failure}`, async t => {
    const file = outputFile(t);
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, 'existing project data\n');
    let count = 0;
    const fetchJson = async () => {
      count++;
      if (count === 1) {
        return { content: '![Cover](assets/cover.jpg)' };
      }
      if (failure === 'network error') {
        throw new Error('Connection lost');
      }
      return failure === 'null response' ? null : { content: 123 };
    };
    await assert.rejects(generateCollectionCovers(projectConfig(), file, fetchJson));
    assert.equal(count, 2);
    assert.equal(fs.readFileSync(file, 'utf8'), 'existing project data\n');
  });
}

test('rejects incomplete or invalid project configuration without fetching or writing', async t => {
  const file = outputFile(t);
  for (const change of [
    config => { delete config.app.backendBaseURL; },
    config => { config.app.projectNameDB = ''; },
    config => { config.app.i18n.languages = []; },
    config => { config.app.i18n.languages = [{}]; },
    config => { config.collections.order = []; },
    config => { config.collections.order = [1]; },
    config => { config.collections.order = [['1']]; },
    config => { config.collections.order = [[-1]]; }
  ]) {
    const config = projectConfig();
    change(config);
    await assert.rejects(generateCollectionCovers(config, file, async () => assert.fail('Unexpected request')));
    assert.equal(fs.existsSync(file), false);
  }
});
