import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';

import { config } from '@config';


@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private addTEIClassNames: boolean = true;
  private apiURL: string = '';
  private cachedCollectionComments: Record<string, any> = {};
  private replaceImageAssetsPaths: boolean = true;

  constructor(
    private http: HttpClient
  ) {
    const apiBaseURL = config.app?.backendBaseURL ?? '';
    const projectName = config.app?.projectNameDB ?? '';
    this.apiURL = apiBaseURL + '/' + projectName;
    this.addTEIClassNames = config.collections?.addTEIClassNames ?? true;
    this.replaceImageAssetsPaths = config.collections?.replaceImageAssetsPaths ?? true;
  }

  /**
   * Returns an html fragment as a string observable of all comments for the specified text.
   * @param textItemID The full text id: <collectionID>_<publicationID>_<chapterID>.
   * <chapterID> is optional.
   * @returns Observable of string.
   */
  getComments(textItemID: string): Observable<any> {
    textItemID = textItemID.replace('_com', '').split(';')[0];

    if (this.cachedCollectionComments.hasOwnProperty(textItemID)) {
      // The comments for the text are cached
      return of(this.cachedCollectionComments[textItemID]);
    } else {
      const textIDParts = textItemID.split('_');
      const ch_id = textIDParts.length > 2
            ? '/' + textIDParts[2] + '/' + textIDParts[2]
            : '';
      const endpoint = `${this.apiURL}/text/${textIDParts[0]}/${textIDParts[1]}/com${ch_id}`;

      return this.http.get(endpoint).pipe(
        map((body: any) => {
          if (body?.content) {
            body = this.postprocessCommentsText(body.content);
            this.clearCachedCollectionComments();
            this.cachedCollectionComments[textItemID] = body;
          }
          return body || '';
        }),
        catchError(this.handleError)
      );
    }
  }

  /**
   * Returns the html fragment of a single comment as a string observable.
   * @param textItemID The full text id: <collectionID>_<publicationID>_<chapterID>.
   * <chapterID> is optional.
   * @param elementID Unique class name of the html element wrapping the comment.
   * @returns Observable of string.
   */
  getSingleComment(textItemID: string, elementID: string): Observable<any> {
    if (!elementID) {
      return of('');
    }

    if (this.cachedCollectionComments.hasOwnProperty(textItemID)) {
      // The comments for the text are cached
      return of(
        this.extractSingleComment(
          elementID, this.cachedCollectionComments[textItemID]
        )
      );
    } else {
      // Comments not cached, get them from backend and then extract single comment
      return this.getComments(textItemID).pipe(
        map((comments: string) => {
          return comments ? this.extractSingleComment(elementID, comments) : '';
        })
      );
    }
  }

  getCorrespondanceMetadata(pub_id: any): Observable<any> {
    const endpoint = `${this.apiURL}/correspondence/publication/metadata/${pub_id}`;
    return this.http.get(endpoint);
  }

  getDownloadableComments(textItemID: string, format: string): Observable<any> {
    const textIDParts = textItemID.replace('_com', '').split(';')[0].split('_');
    const ch_id = textIDParts.length > 2 ? '/' + textIDParts[2] : '';
    const endpoint = `${this.apiURL}/text/downloadable/${format}`
          + `/${textIDParts[0]}/${textIDParts[1]}/com${ch_id}`;
    return this.http.get(endpoint);
  }

  /**
   * Returns an html fragment as a string with the comment with class
   * name @param elementID from the set of all comments in @param comments.
   * @returns String.
   */
  private extractSingleComment(elementID: string, comments: string): string {
    // TODO: document.createRange() is safe here because this function is only
    // called in the browser, however, this could be refactored to use the
    // SSR compatible htmlparser2 instead.
    const htmlElement = document.createRange()
      .createContextualFragment(comments).querySelector('.' + elementID);
    if (htmlElement) {
      const htmlElementNext = htmlElement.nextElementSibling;
      const strippedBody = htmlElement.innerHTML;
      if (strippedBody?.length > 0) {
        return strippedBody || ' - no content - ';
      } else if (
        // TODO: not sure if this is needed, comments should never be in this format
        htmlElementNext?.nodeName === 'SPAN' &&
        htmlElementNext?.className.includes('tooltip')
      ) {
        return htmlElementNext.textContent || ' - no content - ';
      }
    }
    return ' - no content - ';
  }

  private postprocessCommentsText(text: string): string {
    // Fix image paths if config option for this enabled
    if (this.replaceImageAssetsPaths) {
      text = text.replace(/src="images\//g, 'src="assets/images/');
    }
    // Add "teiComment" to all classlists if config option for this enabled
    if (this.addTEIClassNames) {
      text = text.replace(
        /class=\"([a-z A-Z _ 0-9]{1,140})\"/g,
        'class=\"teiComment $1\"'
      );
    }
    
    // text = text.replace(/(teiComment teiComment )/g, 'teiComment ');
    // text = text.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    // text = text.replace(/&amp;/g, '&');

    return text;
  }

  private clearCachedCollectionComments() {
    for (const property in this.cachedCollectionComments) {
      if (this.cachedCollectionComments.hasOwnProperty(property)) {
        delete this.cachedCollectionComments[property];
      }
    }
  }

  private async handleError(error: Response | any) {
    let errMsg: string;
    if (error instanceof Response) {
      const body = (await error.json()) || '';
      const err = body.error || JSON.stringify(body);
      errMsg = `${error.status} - ${error.statusText || ''} ${err}`;
    } else {
      errMsg = error.message ? error.message : error.toString();
    }
    throw errMsg;
  }

}
