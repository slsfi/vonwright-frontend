import { Injectable, inject } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { Parser } from 'htmlparser2';
import { DomHandler } from 'domhandler';
import { existsOne, findAll, findOne, getChildren, getAttributeValue, isTag } from 'domutils';
import { render } from 'dom-serializer';

import { config } from '@config';
import { HeadingNode } from '@models/article.models';
import { TextKey } from '@models/collection.models';
import { Illustration } from '@models/illustration.models';
import { ReadingText } from '@models/readingtext.models';
import { CollectionContentService } from '@services/collection-content.service';
import { isFileNotFoundHtml } from '@utility-functions';


@Injectable({
  providedIn: 'root',
})
export class HtmlParserService {
  private collectionContentService = inject(CollectionContentService);

  private readonly addTEIClassNames: boolean = config.collections?.addTEIClassNames ?? true;
  private readonly apiURL: string = `${config.app?.backendBaseURL ?? ''}/${config.app?.projectNameDB ?? ''}`;
  private readonly mediaCollectionMappings: any = config.collections?.mediaCollectionMappings ?? {};
  private readonly replaceImageAssetsPaths: boolean = config.collections?.replaceImageAssetsPaths ?? true;

  postprocessReadingText(text: string, collectionId: string): string {
    // Fix image paths if config option for this enabled
    text = this.fixImageAssetsPaths(text);
    // Map illustration image paths to backend media paths
    text = this.mapIllustrationImagePaths(text, collectionId);
    // Add "tei" class to all classlists if config option for this enabled
    if (this.addTEIClassNames) {
      text = text.replace(
        /class="([a-z A-Z _ 0-9]{1,140})"/g,
        'class="tei $1"'
      );
    }
    return text;
  }

  postprocessManuscriptText(text: string): string {
    // Fix image paths if config option for this enabled
    text = this.fixImageAssetsPaths(text);
    // Add "tei" and "teiManuscript" to all classlists if config option for this enabled
    if (this.addTEIClassNames) {
      text = text.replace(
        /class=\"([a-z A-Z _ 0-9]{1,140})\"/g,
        'class=\"teiManuscript tei $1\"'
      );
    }
    return text;
  }

  postprocessVariantText(text: string): string {
    // Fix image paths if config option for this enabled
    text = this.fixImageAssetsPaths(text);
    // Add "tei" and "teiVariant" to all classlists if config option for this enabled
    if (this.addTEIClassNames) {
      text = text.replace(
        /class=\"([a-z A-Z _ 0-9]{1,140})\"/g,
        'class=\"teiVariant tei $1\"'
      );
    }
    return text;
  }

  getReadingTextIllustrations(textKey: TextKey): Observable<Illustration[]> {
    return this.collectionContentService.getReadingText(textKey).pipe(
      map((rt: ReadingText) => {
        const images: Illustration[] = [];
        if (rt?.html && !isFileNotFoundHtml(rt.html)) {
          const _apiURL = this.apiURL;
          const collectionID = textKey.collectionID;
          const galleryId = this.mediaCollectionMappings?.[collectionID];
          let text = this.postprocessReadingText(rt.html, collectionID);

          // Parse the read text html to get all illustrations in it using
          // SSR compatible htmlparser2
          const parser = new Parser({
            onopentag(name, attributes) {
              if (name === 'img' && attributes.src) {
                if (attributes.class?.includes('est_figure_graphic')) {
                  let illustrationClass = 'illustration';
                  if (!attributes.class?.includes('hide-illustration')) {
                    illustrationClass = 'visible-illustration';
                  }
                  const image: Illustration = {
                    src: attributes.src,
                    class: illustrationClass
                  };
                  images.push(image);
                } else if (
                  attributes.class?.includes('doodle') &&
                  attributes['data-id'] &&
                  galleryId
                ) {
                  const image: Illustration = {
                    src: `${_apiURL}/gallery/get/${galleryId}/`
                          + attributes['data-id'].replace('tag_', '') + '.jpg',
                    class: 'doodle'
                  };
                  images.push(image);
                }
              }
            }
          });
          parser.write(text);
          parser.end();
        }
        return images;
      }),
      catchError((e: any) => {
        console.error('Error loading readingtext text illustrations', e);
        return of([]);
      })
    );
  }

