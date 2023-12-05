import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { config } from '@config';


@Injectable({
  providedIn: 'root',
})
export class CollectionContentService {
  activeCollectionTextMobileModeView: number | undefined = undefined;
  previousReadViewTextId: string = '';
  readViewTextId: string = '';
  recentCollectionTextViews: any[] = [];

  private apiURL: string = '';

  constructor(
    private http: HttpClient
  ) {
    const apiBaseURL = config.app?.backendBaseURL ?? '';
    const projectName = config.app?.projectNameDB ?? '';
    this.apiURL = apiBaseURL + '/' + projectName;
  }

  getTitle(id: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/text/${id}/1/tit/${language}`;
    return this.http.get(endpoint);
  }

  getForeword(id: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/text/${id}/fore/${language}`;
    return this.http.get(endpoint);
  }

  getIntroduction(id: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/text/${id}/1/inl/${language}`;
    return this.http.get(endpoint);
  }

  getReadingText(id: string, language: string = ''): Observable<any> {
    const estFolder = language ? 'est-i18n' : 'est';
    const idParts = id.split(';')[0].split('_');
    const ch_id = idParts.length > 2 ? '/' + idParts[2] : '';
    language = language ? '/' + language : '';
    const endpoint = `${this.apiURL}/text/`
          + `${idParts[0]}/${idParts[1]}/${estFolder}${ch_id}${language}`;
    return this.http.get(endpoint);
  }

  getManuscripts(id: string, ms_id?: number | string): Observable<any> {
    const idParts = id.split(';')[0].split('_');
    const ch_id = idParts.length > 2 ? '/' + idParts[2] : '';
    ms_id = ms_id ? '/' + ms_id : '';
    const endpoint = `${this.apiURL}/text/${idParts[0]}/${idParts[1]}/ms${ms_id}${ch_id}`;
    return this.http.get(endpoint);
  }

  getManuscriptsList(id: string): Observable<any> {
    const idParts = id.split(';')[0].split('_');
    const endpoint = `${this.apiURL}/text/${idParts[0]}/${idParts[1]}/list/ms`;
    return this.http.get(endpoint);
  }

  getVariants(id: string): Observable<any> {
    const idParts = id.split(';')[0].split('_');
    const ch_id = idParts.length > 2 ? '/' + idParts[2] : '';
    const endpoint = `${this.apiURL}/text/${idParts[0]}/${idParts[1]}/var${ch_id}`;
    return this.http.get(endpoint);
  }

  getFacsimiles(id: string): Observable<any> {
    const idParts = id.split(';')[0].split('_');
    const ch_id = idParts.length > 2 ? '/' + idParts[2].replace('ch', '') : '';
    const endpoint = `${this.apiURL}/facsimiles/${idParts[1]}${ch_id}`;
    return this.http.get(endpoint);
  }

  getMetadata(pub_id: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/publications/${pub_id}/metadata/${language}`;
    return this.http.get(endpoint);
  }

  getDownloadableIntroduction(id: string, format: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/text/downloadable/${format}/${id}/inl/${language}`;
    return this.http.get(endpoint);
  }

  getDownloadableReadingText(id: string, format: string, language: string = ''): Observable<any> {
    const estFolder = language ? 'est-i18n' : 'est';
    const idParts = id.split(';')[0].split('_');
    const ch_id = idParts.length > 2 ? '/' + idParts[2] : '';
    language = language ? '/' + language : '';
    const endpoint = `${this.apiURL}/text/downloadable/`
          + `${format}/${idParts[0]}/${idParts[1]}/${estFolder}${ch_id}${language}`;
    return this.http.get(endpoint);
  }

  getDownloadableManuscript(id: string, msID: number, format: string): Observable<any> {
    const idParts = id.split(';')[0].split('_');
    const ch_id = idParts.length > 2 ? '/' + idParts[2] : '';
    const endpoint = `${this.apiURL}/text/downloadable/`
          + `${format}/${idParts[0]}/${idParts[1]}/ms/${msID}${ch_id}`;
    return this.http.get(endpoint);
  }

}
