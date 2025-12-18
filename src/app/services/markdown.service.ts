import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { Marked } from 'marked';
import markedFootnote from 'marked-footnote';
import customHeadingId from "marked-custom-heading-id";

import { config } from '@config';
import { MarkdownApiResponse } from '@models/markdown.models';
import { MdMenuNodeApiResponse } from '@models/menu.models';


@Injectable({
  providedIn: 'root',
})
export class MarkdownService {
  private http = inject(HttpClient);

  private readonly apiURL: string = `${config.app?.backendBaseURL ?? ''}/${config.app?.projectNameDB ?? ''}`;
  /** One HTTP call per language for Markdown menu tree requests;
   * value is shared & cached. */
  private mdMenuTreeCache = new Map<string, Observable<MdMenuNodeApiResponse | null>>();

  private marked: Marked;

  constructor() {

    // * Create new instance of Marked to keep options and extensions
    // * locally scoped. Adding the marked-footnote extension to the
    // * global scope of Marked will cause it to be added on every
    // * SSR, ultimately resulting in an unresponsive app.
    //   https://marked.js.org/using_advanced#instance
    this.marked = new Marked();

    // Configure this instance of Marked to use the marked-footnote
    // extension for handling GitHub flavoured Markdown footnotes:
    // https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#footnotes
    // https://github.com/bent10/marked-extensions/tree/main/packages/footnote
    this.marked.use(markedFootnote({
      backRefLabel: $localize`:@@About.FootnotesBackToReference:Tillbaka till nothänvisning` + ' {0}',
      description: $localize`:@@About.FootnotesHeading:Noter`,
      headingClass: '',
      prefixId: 'md-footnote-'
    }));

    // Configure this instance of Marked to use the
    // marked-custom-heading-id extension for enabling custom heading
    // ids with the Markdown Extended Syntax `# heading {#custom-id}`.
    // https://www.markdownguide.org/extended-syntax/#heading-ids
    // https://github.com/markedjs/marked-custom-heading-id
    this.marked.use(customHeadingId());
  }

  getMenuTree(
    language: string,
    rootNodeID: string
  ): Observable<MdMenuNodeApiResponse | null> {
    return this.getStaticPagesToc(language).pipe(
      map((res: MdMenuNodeApiResponse | null) => {
        if (!res) {
          return null;
        }

        let node = this.getNodeById(`${language}-${rootNodeID}`, res);
        if (!node) {
          return null;
        }

        node.id = this.stripLocaleFromID(node.id);
        if (node.children?.length) {
          this.stripLocaleFromAboutPagesIDs(node.children);
        }
        return node;
      })
    );
  }

  /**
   * Get the content of a markdown file from the backend parsed to HTML as a string.
   * @param fileID ID of the file to get content of.
   * @param errorMessage optional message to display if the file content can’t be fetched.
   * @returns HTML as a string or null.
   */
  getParsedMdContent(fileID: string, errorMessage: string = ''): Observable<string | null> {
    return this.getMdContent(fileID).pipe(
      map((md: string) => {
        return md.trim() ? this.parseMd(md) : null;
      }),
      catchError((e: any) => {
        console.error('Error loading markdown content', e);
        return of(errorMessage || null);
      })
    );
  }

  /**
   * Get the content of a markdown file from the backend. Prefer using the
   * method 'getParsedMdContent' instead if you need the markdown parsed into HTML.
   * @param fileID ID of the file to get content of.
   * @returns string with the markdown content.
   */
  getMdContent(fileID: string): Observable<string> {
    const endpoint = `${this.apiURL}/md/${fileID}`;
    return this.http.get<MarkdownApiResponse>(endpoint).pipe(
      map((res: MarkdownApiResponse) => (res.content ?? ''))
    );
  }

  /**
   * Parses the given markdown to HTML and returns it as a string.
   */
  parseMd(md: string): string {
    return this.marked.parse(md) as string;
  }

  /** Cached raw menu tree endpoint per language. */
  private getStaticPagesToc(language: string): Observable<MdMenuNodeApiResponse | null> {
    let cached$ = this.mdMenuTreeCache.get(language);
    if (!cached$) {
      const endpoint = `${this.apiURL}/static-pages-toc/${language}`;
      cached$ = this.http.get<MdMenuNodeApiResponse>(endpoint).pipe(
        catchError(() => of(null)),
        // one-shot HTTP: cache forever and replay to late subscribers
        shareReplay({ bufferSize: 1, refCount: false })
      );
      this.mdMenuTreeCache.set(language, cached$);
    }
    return cached$;
  }

  /**
   * Find a node by id in a JSON tree
   */
  private getNodeById(id: any, tree: any) {
    const reduce = [].reduce;
    const runner: any = (result: any, node: any) => {
      if (result || !node) {
        return result;
      }
      return (
        (node.id === id && node) ||
        runner(null, node.children) ||
        reduce.call(Object(node), runner, result)
      );
    };
    return runner(null, tree);
  }

  private stripLocaleFromAboutPagesIDs(array: MdMenuNodeApiResponse[]) {
    array.forEach((n: MdMenuNodeApiResponse) => {
      n.id = this.stripLocaleFromID(n.id);
      if (n.children?.length) {
        this.stripLocaleFromAboutPagesIDs(n.children);
      }
    });
  }

  private stripLocaleFromID(id: string) {
    return id.slice(id.indexOf('-') + 1);
  }

}