  /**
   * Replace paths in src attribute values for all images with classname
   * 'est_figure_graphic' in the given text (html as string). The paths
   * are replaced with the mapped backend path for the collection.
   * Returns the text with replaced values.
   */
  mapIllustrationImagePaths(text: string, collectionID: string): string {
    const galleryId = this.mediaCollectionMappings?.[collectionID];
    const visibleInlineIllustrations = config.collections?.inlineIllustrations ?? [];

    if (text.includes('est_figure_graphic')) {
      // Use SSR compatible htmlparser2 and related DOM-handling modules
      // (domhandler: https://domhandler.js.org/, domutils: https://domutils.js.org/,
      // dom-serializer: https://github.com/cheeriojs/dom-serializer)
      // to add class names to images and replace image file paths.
      const handler = new DomHandler();
      const parser = new Parser(handler);
      parser.write(text);
      parser.end();

      // Find all elements with 'est_figure_graphic' classname
      const m = findAll(
        el => String(getAttributeValue(el, 'class')).includes('est_figure_graphic'), handler.dom
      );

      if (!visibleInlineIllustrations.includes(Number(collectionID))) {
        // Hide inline illustrations in the read text
        m.forEach(element => {
          element.attribs.class += ' hide-illustration';
        });
      }

      // Replace src path with backend base path
      if (galleryId) {
        m.forEach(element => {
          // Only replace relative paths
          if (element.attribs.src && !(
            element.attribs.src.indexOf('://') > 0 ||
            element.attribs.src.indexOf('//') === 0
          )) {
            element.attribs.src = `${this.apiURL}/gallery/get/${galleryId}/`
                                  + element.attribs.src;
          }
        });
      }
      
      text = render(handler.dom, { decodeEntities: false });
    }

    return text;
  }

  readingTextHasVisibleIllustrations(text: string): boolean {
    const handler = new DomHandler();
    const parser = new Parser(handler);
    parser.write(text);
    parser.end();

    return existsOne(
      el => (
        String(getAttributeValue(el, 'class')).includes('est_figure_graphic') &&
        !String(getAttributeValue(el, 'class')).includes('hide-illustration')
      ), handler.dom
    );
  }

  /**
   * Inserts <mark> tags in 'text' (html as a string) around the strings
   * defined in 'matches'.
   * 
   * TODO: The regex doesn't work if the match string in the text is
   * interspersed with opening and closing tags.
   * 
   * For instance, in the text the match could have a span indicating
   * page break:
   * Tavast<span class="tei pb_edition">|87|</span>länningar.
   * This occurrence will not be marked with <mark> tags in a search for
   * "Tavastlänningar". These kind of matches ARE found on the elastic-
   * search page. However, the regex does take care of self-closing tags
   * in the match string, for instance <img/>.
   */
  insertSearchMatchTags(text: string, matches: string[] | undefined) {
    if (matches instanceof Array && matches.length > 0) {
      matches.forEach((val) => {
        if (val) {
          // Replace spaces in the match string with a regex and also insert a regex between each
          // character in the match string. This way html tags inside the match string can be
          // ignored when searching for the match string in the text.
          let c_val = '';
          for (let i = 0; i < val.length; i++) {
            const char = val.charAt(i);
            if (char === ' ') {
              c_val = c_val + '(?:\\s*<[^>]+>\\s*)*\\s+(?:\\s*<[^>]+>\\s*)*';
            } else if (i < val.length - 1) {
              c_val = c_val + char + '(?:<[^>]+>)*';
            } else {
              c_val = c_val + char;
            }
          }
          const re = new RegExp('(?<=^|\\P{L})(' + c_val + ')(?=\\P{L}|$)', 'gumi');
          text = text.replace(re, '<mark>$1</mark>');
        }
      });
    }
    return text;
  }


