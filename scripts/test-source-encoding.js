/**
 * Checks source files under `src/` for UTF-8 encoding issues.
 *
 * The script reports files that:
 * - contain a UTF-8 BOM
 * - are not valid UTF-8
 * 
 * Optional BOM cleanup:
 * - pass `--fix-bom` to remove UTF-8 BOM from files that are otherwise
 *   valid UTF-8
 * - malformed UTF-8 is never modified and must be fixed manually
 *
 * Run it with:
 * - `node ./scripts/test-source-encoding.js`
 * - `node ./scripts/test-source-encoding.js --fix-bom`
 * - `npm run test:source-encoding`
 * - `npm run test:source-encoding -- --fix-bom`
 *
 * Configure which file types are checked by editing the `extensions`
 * array below. The script recursively scans `src/` and includes files
 * whose extension matches one of those values.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');
const extensions = ['.html', '.scss', '.ts', '.xlf'];
const bomPrefix = Buffer.from([0xef, 0xbb, 0xbf]);
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const shouldFixBom = process.argv.includes('--fix-bom');

function isUtf8(buffer) {
  try {
    utf8Decoder.decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function getSourceFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...getSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = getSourceFiles(srcDir).sort((a, b) => a.localeCompare(b));

if (!files.length) {
  console.error(`No source files found in ${srcDir} for extensions: ${extensions.join(', ')}`);
  process.exit(1);
}

const issues = [];
const fixedFiles = [];

for (const fullPath of files) {
  const fileBuffer = fs.readFileSync(fullPath);
  const relativePath = path.relative(srcDir, fullPath);
  const hasBom = fileBuffer.subarray(0, 3).equals(bomPrefix);
  const validUtf8 = isUtf8(fileBuffer);

  if (hasBom && shouldFixBom && validUtf8) {
    fs.writeFileSync(fullPath, fileBuffer.subarray(3));
    fixedFiles.push(relativePath);
  } else if (hasBom) {
    issues.push(`${relativePath}: contains UTF-8 BOM (must be UTF-8 without BOM)`);
  }

  if (!validUtf8) {
    issues.push(`${relativePath}: is not valid UTF-8`);
  }
}

if (issues.length) {
  console.error('Source encoding check failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

if (fixedFiles.length) {
  console.log(`Removed UTF-8 BOM from ${fixedFiles.length} file(s):`);
  for (const file of fixedFiles) {
    console.log(`- ${file}`);
  }
}

console.log(
  `Source encoding check passed (${files.length} files in src; extensions: ${extensions.join(', ')}).`
);
