import { Inject, Injectable, LOCALE_ID, Renderer2, RendererFactory2 } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { BehaviorSubject, Observable } from 'rxjs';

import { config } from '@config';


@Injectable({
  providedIn: 'root',
})
export class DocumentHeadService {
  private currentPageTitle$: BehaviorSubject<string> = new BehaviorSubject('');
  private currentRouterUrl: string | undefined = undefined;
  private openGraphTags: any = undefined;
  private languages: any[] = [];
  private renderer: Renderer2;

  constructor(
    private meta: Meta,
    private rendererFactory: RendererFactory2,
    private title: Title,
    @Inject(DOCUMENT) private document: Document,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    this.openGraphTags = config.app?.openGraphMetaTags ?? undefined;
    this.languages = config.app?.i18n?.languages ?? [];
    this.renderer = this.rendererFactory.createRenderer(null, null);
  }

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

    if (this.openGraphTags?.enabled) {
      const ogTitle = compositePageTitle
        ? compositePageTitle
        : $localize`:@@Site.Title:Webbplatsens titel`;
      this.setMetaTag('property', 'og:title', ogTitle.replaceAll(' - ', ' – '));
    }

    compositePageTitle = compositePageTitle
      ? compositePageTitle + ' - ' + $localize`:@@Site.Title:Webbplatsens titel`
      : $localize`:@@Site.Title:Webbplatsens titel`;

    this.title.setTitle(compositePageTitle);
  }

  setLinks(routerURL: string) {
    routerURL = this.canonicalizeURL(routerURL);
    if (routerURL !== this.currentRouterUrl) {
      this.currentRouterUrl = routerURL;

      const x_default = config.app?.i18n?.defaultLanguage
        ? config.app.i18n.defaultLanguage
        : this.languages[0].code;

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

      if (imageURL && !imageURL.startsWith(
        String(this.document.defaultView?.location.origin) + '/' + this.activeLocale + '/'
      )) {
        if (imageURL.at(0) === '/') {
          imageURL = imageURL.slice(1);
        }
        imageURL = String(this.document.defaultView?.location.origin)
              + '/' + this.activeLocale + '/' + imageURL;
      }

      const altText: string = this.openGraphTags?.image?.[this.activeLocale]?.altText
            ? this.openGraphTags?.image?.[this.activeLocale]?.altText
            : config.page?.home?.bannerImage?.altTexts?.[this.activeLocale] ?? 'image';
      
      this.setMetaTag('property', 'og:image', imageURL);
      this.setMetaTag('property', 'og:image:alt', altText);
    }
  }

  setOpenGraphURLProperty(routerURL: string) {
    if (this.openGraphTags?.enabled) {
      this.setMetaTag(
        'property',
        'og:url',
        this.getAbsoluteURL(this.activeLocale + this.canonicalizeURL(routerURL))
      );
    }
  }

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

  private addLinkTag(
    relType: string,
    locale: string,
    routerURL: string,
    hreflang: boolean = false,
    x_default: boolean = false
  ) {
    const tag: HTMLLinkElement = this.renderer.createElement('link');
    this.renderer.setAttribute(tag, 'rel', relType);
    if (hreflang) {
      !x_default && this.renderer.setAttribute(tag, 'hreflang', locale);
      x_default && this.renderer.setAttribute(tag, 'hreflang', 'x-default');
    }
    this.renderer.setAttribute(tag, 'href', this.getAbsoluteURL(locale + routerURL));
    this.renderer.appendChild(this.document.head, tag);
  }

  private removeLinkTags(relType: string, hreflang: boolean = false) {
    const hreflangAttr = hreflang ? '[hreflang]' : '';
    const linkTags = this.document.head.querySelectorAll(
      'link[rel="' + relType + '"]' + hreflangAttr
    );
    for (let i = 0; i < linkTags.length; i++) {
      this.renderer.removeChild(this.document.head, linkTags[i]);
    }
  }

  private getAbsoluteURL(relativeURL: string) {
    return String(this.document.defaultView?.location.origin) + '/' + relativeURL;
  }

  private canonicalizeURL(url: string): string {
    return url.split('?')[0];
  }

  setCurrentPageTitle(newTitle: string) {
    this.currentPageTitle$.next(newTitle);
  }

  getCurrentPageTitle(): Observable<string> {
    return this.currentPageTitle$.asObservable();
  }

}
