#!/usr/bin/env node

/*
 * Migrate an edition's collection cover metadata from backend Markdown to the
 * project-owned src/project/data/collection-covers.ts file. The content grid and
 * collection cover pages can then use local metadata instead of fetching it for
 * each collection. The generated file contains image paths and alt texts keyed
 * by collection ID and locale; it does not contain or download the image files.
 *
 * Usage (from the repository root, with project dependencies installed):
 *   npm run generate-collection-covers
 *   node scripts/migrations/generate-collection-covers.js [options]
 *
 * Configure the edition in src/project/config.ts before running:
 *   app.backendBaseURL       Digital edition API base URL.
 *   app.projectNameDB        Backend project identifier.
 *   app.i18n.languages       Locale entries with a code, such as sv or fi.
 *   collections.order        Groups of numeric collection IDs to include.
 *
 * For each selected collection and locale, the script requests the Markdown node
 * <locale>-08-<collectionId> and extracts the first image's path and alt text,
 * using the same parsing as the app. Each locale keeps its own path and alt text.
 * Repeated collection IDs and locale codes are fetched only once.
 *
 * Supported CLI arguments (value options accept --name=value or --name value):
 *   --output <path>
 *     Output file, relative to the repository root or absolute.
 *     Default: src/project/data/collection-covers.ts.
 *   --help | -h
 *     Show usage without fetching data or writing a file.
 *
 * Examples:
 *   npm run generate-collection-covers
 *   npm run generate-collection-covers -- --output tmp/collection-covers.ts
 *   npm run generate-collection-covers -- --help
 *
 * The selected output file is replaced only after all requests finish. Failed
 * requests use the shared retry policy; an exhausted retry or invalid response
 * stops generation and leaves the existing output unchanged. Markdown without
 * an image is reported and omitted, allowing the app to use its placeholder.
 * Regenerating the file replaces any manual edits in it.
 *
 * After generation:
 *   1. Review the generated metadata, including any reported omissions. If using
 *      --output, copy the reviewed data to src/project/data/collection-covers.ts.
 *   2. Ensure the referenced full-size images and matching *_thumb images exist.
 *      Local assets/images/... URLs refer to files under public/assets/images/.
 *   3. Set collections.useStaticCoverData to true in src/project/config.ts,
 *      then rebuild and deploy the app.
 *
 * This is an explicit migration/refresh command, not a build step. It does not
 * change the configuration flag. Run it again to import later backend changes.
 *
 * Exit codes:
 *   0: generation completed (possibly with omitted images), or help was requested.
 *   1: a configuration, request, response, file, or command-line error occurred.
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const common = require('../../prebuild-common-fns');

const repoRoot = path.resolve(__dirname, '../..');
const defaultOutput = 'src/project/data/collection-covers.ts';

async function generateCollectionCovers(config, outputPath, fetchJson = common.fetchWithRetry) {
  const backend = config?.app?.backendBaseURL;
  const project = config?.app?.projectNameDB;
  const languages = config?.app?.i18n?.languages;
  const order = config?.collections?.order;

  if (typeof backend !== 'string' || !backend.trim() || typeof project !== 'string' || !project.trim()) {
    throw new Error('Configure app.backendBaseURL and app.projectNameDB before generating covers.');
  }
  if (!Array.isArray(languages) || !languages.length || languages.some(language =>
    typeof language?.code !== 'string' || !language.code.trim()
  )) {
    throw new Error('Configure app.i18n.languages with non-empty locale codes before generating covers.');
  }
  if (!Array.isArray(order) || order.some(group => !Array.isArray(group))) {
    throw new Error('Configure collections.order with groups of numeric collection IDs before generating covers.');
  }
  const ids = [...new Set(order.flat())];
  if (!ids.length || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('collections.order must contain positive integer collection IDs.');
  }

  const locales = [...new Set(languages.map(language => language.code))];
  const apiBase = `${backend.replace(/\/+$/, '')}/${encodeURIComponent(project)}`;
  const entries = [];
  let generated = 0;
  let skipped = 0;

  // Sequential requests keep migration load low. Do not touch the output until
  // all requests finish, so a backend failure cannot replace it with partial data.
  for (const id of ids) {
    const localized = [];
    for (const locale of locales) {
      const nodeID = `${locale}-08-${id}`;
      const response = await fetchJson(`${apiBase}/md/${encodeURIComponent(nodeID)}`);
      if (!response) {
        throw new Error(`Could not fetch cover metadata for ${nodeID}; output file was not changed.`);
      }
      const content = response.content ?? '';
      if (typeof content !== 'string') {
        throw new Error(`Invalid Markdown response for ${nodeID}; output file was not changed.`);
      }
      // Match the first image exactly as CollectionCoverService does.
      const match = content.match(/!\[(.*?)\]\((.*?)\)/);
      if (!match?.[2]) {
        console.warn(`No cover image in ${nodeID}; omitted so the app can use its placeholder.`);
        skipped++;
        continue;
      }
      localized.push(`    ${quote(locale)}: {\n` +
        `      imageURL: ${quote(match[2])},\n` +
        `      imageAltText: ${quote(match[1])}\n` +
        '    }');
      generated++;
    }
    if (localized.length) {
      entries.push(`  ${id}: {\n${localized.join(',\n')}\n  }`);
    }
  }

  const source = "import type { CollectionCovers } from '@models/collection.models';\n\n" +
    '// Generated by npm run generate-collection-covers from backend Markdown.\n' +
    '// Paths refer to full-size images in public/; the grid uses *_thumb images.\n' +
    `export const collectionCovers: CollectionCovers = {\n${entries.join(',\n')}\n};\n`;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, source, 'utf8');
  return { generated, skipped };
}

function quote(value) {
  return "'" + value.replace(/[\\'\u0000-\u001f\u2028\u2029]/g, character => {
    if (character === "'") { return "\\'"; }
    if (character === '\\') { return '\\\\'; }
    return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
  }) + "'";
}

async function main() {
  const { values } = parseArgs({
    options: {
      output: { type: 'string', default: defaultOutput },
      help: { type: 'boolean', short: 'h' }
    }
  });
  if (values.help) {
    console.log(`Usage: npm run generate-collection-covers [-- --output <path>]

Fetch cover metadata for collections.order and app.i18n.languages from the
backend configured in src/project/config.ts. Replace ${defaultOutput}
only after fetching finishes. --output selects another file (relative to the
repository root, or absolute). Missing images are omitted with a warning;
request failures exit with an error and leave the existing file unchanged.
The script does not download images or enable collections.useStaticCoverData.`);
    return;
  }
  const outputPath = path.resolve(repoRoot, values.output);
  const result = await generateCollectionCovers(common.getConfig('src/project/config.ts'), outputPath);
  console.log(`Wrote ${result.generated} localized covers to ${outputPath} (${result.skipped} omitted).`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { generateCollectionCovers };
