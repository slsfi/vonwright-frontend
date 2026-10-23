import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { config } from '@config';
import { collectionCovers } from 'src/project/data/collection-covers';
import { CollectionCoverService } from './collection-cover.service';

const testCovers = {
  203: {
    sv: { imageURL: 'assets/images/cover-sv.jpg', imageAltText: 'Svenskt omslag' },
    fi: { imageURL: 'assets/images/cover-fi.jpg', imageAltText: 'Suomenkielinen kansikuva' }
  },
  204: {
    sv: { imageURL: 'assets/images/second.jpg', imageAltText: 'Andra omslaget' }
  }
};

describe('CollectionCoverService', () => {
  let originalCollections: typeof config.collections;
  let originalCovers: typeof collectionCovers;
  const endpoint = `${config.app.backendBaseURL}/${config.app.projectNameDB}/md/`;

  beforeEach(() => {
    originalCollections = config.collections;
    originalCovers = { 203: collectionCovers[203], 204: collectionCovers[204] };
    Object.assign(collectionCovers, testCovers);
    config.collections = { ...originalCollections, useStaticCoverData: false };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'sv' }
      ]
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    config.collections = originalCollections;
    Object.assign(collectionCovers, originalCovers);
  });

  it.each(['disabled', 'flag omitted', 'collections omitted'])(
    'uses backend Markdown when static data is %s',
    async setting => {
      if (setting === 'flag omitted') {
        delete config.collections.useStaticCoverData;
      } else if (setting === 'collections omitted') {
        delete config.collections;
      }

      const result = firstValueFrom(TestBed.inject(CollectionCoverService).getCoverData(203));
      TestBed.inject(HttpTestingController).expectOne(`${endpoint}sv-08-203`).flush({
        content: '![First cover](assets/first.jpg)\n![Second cover](assets/second.jpg)'
      });

      expect(await result).toEqual({ imageURL: 'assets/first.jpg', imageAltText: 'First cover' });
    }
  );

  it('uses the active locale in the backend node ID', async () => {
    TestBed.overrideProvider(LOCALE_ID, { useValue: 'fi' });
    const result = firstValueFrom(TestBed.inject(CollectionCoverService).getCoverData('203'));
    TestBed.inject(HttpTestingController).expectOne(`${endpoint}fi-08-203`).flush({
      content: '![Kansikuva](assets/fi.jpg)'
    });

    expect(await result).toEqual({ imageURL: 'assets/fi.jpg', imageAltText: 'Kansikuva' });
  });

  it.each(['', 'No image', '![]()'])(
    'leaves missing backend fields to the consuming view: %j',
    async content => {
      const result = firstValueFrom(TestBed.inject(CollectionCoverService).getCoverData(203));
      TestBed.inject(HttpTestingController).expectOne(`${endpoint}sv-08-203`).flush({ content });

      expect(await result).toEqual({ imageURL: undefined, imageAltText: undefined });
    }
  );

  it('leaves backend errors to the consuming view', async () => {
    const result = firstValueFrom(TestBed.inject(CollectionCoverService).getCoverData(203));
    const assertion = expect(result).rejects.toMatchObject({ status: 503 });
    TestBed.inject(HttpTestingController).expectOne(`${endpoint}sv-08-203`).flush(
      'Unavailable', { status: 503, statusText: 'Service Unavailable' }
    );
    await assertion;
  });

  it.each([
    { locale: 'sv', imageURL: 'assets/images/cover-sv.jpg', imageAltText: 'Svenskt omslag' },
    { locale: 'fi', imageURL: 'assets/images/cover-fi.jpg', imageAltText: 'Suomenkielinen kansikuva' }
  ])('resolves both static fields for $locale without HTTP requests', async cover => {
    config.collections.useStaticCoverData = true;
    TestBed.overrideProvider(LOCALE_ID, { useValue: cover.locale });
    const service = TestBed.inject(CollectionCoverService);

    for (const id of [203, '203']) {
      expect(await firstValueFrom(service.getCoverData(id))).toEqual({
        imageURL: cover.imageURL, imageAltText: cover.imageAltText
      });
    }
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it.each([
    { id: 999, locale: 'sv' },
    { id: 204, locale: 'fi' },
    { id: 203, locale: 'en' }
  ])('uses a local placeholder for missing static data: $id/$locale', async ({ id, locale }) => {
    config.collections.useStaticCoverData = true;
    TestBed.overrideProvider(LOCALE_ID, { useValue: locale });

    expect(await firstValueFrom(TestBed.inject(CollectionCoverService).getCoverData(id))).toEqual({
      imageURL: 'assets/images/collection-cover-placeholder.jpg',
      imageAltText: 'Collection cover image'
    });
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });
});
