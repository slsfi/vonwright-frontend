import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';

import { config } from '@config';
import { TextKey } from '@models/collection.models';
import { CommentsApiResponse } from '@models/comments.models';
import { CorrespondenceMetadata, CorrespondenceMetadataApiResponse, toCorrespondenceMetadata } from '@models/metadata.models';


@Injectable({
  providedIn: 'root',
})
export class CommentService {
  private http = inject(HttpClient);

  private readonly apiURL: string = `${config.app?.backendBaseURL ?? ''}/${config.app?.projectNameDB ?? ''}`;
  private readonly addTEIClassNames: boolean = config.collections?.addTEIClassNames ?? true;
  private readonly replaceImageAssetsPaths: boolean = config.collections?.replaceImageAssetsPaths ?? true;

  private cachedCollectionComments: Record<string, any> = {};

  /**
   * Returns an html fragment as a string observable of all comments for the specified text.
   * @param textItemID The full text id: <collectionID>_<publicationID>_<chapterID>.
   * <chapterID> is optional.
   * @returns Observable of string.
   */
  getComments(textKey: TextKey): Observable<string> {
    const textItemID = textKey.textItemID;

    if (this.cachedCollectionComments.hasOwnProperty(textItemID)) {
      // The comments for the text are cached
      return of(this.cachedCollectionComments[textItemID]);
    } else {
      const chId = textKey.chapterID ? `/${textKey.chapterID}/${textKey.chapterID}` : '';
      const endpoint = `${this.apiURL}/text/${textKey.collectionID}/${textKey.publicationID}/com${chId}`;

      return this.http.get<CommentsApiResponse>(endpoint).pipe(
        map((com: CommentsApiResponse) => {
          if (com?.content) {
            const html = this.postprocessCommentsText(com.content);
            this.clearCachedCollectionComments();
            this.cachedCollectionComments[textItemID] = html;
            return html;
          }
          return '';
        })
      );
    }
  }

  /**
   * Returns the html fragment of a single comment as a string observable.
   * @param textKey TextKey object with collectionId, publicationId and optional chapterId.
   * @param elementID Unique class name of the html element wrapping the comment.
   * @returns Observable of string.
   */
  getSingleComment(textKey: TextKey, elementID: string): Observable<string> {
    if (!elementID) {
      return of('');
    }

    const textItemID = textKey.textItemID;

    if (this.cachedCollectionComments.hasOwnProperty(textItemID)) {
      // The comments for the text are cached
      return of(
        this.extractSingleComment(
          elementID, this.cachedCollectionComments[textItemID]
        )
      );
    } else {
      // Comments not cached, get them from backend and then extract single comment
      return this.getComments(textKey).pipe(
        map((comments: string) => {
          return comments ? this.extractSingleComment(elementID, comments) : '';
        })
      );
    }
  }

  getCorrespondanceMetadata(publicationId: string): Observable<CorrespondenceMetadata | null> {
    const endpoint = `${this.apiURL}/correspondence/publication/metadata/${publicationId}`;
    return this.http.get<CorrespondenceMetadataApiResponse | []>(endpoint).pipe(
      map((response) => {
        if (Array.isArray(response)) {
          // Backend sent []
          return null;
        }
        // Transform the API response to CorrespondenceMetadata
        return toCorrespondenceMetadata(response);
      })
    );
  }

  getDownloadableComments(textKey: TextKey, format: string): Observable<any> {
    const chId = textKey.chapterID ? `/${textKey.chapterID}` : '';
    const endpoint = `${this.apiURL}/text/downloadable/${format}`
          + `/${textKey.collectionID}/${textKey.publicationID}/com${chId}`;
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

}
