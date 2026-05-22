const fs = require('fs');
const path = require('path');
const common = require('./prebuild-common-fns');

const configFilepath = 'src/assets/config/config.ts';
const sourceRoutesFilepath = 'src/app/app.routes.ts';
const outputFilepath = 'src/app/app.routes.generated.ts';
const authProtectedOutputFilepath = 'src/app/auth-protected-route-paths.generated.ts';

/**
 * Generates the app routes file used by AppRoutingModule.
 *
 * If app.prebuild.featureBasedRoutes is true in config.ts, feature flags
 * in config determine which lazy route imports are included in the file.
 * If false, all default routes are included.
 */
function generateRoutes() {
  const config = common.getConfig(configFilepath);

  if (!config) {
    console.error('Unable to generate routes: could not read config.');
    process.exit(1);
  }

  const sourceContent = fs.readFileSync(path.join(__dirname, sourceRoutesFilepath), 'utf-8');
  const featureBasedRoutes = config.app?.prebuild?.featureBasedRoutes ?? false;
  const authEnabled = config.app?.auth?.enabled === true;
  const sourceRouteBlocks = extractRouteBlocks(sourceContent);
  validateSourceRouteBlocks(sourceRouteBlocks);

  if (!featureBasedRoutes) {
    fs.writeFileSync(path.join(__dirname, outputFilepath), sourceContent);
    writeAuthProtectedRoutesFile(sourceRouteBlocks, featureBasedRoutes, authEnabled);
    console.log('Copied app routes file (feature-based mode: false).');
    return;
  }

  const includeByPath = common.getRouteIncludeByPath(config);
  const unknownRoutePaths = new Set();

  const filteredRoutes = sourceRouteBlocks.filter((routeBlock) => {
    const routePath = getRoutePath(routeBlock);
    if (routePath === null) {
      return true;
    }

    const include = includeByPath[routePath];
    if (include === undefined) {
      unknownRoutePaths.add(routePath);
    }
    return include === undefined ? true : include;
  });
  warnUnknownRoutePaths(unknownRoutePaths);
  validateFilteredRoutes(sourceRouteBlocks, filteredRoutes);

  const fileContent = renderRoutesFile(filteredRoutes, featureBasedRoutes);

  fs.writeFileSync(path.join(__dirname, outputFilepath), fileContent);
  writeAuthProtectedRoutesFile(filteredRoutes, featureBasedRoutes, authEnabled);
  console.log(
    `Generated app routes file (${filteredRoutes.length} routes, feature-based mode: ${featureBasedRoutes}).`
  );
}

function extractRouteBlocks(sourceContent) {
  const routesBody = extractRoutesArrayBody(sourceContent);
  const sanitizedRoutesBody = stripCommentsPreserveLiterals(routesBody);
  const routeBlocks = [];

  let inString = false;
  let stringQuote = '';
  let escapeNext = false;
  let objectDepth = 0;
  let objectStart = -1;

  for (let i = 0; i < sanitizedRoutesBody.length; i++) {
    const char = sanitizedRoutesBody[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === '{') {
      if (objectDepth === 0) {
        objectStart = i;
      }
      objectDepth += 1;
      continue;
    }

    if (char === '}') {
      objectDepth -= 1;
      if (objectDepth < 0) {
        console.error(`Unable to parse routes from ${sourceRoutesFilepath}: invalid object depth.`);
        process.exit(1);
      }
      if (objectDepth === 0 && objectStart >= 0) {
        routeBlocks.push(routesBody.slice(objectStart, i + 1).trim());
        objectStart = -1;
      }
    }
  }

  if (objectDepth !== 0 || objectStart !== -1) {
    console.error(`Unable to parse routes from ${sourceRoutesFilepath}: unterminated route object.`);
    process.exit(1);
  }

  return routeBlocks;
}

