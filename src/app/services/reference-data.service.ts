import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UrlSegment } from '@angular/router';
import { Observable, catchError, of, switchMap } from 'rxjs';

import { config } from '@config';


@Injectable({
  providedIn: 'root',
})
export class ReferenceDataService {
  private http = inject(HttpClient);
  private activeLocale = inject(LOCALE_ID);

  private readonly urnResolverUrl: string = config.modal?.referenceData?.URNResolverURL ?? 'https://urn.fi/';

  getReferenceData(urlSegments: UrlSegment[]): Observable<any> {
    let url = '/';
    for (let i = 0; i < urlSegments?.length; i++) {
      const separator = i > 0 ? '/' : '';
      url += separator + urlSegments[i].path;
    }
    url = '/' + this.activeLocale + url;

    // We need to double encode the URL for the API
    url = encodeURI(encodeURIComponent(url));
    const endpoint = `${config.app.backendBaseURL}/${config.app.projectNameDB}/urn/${url}/`;

    return this.http.get(endpoint).pipe(
      switchMap((data: any) => {
        if (data && Array.isArray(data) && data.length > 0) {
          if (data.length > 1) {
            for (let i = 0; i < data.length; i++) {
              if (data[i]['deleted'] === 0) {
                data = data[i];
                break;
              }
            }
          } else {
            data = data[0];
          }
        } else if (
          !data?.urn &&
          !data?.reference_text &&
          !data?.intro_reference_text
        ) {
          data = null;
        }

        // Remove trailing comma from reference_text if present
        if (data?.reference_text?.slice(-2) === ', ') {
          data.reference_text = data.reference_text.slice(0, -2);
        } else if (data?.reference_text?.slice(-1) === ',') {
          data.reference_text = data.reference_text.slice(0, -1);
        }

        if (
          !data &&
          urlSegments?.[0]?.path === 'collection' &&
          urlSegments?.[2]?.path === 'text' &&
          urlSegments?.length > 4
        ) {
          // Try to get URN with stripped chapter id from URL
          urlSegments.pop();
          return this.getReferenceData(urlSegments);
        } else {
          return of(data);
        }
      }),
      catchError((e: any) => {
        console.error('error getting reference data', e);
        return of(null);
      })
    );
  }

  getUrnResolverUrl() {
    return this.urnResolverUrl;
  }

}