  getSearchMatchesFromQueryParams(terms: string | string[]): string[] {
    const queryMatches: string[] = Array.isArray(terms)
      ? terms : [terms];
    let matches: string[] = [];

    if (queryMatches.length && queryMatches[0]) {
      queryMatches.forEach((term: any) => {
        // Remove line break characters
        let decoded_match = term.replace(/\n/gm, '');
        // Encode selected character entities in match (also sanitizes the
        // match since it’s parsed as html, only text nodes are retained
        // and the `<`, `>` characters are converted to their corresponding
        // HTML entities).
        decoded_match = this.encodeSelectedCharEntities(decoded_match);
        matches.push(decoded_match);
      });
    }
    return matches;
  }


  getMappedMediaCollectionURL(collectionID: string): string {
    const galleryId = this.mediaCollectionMappings?.[collectionID];
    return galleryId ? `${this.apiURL}/gallery/get/${galleryId}/` : '';
  }


  /**
   * Returns the text with all occurrences of a selected set of characters
   * replaced with their corresponding character entity references.
   * The replaced characters are: & < > " ' ℔ ʄ
   * @param text string or html fragment as string to be encoded
   * @returns encoded text 
   */
  private encodeSelectedCharEntities(text: string): string {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&apos;',
      '℔': '&#x2114;',
      'ʄ': '&#x284;'
    };

    // First parse the text using SSR compatible htmlparser2 as html,
    // which will decode all entity references, otherwise & in
    // existing entity references will be replaced.
    let parsed_text = '';
    let isBody = false;
    const parser2 = new Parser({
      onopentagname(tag) {
        if (tag === 'body') {
          isBody = true;
        }
      },
      ontext(textContent) {
        if (isBody) {
          parsed_text += textContent;
        }
      },
      onclosetag(tag) {
        if (tag === 'body') {
          isBody = false;
        }
      }
    });
    parser2.write('<!DOCTYPE html><html><body>' + text + '</body></html>');
    parser2.end();

    // Then encode the selected characters
    Object.entries(entities).forEach(([code, entity]) => {
      const re = new RegExp('[' + code + ']', 'gi');
      parsed_text = parsed_text.replace(re, entity);
    });