function extractRoutesArrayBody(sourceContent) {
  const startMatch = sourceContent.match(/export\s+const\s+routes\s*:\s*Routes\s*=\s*\[/);
  const sanitizedSourceContent = stripCommentsPreserveLiterals(sourceContent);

  if (!startMatch || startMatch.index === undefined) {
    console.error(`Unable to parse routes from ${sourceRoutesFilepath}.`);
    process.exit(1);
  }

  const bodyStart = startMatch.index + startMatch[0].length;
  let inString = false;
  let stringQuote = '';
  let escapeNext = false;
  let bracketDepth = 1;

  for (let i = bodyStart; i < sanitizedSourceContent.length; i++) {
    const char = sanitizedSourceContent[i];

    if (inString) {
      if (escapeNext) {
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      continue;
    }

    if (char === ']') {
      bracketDepth -= 1;
      if (bracketDepth === 0) {
        return sourceContent.slice(bodyStart, i);
      }
    }
  }

  console.error(`Unable to locate the end of routes array in ${sourceRoutesFilepath}.`);
  process.exit(1);
}

function getRoutePath(routeBlock) {
  const pathMatch = routeBlock.match(/path\s*:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`)/);
  if (!pathMatch) {
    return null;
  }
  return pathMatch[1] ?? pathMatch[2] ?? pathMatch[3] ?? null;
}

function validateSourceRouteBlocks(sourceRouteBlocks) {
  if (!sourceRouteBlocks.length) {
    console.error(
      `Unable to generate routes: no route objects were extracted from ${sourceRoutesFilepath}.`
    );
    process.exit(1);
  }
}

function validateFilteredRoutes(sourceRouteBlocks, filteredRoutes) {
  if (!filteredRoutes.length) {
    console.error(
      'Unable to generate routes: filtering removed all routes. Check feature flags and parser output.'
    );
    process.exit(1);
  }

  if (filteredRoutes.length > sourceRouteBlocks.length) {
    console.error(
      'Unable to generate routes: filtered route count exceeded source route count.'
    );
    process.exit(1);
  }

  const sourceHasRootRoute = hasRouteWithPath(sourceRouteBlocks, '');
  const sourceHasFallbackRoute = hasRouteWithPath(sourceRouteBlocks, '**');

  if (sourceHasRootRoute && !hasRouteWithPath(filteredRoutes, '')) {
    console.error(
      'Unable to generate routes: root route path (\'\') disappeared after filtering.'
    );
    process.exit(1);
  }

  if (sourceHasFallbackRoute && !hasRouteWithPath(filteredRoutes, '**')) {
    console.error(
      'Unable to generate routes: wildcard fallback route path (\'**\') disappeared after filtering.'
    );
    process.exit(1);
  }
}

function hasRouteWithPath(routeBlocks, routePath) {
  return routeBlocks.some((routeBlock) => getRoutePath(routeBlock) === routePath);
}

function warnUnknownRoutePaths(unknownRoutePaths) {
  if (!unknownRoutePaths.size) {
    return;
  }

  const sortedPaths = Array.from(unknownRoutePaths).sort();
  console.warn(
    `Warning: route include map is missing ${sortedPaths.length} route path(s): ${sortedPaths.join(', ')}. ` +
    'These routes are included by default.'
  );
}

function renderRoutesFile(routes, featureBasedRoutes) {
  const routeEntries = routes
    .map(route => indentBlock(normalizeRouteBlockIndentation(route), 2))
    .join(',\n');

  return `import { Routes } from '@angular/router';

import { authFeatureEnabledMatchGuard } from '@guards/auth-feature-enabled-match.guard';
import { authGuard } from '@guards/auth.guard';
import { resetPasswordJwtGuard } from '@guards/reset-password-jwt.guard';
import { verifyEmailJwtGuard } from '@guards/verify-email-jwt.guard';

/**
 * AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
 * Source: prebuild-generate-routes.js
 * Route definitions source: ${sourceRoutesFilepath}
 * Feature-based route filtering: ${featureBasedRoutes}
 */
export const routes: Routes = [
${routeEntries}
];
`;
}

function writeAuthProtectedRoutesFile(routeBlocks, featureBasedRoutes, authEnabled) {
  const authProtectedRoutePaths = getAuthProtectedRoutePaths(routeBlocks, authEnabled);
  const fileContent = renderAuthProtectedRoutesFile(
    authProtectedRoutePaths,
    featureBasedRoutes,
    authEnabled
  );
  fs.writeFileSync(path.join(__dirname, authProtectedOutputFilepath), fileContent);
  console.log(
    `Generated auth-protected routes file (${authProtectedRoutePaths.length} route paths, auth enabled: ${authEnabled}, feature-based mode: ${featureBasedRoutes}).`
  );
}

function getAuthProtectedRoutePaths(routeBlocks, authEnabled) {
  if (!authEnabled) {
    return [];
  }

  return extractAuthProtectedRoutePaths(routeBlocks);
}

function getAuthProtectedRoutePathsFromSourceFile(routesFilepath, authEnabled) {
  const sourceContent = fs.readFileSync(path.join(__dirname, routesFilepath), 'utf-8');
  const routeBlocks = extractRouteBlocks(sourceContent);
  return getAuthProtectedRoutePaths(routeBlocks, authEnabled);
}

function extractAuthProtectedRoutePaths(routeBlocks) {
  const paths = routeBlocks
    .filter(isAuthProtectedRouteBlock)
    .map(getRoutePath)
    .filter((routePath) => routePath !== null);
  return Array.from(new Set(paths)).sort();
}

function isAuthProtectedRouteBlock(routeBlock) {
  const usesAuthGuard = /canActivate\s*:\s*\[[^\]]*\bauthGuard\b[^\]]*\]/s.test(routeBlock);
  const usesAuthFeatureEnabledMatchGuard =
    /canMatch\s*:\s*\[[^\]]*\bauthFeatureEnabledMatchGuard\b[^\]]*\]/s.test(routeBlock);

  return usesAuthGuard || usesAuthFeatureEnabledMatchGuard;
}

function renderAuthProtectedRoutesFile(routePaths, featureBasedRoutes, authEnabled) {
  const entries = routePaths.length
    ? routePaths.map((routePath) => `  ${JSON.stringify(routePath)}`).join(',\n')
    : '  // none';

  return `/**
 * AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.
 * Source: prebuild-generate-routes.js
 * Route definitions source: ${sourceRoutesFilepath}
 * Feature-based route filtering: ${featureBasedRoutes}
 * Auth feature enabled: ${authEnabled}
 *
 * Route paths that should be client-rendered when auth is enabled.
 * Includes paths that use authGuard and/or authFeatureEnabledMatchGuard.
 * This list is intentionally empty when app.auth.enabled is false.
 */
export const authProtectedRoutePaths: readonly string[] = [
${entries}
];
`;
}

function indentBlock(value, spaces) {
  const prefix = ' '.repeat(spaces);
  return value
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n');
}

function normalizeRouteBlockIndentation(routeBlock) {
  const lines = routeBlock.split('\n');

  if (lines.length <= 1) {
    return routeBlock;
  }

  const linesAfterFirst = lines.slice(1);
  const nonEmptyLines = linesAfterFirst.filter(line => line.trim().length > 0);

  if (!nonEmptyLines.length) {
    return routeBlock;
  }

  const minIndent = nonEmptyLines.reduce((min, line) => {
    const leadingWhitespace = line.match(/^\s*/)?.[0].length ?? 0;
    return Math.min(min, leadingWhitespace);
  }, Number.POSITIVE_INFINITY);

  const normalizedLines = [
    lines[0],
    ...linesAfterFirst.map(line => line.slice(Math.min(minIndent, line.length)))
  ];

  return normalizedLines.join('\n');
}

/**
 * Replaces line and block comments with whitespace while preserving string
 * and template literal content as-is. Output length is identical to input.
 */
function stripCommentsPreserveLiterals(value) {
  let output = '';
  let inString = false;
  let stringQuote = '';
  let escapeNext = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    const nextChar = value[i + 1];

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
        output += char;
      } else {
        output += ' ';
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        output += '  ';
        inBlockComment = false;
        i += 1;
      } else if (char === '\n' || char === '\r') {
        output += char;
      } else {
        output += ' ';
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      inString = true;
      stringQuote = char;
      output += char;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      output += '  ';
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      output += '  ';
      inBlockComment = true;
      i += 1;
      continue;
    }

    output += char;
  }

  return output;
}

if (require.main === module) {
  generateRoutes();
}

module.exports = {
  generateRoutes,
  extractRouteBlocks,
  extractRoutesArrayBody,
  getRoutePath,
  stripCommentsPreserveLiterals,
  getAuthProtectedRoutePaths,
  getAuthProtectedRoutePathsFromSourceFile,
  extractAuthProtectedRoutePaths,
  isAuthProtectedRouteBlock
};
