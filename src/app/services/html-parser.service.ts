import { Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { Parser } from 'htmlparser2';
import { DomHandler } from 'domhandler';
import { existsOne, findAll, getAttributeValue } from 'domutils';
import { render } from 'dom-serializer';

import { config } from '@config';
import { CollectionContentService } from '@services/collection-content.service';


@Injectable({
  providedIn: 'root',
})
export class HtmlParserService {
  private apiURL: string = '';
  private mediaCollectionMappings: any = {};

  constructor(
    private collectionContentService: CollectionContentService
  ) {
    const apiBaseURL = config.app?.backendBaseURL ?? '';
    const projectName = config.app?.projectNameDB ?? '';
    this.apiURL = apiBaseURL + '/' + projectName;
    this.mediaCollectionMappings = config.collections?.mediaCollectionMappings ?? {};
  }

  postprocessReadingText(text: string, collectionId: string) {
    text = text.trim();
    // Fix image paths
    text = text.replace(/src="images\//g, 'src="assets/images/');
    // Map illustration image paths to backend media paths
    text = this.mapIllustrationImagePaths(text, collectionId);
    // Add "tei" class to all classlists
    text = text.replace(
      /class="([a-z A-Z _ 0-9]{1,140})"/g,
      'class="tei $1"'
    );
    return text;
  }

  postprocessManuscriptText(text: string) {
    text = text.trim();
    // Fix image paths
    text = text.replace(/src="images\//g, 'src="assets/images/');
    // Add "tei" and "teiManuscript" to all classlists
    text = text.replace(
      /class=\"([a-z A-Z _ 0-9]{1,140})\"/g,
      'class=\"teiManuscript tei $1\"'
    );
    return text;
  }

  getReadingTextIllustrations(id: string): Observable<any> {
    return this.collectionContentService.getReadingText(id).pipe(
      map((res) => {
        const images: any[] = [];
        if (
          res &&
          res.content &&
          res.content !== '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>File not found</body></html>'
        ) {
          const _apiURL = this.apiURL;
          const collectionID = String(id).split('_')[0];
          let text = res.content as string;
          text = this.postprocessReadingText(text, collectionID);

          const galleryId = this.mediaCollectionMappings?.[collectionID];

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
                  const image = { src: attributes.src, class: illustrationClass };
                  images.push(image);
                } else if (
                  attributes.class?.includes('doodle') &&
                  attributes['data-id'] &&
                  galleryId
                ) {
                  const image = {
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

}
