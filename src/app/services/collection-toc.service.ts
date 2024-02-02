import { Inject, Injectable, LOCALE_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, catchError, map, Observable, of } from 'rxjs';

import { config } from '@config';


@Injectable({
  providedIn: 'root',
})
export class CollectionTableOfContentsService {
  private activeTocOrder: BehaviorSubject<string> = new BehaviorSubject('default');
  private apiURL: string = '';
  private cachedTableOfContents: any = {};
  private multilingualTOC: boolean = false;

  constructor(
    private http: HttpClient,
    @Inject(LOCALE_ID) private activeLocale: string
  ) {
    const apiBaseURL = config.app?.backendBaseURL ?? '';
    const projectName = config.app?.projectNameDB ?? '';
    this.apiURL = apiBaseURL + '/' + projectName;
    this.multilingualTOC = config.app?.i18n?.multilingualCollectionTableOfContents ?? false;
  }

  getTableOfContents(id: string): Observable<any> {
    if (this.cachedTableOfContents?.collectionId === id) {
      return of(this.cachedTableOfContents);
    } else {
      const locale = this.multilingualTOC ? '/' + this.activeLocale : '';
      const endpoint = `${this.apiURL}/toc/${id}${locale}`;

      return this.http.get(endpoint).pipe(
        map((res: any) => {
          this.cachedTableOfContents = res;
          return res;
        }),
        catchError(this.handleError)
      );
    }
  }

  /**
   * Get first TOC item which has 'itemId' property and 'type' property
   * has value other than 'subtitle' and 'section_title'.
   * @param collectionID 
   * @param language optional
   */
  getFirstItem(collectionID: string, language?: string): Observable<any> {
    language = language && this.multilingualTOC ? '/' + language : '';
    const endpoint = `${this.apiURL}/toc-first/${collectionID}${language}`;
    return this.http.get(endpoint);
  }

  setActiveTocOrder(newTocOrder: string) {
    this.activeTocOrder.next(newTocOrder);
  }

  getActiveTocOrder(): Observable<string> {
    return this.activeTocOrder.asObservable();
  }

  getStaticTableOfContents(id: string): Observable<string> {
    const headers = new HttpHeaders({
      'Content-Type': 'text/html; charset=UTF-8'
    });
    const endpoint = `/static-html/collection-toc/${id}_${this.activeLocale}.htm`;

    return this.http.get(endpoint, {headers, responseType: 'text'}).pipe(
      catchError((error) => {
        console.log('Error loading static html', error);
        return of('');
      })
    );
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
