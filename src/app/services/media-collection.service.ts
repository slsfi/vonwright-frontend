import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { config } from '@config';
import { MediaCollection, MediaCollectionApiResponse, toMediaCollection } from '@models/media-collection.models';
import { convertNamedEntityTypeForBackend } from '@utility-functions';


@Injectable({
  providedIn: 'root',
})
export class MediaCollectionService {
  private http = inject(HttpClient);

  private readonly apiURL: string = `${config.app?.backendBaseURL ?? ''}/${config.app?.projectNameDB ?? ''}`;

  getMediaCollections(language: string): Observable<MediaCollection[]> {
    const endpoint = `${this.apiURL}/gallery/data/${language}`;
    return this.http.get<MediaCollectionApiResponse[]>(endpoint).pipe(
      map((res: MediaCollectionApiResponse[]) => {
        return res.map(toMediaCollection)
      })
    );
  }

  getSingleMediaCollection(id: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/gallery/data/${id}/${language}`;
    return this.http.get(endpoint);
  }

  getNamedEntityOccInMediaColls(entityType: string, entityID: any): Observable<any> {
    entityType = convertNamedEntityTypeForBackend(entityType);
    const endpoint = `${this.apiURL}/gallery/${entityType}/connections/${entityID}`;
    return this.http.get(endpoint);
  }

  getAllNamedEntityOccInMediaCollsByType(entityType: string, mediaCollectionID?: string): Observable<any> {
    entityType = convertNamedEntityTypeForBackend(entityType);
    const endpoint = this.apiURL + '/gallery/connections/' + entityType
                + (mediaCollectionID ? '/' + mediaCollectionID : '');
    return this.http.get(endpoint);
  }

  getMediaMetadata(id: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/media/image/metadata/${id}/${language}`;
    return this.http.get(endpoint);
  }

}
