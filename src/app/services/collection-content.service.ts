import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { config } from '@config';
import { TextKey } from '@models/collection.models';
import { FacsimileApi } from '@models/facsimile.models';
import { Manuscript, ManuscriptsApiResponse, toManuscript } from '@models/manuscript.models';
import { PublicationMetadata, PublicationMetadataApiResponse, toPublicationMetadata } from '@models/metadata.models'
import { ReadingText, ReadingTextApiResponse, toReadingText } from '@models/readingtext.models';
import { toVariant, Variant, VariantsApiResponse } from '@models/variant.models';


@Injectable({
  providedIn: 'root',
})
export class CollectionContentService {
  private http = inject(HttpClient);

  private readonly apiURL: string = `${config.app?.backendBaseURL ?? ''}/${config.app?.projectNameDB ?? ''}`;

  activeCollectionTextMobileModeView: number | undefined = undefined;
  previousReadViewTextId: string = '';
  readViewTextId: string = '';
  recentCollectionTextViews: any[] = [];

  getTitle(collectionId: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/text/${collectionId}/1/tit/${language}`;
    return this.http.get(endpoint);
  }

  getForeword(collectionId: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/text/${collectionId}/fore/${language}`;
    return this.http.get(endpoint);
  }

  getIntroduction(collectionId: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/text/${collectionId}/1/inl/${language}`;
    return this.http.get(endpoint);
  }

  getReadingText(textKey: TextKey, language: string = ''): Observable<ReadingText> {
    const estFolder = language ? 'est-i18n' : 'est';
    const chId = textKey.chapterID ? `/${textKey.chapterID}` : '';
    const lang = language ? `/${language}` : '';
    const endpoint = `${this.apiURL}/text/`
          + `${textKey.collectionID}/${textKey.publicationID}/${estFolder}${chId}${lang}`;
    return this.http.get<ReadingTextApiResponse>(endpoint).pipe(
      map(toReadingText)
    );
  }

  getManuscripts(textKey: TextKey, msId?: number | string): Observable<Manuscript[]> {
    const chId = textKey.chapterID ? `/${textKey.chapterID}` : '';
    msId = msId ? `/${msId}` : (chId ? '' : '/');
    const endpoint = `${this.apiURL}/text/${textKey.collectionID}/${textKey.publicationID}/ms${msId}${chId}`;

    return this.http.get<ManuscriptsApiResponse>(endpoint).pipe(
      map((res: ManuscriptsApiResponse) => (res.manuscripts ?? [])
        .filter(m => !!m.manuscript_changes)  // filter out manuscripts with empty manuscript_changes
        .map(toManuscript)
      )
    );
  }

  getManuscriptsList(textKey: TextKey): Observable<any> {
    const endpoint = `${this.apiURL}/text/${textKey.collectionID}/${textKey.publicationID}/list/ms`;
    return this.http.get(endpoint);
  }

  getVariants(textKey: TextKey): Observable<Variant[]> {
    const chId = textKey.chapterID ? `/${textKey.chapterID}` : '/';
    const endpoint = `${this.apiURL}/text/${textKey.collectionID}/${textKey.publicationID}/var${chId}`;

    return this.http.get<VariantsApiResponse>(endpoint).pipe(
      map((res: VariantsApiResponse) => (res.variations ?? [])
        .map(toVariant)
      )
    );
  }

  getFacsimiles(textKey: TextKey): Observable<FacsimileApi[]> {
    const chId = textKey.chapterID ? `/${textKey.chapterID.replace('ch', '')}` : '';
    const endpoint = `${this.apiURL}/facsimiles/${textKey.publicationID}${chId}`;
    return this.http.get<FacsimileApi[]>(endpoint);
  }

  getMetadata(publicationId: string, language: string): Observable<PublicationMetadata> {
    const endpoint = `${this.apiURL}/publications/${publicationId}/metadata/${language}`;
    return this.http.get<PublicationMetadataApiResponse>(endpoint).pipe(
      map(toPublicationMetadata)
    );
  }

  getDownloadableIntroduction(collectionId: string, format: string, language: string): Observable<any> {
    const endpoint = `${this.apiURL}/text/downloadable/${format}/${collectionId}/inl/${language}`;
    return this.http.get(endpoint);
  }

  getDownloadableReadingText(textKey: TextKey, format: string, language: string = ''): Observable<any> {
    const estFolder = language ? 'est-i18n' : 'est';
    const ch_id = textKey.chapterID ? `/${textKey.chapterID}` : '';
    const lang = language ? `/${language}` : '';
    const endpoint = `${this.apiURL}/text/downloadable/`
          + `${format}/${textKey.collectionID}/${textKey.publicationID}/${estFolder}${ch_id}${lang}`;
    return this.http.get(endpoint);
  }

  getDownloadableManuscript(textKey: TextKey, msID: number, format: string): Observable<any> {
    const ch_id = textKey.chapterID ? `/${textKey.chapterID}` : '';
    const endpoint = `${this.apiURL}/text/downloadable/`
          + `${format}/${textKey.collectionID}/${textKey.publicationID}/ms/${msID}${ch_id}`;
    return this.http.get(endpoint);
  }

}
