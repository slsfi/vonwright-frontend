import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';

import { config } from '@config';
import { Collection, CollectionApiResponse, toCollection } from '@models/collection.models';


@Injectable({
  providedIn: 'root',
})
export class CollectionsService {
  private http = inject(HttpClient);
  private activeLocale = inject(LOCALE_ID);

  private readonly apiURL: string = `${config.app?.backendBaseURL ?? ''}/${config.app?.projectNameDB ?? ''}`;
  private readonly multilingualTOC: boolean = config.app?.i18n?.multilingualCollectionTableOfContents ?? false;

  getCollections(): Observable<Collection[]> {
    const locale = this.multilingualTOC ? '/' + this.activeLocale : '';
    const endpoint = `${this.apiURL}/collections${locale}`;
    return this.http.get<CollectionApiResponse[]>(endpoint).pipe(
      map((res: CollectionApiResponse[]) => {
        return res.map(toCollection)
      })
    );
  }

  getCollection(id: string): Observable<any> {
    const locale = this.multilingualTOC ? '/i18n/' + this.activeLocale : '';
    const endpoint = `${this.apiURL}/collection/${id}${locale}`;
    return this.http.get(endpoint);
  }

  /**
   * Get metadata of first non-deleted publication with given id.
   * @param id publication id
   * @returns object or null
   */
  getPublication(id: string): Observable<any> {
    const endpoint = `${this.apiURL}/publication/${id}`;
    return this.http.get(endpoint).pipe(
      map((res: any) => {
        let pub: any = null;
        if (res?.length) {
          for (let p = 0; p < res.length; p++) {
            if (res[p].deleted < 1) {
              pub = res[p];
              break;
            }
          }
        }
        return pub;
      })
    );
  }

  getLegacyIdByCollectionId(id: string): Observable<any> {
    const endpoint = `${this.apiURL}/legacy/collection/${id}`;
    return this.http.get(endpoint);
  }

  getLegacyIdByPublicationId(id: string): Observable<any> {
    const endpoint = `${this.apiURL}/legacy/publication/${id}`;
    return this.http.get(endpoint);
  }

  getCollectionAndPublicationByLegacyId(legacyId: string): Observable<any> {
    if (config.collections?.enableLegacyIDs) {
      const endpoint = `${this.apiURL}/legacy/${legacyId}`;
      return this.http.get(endpoint);
    } else {
      return of([
        {
          coll_id: Number(legacyId.split('_')[0]),
          pub_id: Number(legacyId.split('_')[1])
        }
      ]);
    }
  }

}
