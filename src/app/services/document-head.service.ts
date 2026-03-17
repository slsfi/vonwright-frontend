import { Injectable, LOCALE_ID, OnDestroy, Renderer2, RendererFactory2, DOCUMENT, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { BehaviorSubject, Observable } from 'rxjs';
import { Request } from 'express';

import { config } from '@config';
import { Article } from '@models/article.models';
import { REQUEST } from 'src/express.tokens';


@Injectable({
  providedIn: 'root',
})
export class DocumentHeadService implements OnDestroy {
  private meta = inject(Meta);
  private rendererFactory = inject(RendererFactory2);
  private title = inject(Title);
  private document = inject<Document>(DOCUMENT);
  private activeLocale = inject(LOCALE_ID);
  private request = inject<Request>(REQUEST, { optional: true });

  private readonly languages: any[] = config.app?.i18n?.languages ?? [];
  private readonly openGraphTags: any = config.app?.openGraphMetaTags ?? undefined;
  private readonly articles: Article[] = config.articles ?? [];

  private addedHeadElements: HTMLElement[] = [];
  private currentPageTitle$: BehaviorSubject<string> = new BehaviorSubject('');
  private currentRouterUrl: string | undefined = undefined;
  private renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);

  /**
   * Cleans up dynamically added head elements when the service is destroyed.
   */
  ngOnDestroy(): void {
    this.cleanupAddedHeadElements();
  }

  /**
   * Sets the document title from page-specific title parts.
   * Also updates `og:title` when Open Graph tags are enabled.
   * @param pageTitleParts Ordered title segments.
   */
  setTitle(pageTitleParts: string[] = []) {
    let compositePageTitle = '';
    for (let i = 0; i < pageTitleParts.length; i++) {
      if (pageTitleParts[i] && pageTitleParts[i].length) {
        if (pageTitleParts[i].at(-1) === '.') {
          pageTitleParts[i] = pageTitleParts[i].slice(0, -1);
        }
        compositePageTitle = i > 0 ? compositePageTitle + ' - ' + pageTitleParts[i]
          : pageTitleParts[i];
        if (i < 1) {
          this.setCurrentPageTitle(pageTitleParts[i]);
        }
      }
    }

    // Construct the final title for the document head
    const headTitle = compositePageTitle
      ? compositePageTitle + ' - ' + $localize`:@@Site.Title:Webbplatsens titel`
      : $localize`:@@Site.Title:Webbplatsens titel`;

    // Set the document title only if it has changed
    if (this.title.getTitle() !== headTitle) {
      this.title.setTitle(headTitle);

      // If Open Graph tags are enabled, set the title in the meta tags too.
      // (hyphens are replaced by dashes)
      if (this.openGraphTags?.enabled) {
        const ogTitle = compositePageTitle
          ? compositePageTitle
          : $localize`:@@Site.Title:Webbplatsens titel`;
        this.setMetaTag('property', 'og:title', ogTitle.replaceAll(' - ', ' – '));
      }
    }
  }

  /**
   * Updates canonical and alternate hreflang link tags for the current route.
   * @param routerURL Current route path without locale prefix.
   */
  setLinks(routerURL: string) {
    routerURL = this.resolveRouterURL(routerURL);
    if (routerURL !== this.currentRouterUrl) {
      this.currentRouterUrl = routerURL;

      const x_default = config.app?.i18n?.defaultLanguage ?? this.languages[0].code;

      // Remove old tags
      this.removeLinkTags('canonical');
      this.removeLinkTags('alternate', true);

      // Add new canonical link tag
      this.addLinkTag('canonical', x_default, routerURL);

      // Add new hreflang link tags
      if (this.languages.length > 1) {
        this.languages.forEach(language => {
          this.addLinkTag('alternate', language.code, routerURL, true);
        });

        this.addLinkTag('alternate', x_default, routerURL, true, true);
      }
    }
  }

  /**
   * Sets Open Graph (https://ogp.me/) metadata tags that are
   * common to all routes.
   */
  setCommonOpenGraphTags() {
    if (this.openGraphTags?.enabled) {
      // Set og:site_name
      this.setMetaTag('property', 'og:site_name', $localize`:@@Site.Title:Webbplatsens titel`);

      // Sets og:type
      this.setMetaTag('property', 'og:type', 'website');

      // Set og:locale and og:locale:alternate
      const appLocales = config.app?.i18n?.languages ?? [];
      appLocales.forEach((locale: any) => {
        const metaProperty = (locale.code === this.activeLocale)
              ? 'og:locale'
              : 'og:locale:alternate';
        const metaContent = locale.code + '_'
              + (locale.region ? locale.region : locale.code).toUpperCase();
        this.setMetaTag('property', metaProperty, metaContent);
      });

      // Set og:image and og:image:alt
      let imageURL: string = this.openGraphTags?.image?.[this.activeLocale]?.URL
            ? this.openGraphTags?.image?.[this.activeLocale]?.URL
            : config.page?.home?.bannerImage?.URL ?? '';
      const origin = this.getOrigin();
      const localeRoot = origin ? origin + '/' + this.activeLocale + '/' : '';

      if (imageURL && !imageURL.startsWith(
        localeRoot
      )) {
        if (imageURL.at(0) === '/') {
          imageURL = imageURL.slice(1);
        }
        imageURL = localeRoot + imageURL;
      }

      const altText: string = this.openGraphTags?.image?.[this.activeLocale]?.altText
            ? this.openGraphTags?.image?.[this.activeLocale]?.altText
            : config.page?.home?.bannerImage?.altTexts?.[this.activeLocale] ?? 'image';
      
      this.setMetaTag('property', 'og:image', imageURL);
      this.setMetaTag('property', 'og:image:alt', altText);
    }
  }

  /**
   * Sets the Open Graph URL (`og:url`) for the current route.
   * @param routerURL Current route path without locale prefix.
   */
  setOpenGraphURLProperty(routerURL: string) {
    if (this.openGraphTags?.enabled) {
      this.setMetaTag(
        'property',
        'og:url',
        this.getAbsoluteURL(this.activeLocale + this.resolveRouterURL(routerURL))
      );
    }
  }

  /**
   * Sets or clears the Open Graph description (`og:description`).
   * @param description Description text to set.
   */
  setOpenGraphDescriptionProperty(description: string) {
    if (this.openGraphTags?.enabled) {
      this.setMetaTag('property', 'og:description', description);
    }
  }

  /**
   * Adds, updates or removes a meta tag from the document <head>.
   * If 'content' is empty, the tag with attribute defName="defValue"
   * is removed. If a tag with a defName attribute doesn't exist, it
   * is added, otherwise it's 'content' is updated.
   * @param defName value of the name attribute of the meta tag.
   * @param defValue value of the name attribute of the meta tag.
   * @param content value of the content attribute of the meta tag.
   */
  setMetaTag(defName: string, defValue: string, content?: string) {
    if (content) {
      this.meta.updateTag({
        [defName]: defValue,
        content: content
      });
    } else {
      this.meta.removeTag(defName + '=' + defValue.replaceAll(':', '\\:'));
    }
  }

  /**
   * Creates and appends a link tag in `<head>`.
   * @param relType Link relation type (`canonical` or `alternate`).
   * @param locale Target locale code for the generated URL.
   * @param routerURL Route path without locale prefix.
   * @param hreflang Whether to add the `hreflang` attribute.
   * @param x_default Whether `hreflang` should be `x-default`.
   */
  private addLinkTag(
    relType: string,
    locale: string,
    routerURL: string,
    hreflang: boolean = false,
    x_default: boolean = false
  ) {
    const tag: HTMLLinkElement = this.renderer.createElement('link');
    this.renderer.setAttribute(tag, 'rel', relType);

    let targetURL = routerURL;

    if (hreflang) {
      const attrValue = x_default ? 'x-default' : locale;
      this.renderer.setAttribute(tag, 'hreflang', attrValue);
    }

    if (routerURL.startsWith('/article/')) {
      // Article URLs need to be constructed from config for the routeName
      // to be correctly mapped.
      const currentRouteName = routerURL.split('/').at(-1);
      // Find the article matching the current routeName and locale
      const currentArticle = this.articles.find(
        a => a.language === this.activeLocale && a.routeName === currentRouteName
      );

      if (currentArticle) {
        // Find the article in the target locale
        const targetArticle = this.articles.find(
          a => a.language === locale && a.id === currentArticle.id
        );
        targetURL = targetArticle ? `/article/${targetArticle.routeName}` : targetURL;
      }
    }

    const absoluteURL = this.getAbsoluteURL(locale + targetURL);
    this.renderer.setAttribute(tag, 'href', absoluteURL);
    this.renderer.appendChild(this.document.head, tag);
    // Add the element to the array keeping track of elements that have
    // been added to the DOM so they can be cleaned up when the service is
    // destroyed.
    this.addedHeadElements.push(tag);
  }

  /**
   * Removes existing link tags from `<head>` by relation type.
   * @param relType Link relation type to remove.
   * @param hreflang If true, removes only tags that have a `hreflang` attribute.
   */
  private removeLinkTags(relType: string, hreflang: boolean = false) {
    const hreflangAttr = hreflang ? '[hreflang]' : '';
    const linkTags = this.document.head.querySelectorAll(
      'link[rel="' + relType + '"]' + hreflangAttr
    );
    for (let i = 0; i < linkTags.length; i++) {
      this.renderer.removeChild(this.document.head, linkTags[i]);
    }

    // The link tags that are removed from the DOM also need to be removed
    // from the array keeping track of which elements have been added to
    // the DOM, so they can be cleaned up when the service is destroyed.
    this.addedHeadElements = this.addedHeadElements.filter((tag: HTMLElement) => {
      // Keep the tag if it does not match the criteria for removal
      return !(
        tag.tagName === 'LINK' &&
        tag.getAttribute('rel') === relType &&
        (hreflang ? tag.hasAttribute('hreflang') : true)
      );
    });
  }

  /**
   * Builds an absolute URL from a route-relative URL.
   * @param relativeURL Relative URL segment.
   * @returns Absolute URL including origin.
   */
  private getAbsoluteURL(relativeURL: string) {
    const normalizedRelativeURL = relativeURL.startsWith('/') ? relativeURL.slice(1) : relativeURL;
    return this.getOrigin() + '/' + normalizedRelativeURL;
  }

  /**
   * Removes query parameters from a URL.
   * @param url URL to canonicalize.
   * @returns URL without query parameters.
   */
  private canonicalizeURL(url: string): string {
    return url.split('?')[0];
  }

  /**
   * Resolves the effective route path for SEO tags.
   * Falls back to SSR request path when router URL is root.
   * @param routerURL Router-provided URL.
   * @returns Canonical route path without locale prefix.
   */
  private resolveRouterURL(routerURL: string): string {
    const canonicalURL = this.canonicalizeURL(routerURL || '/');
    const requestURL = this.getRequestPathWithoutLocale();

    if (canonicalURL && canonicalURL !== '/') {
      return canonicalURL;
    }

    return requestURL || canonicalURL || '/';
  }

  /**
   * Resolves the active origin for absolute URL generation.
   * Priority: SSR request origin, browser origin, configured site origin.
   * @returns Origin string (`scheme://host`).
   */
  private getOrigin(): string {
    const requestOrigin = this.getRequestOrigin();
    if (requestOrigin) {
      return requestOrigin;
    }
    return String(this.document.defaultView?.location.origin ?? config.app?.siteURLOrigin ?? '');
  }

  /**
   * Builds an origin from SSR request headers when available.
   * @returns Origin derived from request metadata.
   */
  private getRequestOrigin(): string | undefined {
    if (!this.request) {
      return undefined;
    }

    const host = this.getRequestHeaderValue('x-forwarded-host')
      || this.getRequestHeaderValue('host');

    if (!host) {
      return undefined;
    }

    const protocol = this.getRequestHeaderValue('x-forwarded-proto')
      || (!this.isLocalHost(host) ? this.getConfiguredOriginProtocol() : undefined)
      || this.request.protocol
      || 'http';

    return protocol + '://' + host;
  }

  /**
   * Returns the first normalized value of a request header.
   * @param headerName Request header name.
   * @returns Header value if present.
   */
  private getRequestHeaderValue(headerName: string): string | undefined {
    const header = this.request?.headers?.[headerName];
    if (!header) {
      return undefined;
    }
    const firstValue = Array.isArray(header) ? header[0] : header;
    const normalizedValue = String(firstValue).split(',')[0]?.trim();
    return normalizedValue || undefined;
  }

  /**
   * Resolves the SSR request path with locale prefix removed.
   * @returns Canonical path without locale prefix.
   */
  private getRequestPathWithoutLocale(): string | undefined {
    const requestPath = this.request?.url || this.request?.originalUrl;
    if (!requestPath) {
      return undefined;
    }

    let normalizedPath = this.canonicalizeURL(requestPath);
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = '/' + normalizedPath;
    }

    for (const language of this.languages) {
      const languagePrefix = '/' + language.code;
      if (
        normalizedPath === languagePrefix ||
        normalizedPath.startsWith(languagePrefix + '/')
      ) {
        const strippedPath = normalizedPath.slice(languagePrefix.length);
        return strippedPath || '/';
      }
    }

    return normalizedPath;
  }

  /**
   * Extracts protocol from `config.app.siteURLOrigin`.
   * @returns Protocol name without trailing colon.
   */
  private getConfiguredOriginProtocol(): string | undefined {
    const configuredOrigin = config.app?.siteURLOrigin;
    if (!configuredOrigin) {
      return undefined;
    }

    try {
      return new URL(configuredOrigin).protocol.replace(':', '');
    } catch {
      return undefined;
    }
  }

  /**
   * Checks whether a host points to localhost.
   * @param host Host string, optionally including port.
   * @returns True for localhost and loopback addresses.
   */
  private isLocalHost(host: string): boolean {
    const hostname = host.split(':')[0].toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1'
    );
  }

  /**
   * Publishes the current page title for subscribers.
   * @param newTitle New current page title.
   */
  setCurrentPageTitle(newTitle: string) {
    this.currentPageTitle$.next(newTitle);
  }

  /**
   * Returns an observable stream of current page title updates.
   * @returns Observable emitting current page title.
   */
  getCurrentPageTitle(): Observable<string> {
    return this.currentPageTitle$.asObservable();
  }

  /**
   * Removes all head elements added by this service instance.
   */
  private cleanupAddedHeadElements() {
    this.addedHeadElements.forEach(tag => {
      this.renderer.removeChild(this.document.head, tag);
    });
    this.addedHeadElements = [];
  }

}
