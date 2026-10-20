import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** URL and filesystem metadata for one application locale. */
export interface ServerLocale {
  /** Angular locale identifier, which can differ from the locale's URL subpath. */
  code: string;
  /** Deployment base path plus locale subpath, without surrounding slashes; empty at the root. */
  path: string;
  /** Deployment base path without the locale subpath or surrounding slashes. */
  basePath: string;
  /** Browser output directory containing this locale's CSR shell and static files. */
  browserFolder: string;
}

interface LocalizedProject {
  i18n: {
    sourceLocale: string | { code: string; subPath?: string };
    locales: Record<string, string | { subPath?: string }>;
  };
  architect: {
    build: {
      options: { localize?: boolean | string[]; baseHref?: string };
      configurations: { production?: { localize?: boolean | string[]; [option: string]: unknown } };
    };
  };
}

/**
 * Derives locale URL prefixes and browser directories from Angular's production build settings.
 *
 * Production localization overrides the base build option. Disabled localization uses
 * the source locale at the browser root; enabled localization uses each locale's subPath.
 * When browser output is available, only locales with an index.csr.html are retained.
 * If none exist yet, retain the configured list for CLI in-memory builds.
 *
 * The base app omits build.options.baseHref, so its deployment base path is empty.
 * Forks deployed under a subdirectory can set it (e.g. '/edition/') to prefix
 * locale URLs with that path.
 *
 * @param project Angular project configuration containing i18n and application build options.
 * @param browserFolder Browser output root before locale subdirectories are appended.
 * @param useEmittedLocales Whether to inspect emitted CSR shells; false ignores stale disk output.
 * @returns Available locale metadata in the configured build order.
 */
export function getServerLocales(project: LocalizedProject, browserFolder: string, useEmittedLocales = true): ServerLocale[] {
  const build = project.architect.build;
  const localize = build.configurations.production?.localize ?? build.options.localize;
  const source = project.i18n.sourceLocale;
  const sourceCode = typeof source === 'string' ? source : source.code;
  const localizationEnabled = localize === true || (Array.isArray(localize) && localize.length > 0);
  const codes = Array.isArray(localize) && localize.length ? localize
    : localize === true ? [sourceCode, ...Object.keys(project.i18n.locales)] : [sourceCode];
  // Trim surrounding slashes while preserving separators inside the deployment path.
  const baseHref = build.options.baseHref ?? '';
  let baseStart = 0;
  let baseEnd = baseHref.length;
  while (baseStart < baseEnd && baseHref[baseStart] === '/') {
    baseStart++;
  }
  while (baseEnd > baseStart && baseHref[baseEnd - 1] === '/') {
    baseEnd--;
  }
  const basePath = baseHref.slice(baseStart, baseEnd);
  const locales = codes.map(code => {
    const locale = code === sourceCode ? source : project.i18n.locales[code];
    const subPath = localizationEnabled ? (typeof locale === 'object' ? locale.subPath ?? code : code) : '';
    return {
      code,
      path: [basePath, subPath].filter(Boolean).join('/'),
      basePath,
      browserFolder: join(browserFolder, subPath)
    };
  });
  if (!useEmittedLocales) return locales;
  const emitted = locales.filter(locale => existsSync(join(locale.browserFolder, 'index.csr.html')));
  // During CLI in-memory builds the browser output is not on disk yet.
  return emitted.length ? emitted : locales;
}

/**
 * Selects the application locale used for unprefixed requests.
 *
 * Prefer the configured default language when it was emitted. Otherwise use the first
 * available locale, allowing a single-locale build to run with a different configured default.
 *
 * @param locales Available locales from getServerLocales().
 * @param defaultLanguage Preferred Angular locale code from app.i18n.defaultLanguage.
 * @returns The matching locale or the first entry in locales.
 * @throws Error when no locales are available.
 */
export function getDefaultServerLocale(locales: readonly ServerLocale[], defaultLanguage?: string): ServerLocale {
  const locale = locales.find(candidate => candidate.code === defaultLanguage) ?? locales[0];
  if (!locale) {
    throw new Error('No SSR locales configured');
  }
  return locale;
}

/**
 * Gives Angular a default-locale URL for unprefixed requests without redirecting the browser.
 *
 * URLs already under a configured locale prefix are unchanged. Other paths receive the
 * default locale prefix without duplicating the deployment base path. Escaped path segments
 * and query parameters are preserved, and the input URL is never modified.
 *
 * @param url Incoming absolute request URL.
 * @param locales Available locales whose URL prefixes should be left intact.
 * @param defaultLocale Locale selected for unprefixed requests.
 * @returns The original URL when no rewrite is needed, otherwise a new localized URL.
 */
export function localizeRequestUrl(url: URL, locales: readonly ServerLocale[], defaultLocale: ServerLocale): URL {
  if (!defaultLocale.path || locales.some(locale => locale.path &&
    (url.pathname === '/' + locale.path || url.pathname.startsWith('/' + locale.path + '/')))) {
    return url;
  }

  const localized = new URL(url);
  const base = '/' + defaultLocale.basePath;
  const pathname = defaultLocale.basePath && (url.pathname === base || url.pathname.startsWith(base + '/'))
    ? url.pathname.slice(base.length) || '/' : url.pathname;
  localized.pathname = '/' + defaultLocale.path + pathname;
  return localized;
}
