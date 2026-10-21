#!/usr/bin/env node

// Exercise the workflow's actual inline scripts with GitHub and Docker fixtures.
// Run with: node --test scripts/test-docker-build-workflow.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const workflow = fs.readFileSync(
  path.join(__dirname, '../.github/workflows/docker-build-and-push.yml'), 'utf8'
);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const scripts = [...workflow.matchAll(/^          script: \|\r?\n((?:(?: {12}[^\r\n]*|)\r?\n)+)/gm)]
  .map(match => new AsyncFunction('github', 'context', 'core', 'exec', 'process',
    match[1].replace(/^ {12}/gm, '')));
assert.equal(scripts.length, 2, 'Both workflow scripts must be exercised.');

const repo = { owner: 'SLSfi', repo: 'Example-Frontend' };
const digest = `sha256:${'a'.repeat(64)}`;

async function selectSource({ ref = 'refs/heads/production', requested = '', getRef } = {}) {
  const outputs = {};
  const calls = [];
  await scripts[0]({ rest: { git: { getRef: async args => {
    calls.push(args);
    return getRef ? getRef(args) : { data: { ref: `refs/${args.ref}` } };
  } } } }, { ref, repo }, {
    setOutput: (name, value) => { outputs[name] = value; }
  }, {}, { env: { RELEASE_TAG: requested } });
  return { outputs, calls };
}

async function publishLatest({ tag = '4.0.0-production.1', latest, error, imageDigest = digest } = {}) {
  const calls = [];
  const commands = [];
  const messages = [];
  await scripts[1]({ rest: { repos: { getLatestRelease: async args => {
    calls.push(args);
    if (error) {
      throw error;
    }
    return { data: latest || { tag_name: tag, draft: false, prerelease: false } };
  } } } }, { repo }, { info: message => messages.push(message) }, {
    exec: async (...args) => { commands.push(args); }
  }, { env: {
    RELEASE_TAG: tag, IMAGE_NAME: `ghcr.io/${repo.owner}/${repo.repo}`, IMAGE_DIGEST: imageDigest
  } });
  return { calls, commands, messages };
}

test('manual branch builds retain the selected branch without treating it as a release', async () => {
  const { outputs, calls } = await selectSource();
  assert.deepEqual(outputs, {
    ref: 'refs/heads/production', 'release-tag': '', 'image-tag': 'production'
  });
  assert.equal(calls.length, 0);
});

test('release publication selects the tagged source', async () => {
  const tag = '4.0.0-production.1';
  const { outputs } = await selectSource({ ref: `refs/tags/${tag}` });
  assert.deepEqual(outputs, { ref: `refs/tags/${tag}`, 'release-tag': tag, 'image-tag': tag });
});

test('manual release selection overrides the branch and validates the exact tag', async () => {
  const tag = '4.0.0-production.1';
  const { outputs, calls } = await selectSource({ requested: ` ${tag} ` });
  assert.deepEqual(outputs, { ref: `refs/tags/${tag}`, 'release-tag': tag, 'image-tag': tag });
  assert.deepEqual(calls, [{ ...repo, ref: `tags/${tag}` }]);
});

test('missing tags fail instead of falling back to the selected branch', async () => {
  const error = Object.assign(new Error('Tag not found'), { status: 404 });
  await assert.rejects(selectSource({ requested: 'missing', getRef: () => { throw error; } }), error);
});

test('a partial tag match is rejected', async () => {
  await assert.rejects(selectSource({
    requested: '4.0', getRef: () => ({ data: { ref: 'refs/tags/4.0.0' } })
  }), /match an existing Git tag exactly/);
});

test('image tags are sanitized while the original Git tag remains intact', async () => {
  const { outputs } = await selectSource({ requested: 'release/4.0.0' });
  assert.equal(outputs.ref, 'refs/tags/release/4.0.0');
  assert.equal(outputs['release-tag'], 'release/4.0.0');
  assert.equal(outputs['image-tag'], 'release-4.0.0');
});

test('the latest alias cannot be supplied as a branch or release image tag', async () => {
  await assert.rejects(selectSource({ requested: 'latest' }), /reserved latest alias/);
  await assert.rejects(selectSource({ ref: 'refs/heads/latest' }), /reserved latest alias/);
});

test('branch builds leave latest unchanged without querying releases', async () => {
  const { calls, commands } = await publishLatest({ tag: '' });
  assert.equal(calls.length, 0);
  assert.equal(commands.length, 0);
});

test('only GitHub latest is promoted, using the built digest and lowercase image name', async () => {
  const { calls, commands } = await publishLatest();
  assert.deepEqual(calls, [repo]);
  assert.deepEqual(commands, [['docker', [
    'buildx', 'imagetools', 'create', '--tag', 'ghcr.io/slsfi/example-frontend:latest',
    `ghcr.io/slsfi/example-frontend@${digest}`
  ]]]);
});

test('an older release cannot replace the currently designated latest release', async () => {
  const { commands } = await publishLatest({ latest: { tag_name: '4.0.0-production.2' } });
  assert.equal(commands.length, 0);
});

test('GitHub designation controls latest even when the selected version sorts lower', async () => {
  const { commands } = await publishLatest({ tag: '3.1.1-production.1' });
  assert.equal(commands.length, 1);
});

for (const flag of ['draft', 'prerelease']) {
  test(`${flag} releases are never promoted to latest`, async () => {
    const { commands } = await publishLatest({
      latest: { tag_name: '4.0.0-production.1', [flag]: true }
    });
    assert.equal(commands.length, 0);
  });
}

test('repositories without a published latest release leave the alias unchanged', async () => {
  const { commands } = await publishLatest({
    error: Object.assign(new Error('No latest release'), { status: 404 })
  });
  assert.equal(commands.length, 0);
});

test('release API failures fail closed instead of publishing latest', async () => {
  const error = Object.assign(new Error('API unavailable'), { status: 503 });
  await assert.rejects(publishLatest({ error }), error);
});

test('latest is not published without a valid build digest', async () => {
  await assert.rejects(publishLatest({ imageDigest: '' }), /valid built image digest/);
});

test('workflow wiring uses selected source metadata and disables automatic latest tagging', () => {
  const pushTrigger = workflow.match(/^  push:\r?\n([\s\S]*?)(?=^  \w)/m)?.[1] || '';
  assert.match(pushTrigger, /branches:\s+- main/);
  assert.doesNotMatch(pushTrigger, /^\s+tags:/m, 'Tag pushes must not duplicate release builds.');
  assert.match(workflow, /release:\s+types: \[published\]/);
  assert.match(workflow, /release_tag:\s+description:[^\n]+\s+required: false\s+type: string/);
  assert.ok(workflow.includes('ref: ${{ steps.source.outputs.ref }}'));
  assert.ok(workflow.includes('flavor: latest=false'));
  assert.ok(workflow.includes('tags: type=raw,value=${{ steps.source.outputs.image-tag }}'));
  assert.ok(workflow.includes('org.opencontainers.image.revision=${{ steps.checkout.outputs.commit }}'));
  assert.ok(workflow.includes('IMAGE_DIGEST: ${{ steps.build.outputs.digest }}'));
  assert.ok(workflow.indexOf('id: build') < workflow.indexOf('name: Publish latest'));
});