    return parsed_text;
  }


  private fixImageAssetsPaths(text: string): string {
    // Fix image paths if config option for this enabled
    if (this.replaceImageAssetsPaths) {
      return text.replace(/src="images\//g, 'src="assets/images/');
    } else {
      return text;
    }
  }


  /**
   * Parses an HTML string and extracts all heading elements (`<h1>` to `<h6>`),
   * returning them as a nested tree structure based on heading levels.
   *
   * For each heading, this method:
   * - Uses the heading's own `id` attribute if present and non-empty.
   * - If no `id` is present, checks its immediate children for a `<span>` element
   *   with a non-empty `id` attribute and uses that instead.
   * - Normalizes the chosen ID by trimming whitespace and discarding empty strings.
   * - Extracts the heading's visible text (including content outside the `<span>`).
   *
   * The returned heading list is converted into a hierarchical tree where headings
   * of deeper levels are nested under the nearest preceding heading of a shallower level.
   *
   * This method is SSR-compatible and uses htmlparser2 for parsing.
   *
   * @param html - The HTML string to extract headings from.
   * @returns A nested array of `HeadingNode` objects representing the Table of
   *          Contents structure, where each node may contain child headings.
   *
   * Example:
   *   <h1 id="a">A</h1>
   *   <h2><span id="a-1">A.1</span> continues here</h2>
   *   <h2 id="a-2">A.2</h2>
   *
   *   Produces:
   *   [
   *     { id: "a", text: "A", level: 1, children: [
   *         { id: "a-1", text: "A.1 continues here", level: 2, children: [] },
   *         { id: "a-2", text: "A.2", level: 2, children: [] }
   *       ]
   *     }
   *   ]
   */
  getHeadingsFromHtml(html: string): HeadingNode[] {
    const handler = new DomHandler();
    new Parser(handler).end(html);

    const flat = findAll(
      n => isTag(n) && /^h[1-6]$/.test(n.name),
      handler.dom
    ).map(h => {
      const ownId = h.attribs?.id ?? null;

      // Only immediate children:
      const span = ownId
        ? null
        : findOne(
            (n): n is import('domhandler').Element =>
              isTag(n) && n.name === 'span' && !!getAttributeValue(n, 'id'),
            getChildren(h) ?? [],
            /* recurse */ false
          );

      const id = this.normalizeId(ownId ?? (span ? getAttributeValue(span, 'id') : null));

      return {
        id,
        text: this.getTextContent(h),
        level: parseInt(h.name.substring(1), 10),
        children: [] as HeadingNode[],
      };
    });

    return this.buildHeadingTree(flat);
  }


  /**
   * Recursively extracts and concatenates the plain text content from a
   * given HTML element and all of its child nodes.
   *
   * This method is used to retrieve the visible text content from heading
   * tags or other HTML elements parsed with htmlparser2. It skips
   * non-text nodes and decodes nested structures into a clean, trimmed
   * string.
   *
   * @param node A DOM node from htmlparser2 (usually of type 'tag').
   * @returns A string containing all the concatenated text content within
   *          the node.
   *
   * Example:
   *   Given a heading element like:
   *     <h2 id="example">Intro <span>Section</span></h2>
   *   The output will be:
   *     "Intro Section"
   */
  private getTextContent(node: any): string {
    if (!node.children) return '';
    return node.children.map((child: any) => {
      if (child.type === 'text') {
        return child.data;
      }
      if (child.type === 'tag' && !child.attribs?.id?.startsWith('md-footnote-ref')) {
        // Elements with @id with a value starting with 'md-footnote-ref' are suppressed
        // since they are footnote references.
        return this.getTextContent(child);
      }
      return '';
    }).join('').trim();
  }


  /**
   * Converts a flat array of headings into a nested tree structure based
   * on heading levels.
   *
   * Headings with a higher level are nested as children under the last
   * heading of a lower level. This method assumes the flat input array is
   * already sorted in document order.
   *
   * @param flat A flat array of HeadingNode objects (with `level`, `id`,
   *             `text`).
   * @returns A nested tree of HeadingNode objects, where children
   *          represent subheadings.
   *
   * Example:
   *   Input:
   *   [
   *     { level: 1, text: 'Intro', id: 'intro', children: [] },
   *     { level: 2, text: 'Details', id: 'details', children: [] },
   *     { level: 1, text: 'Conclusion', id: 'conclusion', children: [] }
   *   ]
   *
   *   Output:
   *   [
   *     { level: 1, text: 'Intro', id: 'intro', children: [
   *         { level: 2, text: 'Details', id: 'details', children: [] }
   *       ]
   *     },
   *     { level: 1, text: 'Conclusion', id: 'conclusion', children: [] }
   *   ]
   */
  private buildHeadingTree(flat: HeadingNode[]): HeadingNode[] {
    const root: HeadingNode[] = [];
    const stack: HeadingNode[] = [];

    for (const heading of flat) {
      const node: HeadingNode = { ...heading, children: [] };

      while (stack.length > 0 && heading.level <= stack[stack.length - 1].level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    }

    return root;
  }


  /**
   * Normalizes an ID string by trimming whitespace and ensuring it is non-empty.
   *
   * This method returns the given ID string with leading and trailing whitespace
   * removed. If the resulting string is empty, `null`, or `undefined`, it returns `null`
   * to indicate that the element effectively has no usable ID.
   *
   * @param s - The ID string to normalize, or `null`/`undefined` if absent.
   * @returns The trimmed ID string, or `null` if the input was empty or missing.
   *
   * Example:
   *   normalizeId("  heading-1  ") -> "heading-1"
   *   normalizeId("")              -> null
   *   normalizeId(undefined)       -> null
   */
  private normalizeId(s: string | null | undefined): string | null {
    return s && s.trim() ? s : null;
  }

}
