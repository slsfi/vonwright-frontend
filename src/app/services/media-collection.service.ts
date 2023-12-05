import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { config } from '@config';
import { convertNamedEntityTypeForBackend } from '@utility-functions';


@Injectable({
  providedIn: 'root',
})
export class MediaCollectionService {
  private apiURL: string = '';

  constructor(
    private http: HttpClient
  ) {
    const apiBaseURL = config.app?.backendBaseURL ?? '';
    const projectName = config.app?.projectNameDB ?? '';
    this.apiURL = apiBaseURL + '/' + projectName;
  }

  getMediaCollections(language: string): Observable<any> {
    const endpoint = `${this.apiURL}/gallery/data/${language}`;
    return this.http.get(endpoint);
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
