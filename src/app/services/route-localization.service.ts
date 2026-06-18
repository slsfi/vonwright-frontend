import { Injectable, LOCALE_ID, inject } from '@angular/core';

import { config } from '@config';
import { Article } from '@models/article.models';
import { parseRelativeUrl } from '@utility-functions';


@Injectable({
  providedIn: 'root',
})
export class RouteLocalizationService {
  private activeLocale = inject(LOCALE_ID);

  /**
   * Returns an app-relative URL localized for the target locale, preserving
   * query params and fragments. Routes without locale-specific segments are
   * returned unchanged.
   */
  localizeRouterUrl(routerUrl: string, targetLocale: string): string {
    const parsedUrl = parseRelativeUrl(routerUrl);

    if (!parsedUrl) {
      return routerUrl;
    }

    const localizedPathname = this.localizePathname(parsedUrl.pathname, targetLocale);
    return localizedPathname + parsedUrl.search + parsedUrl.hash;
  }

  /**
   * Localizes the route path when it contains known locale-specific segments.
   */
  private localizePathname(pathname: string, targetLocale: string): string {
    const articleRouteName = this.getArticleRouteName(pathname);

    if (!articleRouteName) {
      return pathname;
    }

    const localizedArticleRouteName = this.getLocalizedArticleRouteName(
      articleRouteName,
      targetLocale
    );

    return localizedArticleRouteName
      ? `/article/${localizedArticleRouteName}`
      : pathname;
  }

  /**
   * Finds the target-locale route name for an article route name.
   */
  private getLocalizedArticleRouteName(
    routeName: string,
    targetLocale: string
  ): string | null {
    const sourceArticle = this.resolveArticleByRouteName(routeName);

    if (!sourceArticle) {
      return null;
    }

    const articles: Article[] = config.articles ?? [];
    const targetArticle = articles.find(
      (article: Article) => article.id === sourceArticle.id && article.language === targetLocale
    );

    return targetArticle?.routeName ?? null;
  }

  /**
   * Resolves an article from a route name, preferring the active locale.
   */
  private resolveArticleByRouteName(routeName: string): Article | null {
    const articles: Article[] = config.articles ?? [];
    const activeLocaleArticle = articles.find(
      (article: Article) => article.routeName === routeName && article.language === this.activeLocale
    );

    if (activeLocaleArticle) {
      return activeLocaleArticle;
    }

    return articles.find(
      (article: Article) => article.routeName === routeName
    ) ?? null;
  }

  /**
   * Extracts the route name from an article path.
   */
  private getArticleRouteName(pathname: string): string | null {
    const routeSegments = this.getRouteSegmentsWithoutLocalePrefix(pathname);

    if (routeSegments.length !== 2 || routeSegments[0] !== 'article') {
      return null;
    }

    return routeSegments[1] || null;
  }

  /**
   * Splits a path into route segments and removes an optional locale prefix.
   */
  private getRouteSegmentsWithoutLocalePrefix(pathname: string): string[] {
    const routeSegments = pathname.split('/').filter(Boolean);

    if (this.isConfiguredLocale(routeSegments[0])) {
      return routeSegments.slice(1);
    }

    return routeSegments;
  }

  /**
   * Checks whether a route segment matches a configured locale code.
   */
  private isConfiguredLocale(segment: string | undefined): boolean {
    const languages = config.app?.i18n?.languages ?? [];
    return !!segment && languages.some((language: { code: string }) => language.code === segment);
  }

}
