import { Injectable, LOCALE_ID, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UrlSegment } from '@angular/router';
import { Observable, catchError, of, switchMap } from 'rxjs';

import { config } from '@config';
import { ReferenceData, ReferenceDataApiResponse, toReferenceData } from '@models/metadata.models';


@Injectable({
  providedIn: 'root',
})
export class ReferenceDataService {
  private http = inject(HttpClient);
  private activeLocale = inject(LOCALE_ID);

  private readonly urnResolverUrl: string = config.modal?.referenceData?.URNResolverURL ?? 'https://urn.fi/';

  getReferenceData(urlSegments: UrlSegment[]): Observable<ReferenceData | null> {
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
      switchMap((resp: any) => {
        let data: ReferenceData | null = null;

        if (resp && Array.isArray(resp) && resp.length > 0) {
          if (resp.length > 1) {
            for (let i = 0; i < resp.length; i++) {
              if (resp[i]['deleted'] === 0) {
                data = toReferenceData(resp[i] as ReferenceDataApiResponse);
                break;
              }
            }
          } else {
            data = toReferenceData(resp[0] as ReferenceDataApiResponse);
          }
        } else if (
          !resp?.urn &&
          !resp?.reference_text &&
          !resp?.intro_reference_text
        ) {
          data = null;
        } else {
          data = toReferenceData(resp as ReferenceDataApiResponse);
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
