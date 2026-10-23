import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { config } from '@config';
import { CollectionsService } from '@services/collections.service';
import { collectionCovers } from 'src/project/data/collection-covers';
import { ContentGridComponent } from './content-grid.component';

const testCovers = {
  203: {
    sv: { imageURL: 'assets/images/first-sv.jpg', imageAltText: 'Första omslaget' },
    fi: { imageURL: 'assets/images/first-fi.jpg', imageAltText: 'Ensimmäinen kansikuva' }
  },
  204: {
    sv: { imageURL: 'assets/images/second-sv.jpg', imageAltText: 'Andra omslaget' },
    fi: { imageURL: 'assets/images/second-fi.jpg', imageAltText: 'Toinen kansikuva' }
  }
};

describe('ContentGridComponent collection covers', () => {
  let originalCollections: typeof config.collections;
  let originalComponent: typeof config.component;
  let originalCovers: typeof collectionCovers;
  const getCollections = vi.fn();
  const endpoint = `${config.app.backendBaseURL}/${config.app.projectNameDB}/md/`;

  beforeEach(async () => {
    originalCollections = config.collections;
    originalComponent = config.component;
    originalCovers = { 203: collectionCovers[203], 204: collectionCovers[204] };
    Object.assign(collectionCovers, testCovers);
    config.collections = { ...originalCollections, order: [[204, 203]], useStaticCoverData: false };
    config.component = {
      ...originalComponent,
      contentGrid: { includeArticles: false, includeEbooks: false, includeMediaCollection: false }
    };
    getCollections.mockReset().mockReturnValue(of([
      { id: 203, title: 'First collection' },
      { id: 999, title: 'Excluded collection' },
      { id: 204, title: 'Second collection' }
    ]));

    await TestBed.configureTestingModule({
      imports: [ContentGridComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: CollectionsService, useValue: { getCollections } }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    config.collections = originalCollections;
    config.component = originalComponent;
    Object.assign(collectionCovers, originalCovers);
  });

  it('retains backend loading, configured order, filtering, and thumbnails when the flag is omitted', async () => {
    delete config.collections.useStaticCoverData;
    const fixture = TestBed.createComponent(ContentGridComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectNone(`${endpoint}sv-08-999`);
    http.expectOne(`${endpoint}sv-08-204`).flush({ content: '![Second](assets/second.jpg)' });
    http.expectOne(`${endpoint}sv-08-203`).flush({ content: '![First](assets/first.jpg)' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.contentItems()?.map(item => item.id)).toEqual([204, 203]);
    const images: HTMLImageElement[] = Array.from(fixture.nativeElement.querySelectorAll('img'));
    expect(images.map(image => image.getAttribute('src'))).toEqual([
      'assets/second_thumb.jpg', 'assets/first_thumb.jpg'
    ]);
    expect(images.map(image => image.alt)).toEqual(['Second', 'First']);
  });

  it.each(['sv', 'fi'])('renders localized static thumbnails for %s without cover requests', async locale => {
    config.collections.useStaticCoverData = true;
    TestBed.overrideProvider(LOCALE_ID, { useValue: locale });
    const fixture = TestBed.createComponent(ContentGridComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getCollections).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.contentItems()?.map(item => item.id)).toEqual([204, 203]);
    const images: HTMLImageElement[] = Array.from(fixture.nativeElement.querySelectorAll('img'));
    expect(images.map(image => image.getAttribute('src'))).toEqual([
      `assets/images/second-${locale}_thumb.jpg`, `assets/images/first-${locale}_thumb.jpg`
    ]);
    expect(images.map(image => image.alt)).toEqual(locale === 'sv'
      ? ['Andra omslaget', 'Första omslaget']
      : ['Toinen kansikuva', 'Ensimmäinen kansikuva']);
    // Thumbnail conversion must not modify the imported full-size data.
    expect(collectionCovers[203]?.[locale]?.imageURL).toBe(`assets/images/first-${locale}.jpg`);
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('uses the placeholder thumbnail for a missing static collection without a backend fallback', async () => {
    config.collections = { ...config.collections, order: [[999]], useStaticCoverData: true };
    const fixture = TestBed.createComponent(ContentGridComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const image: HTMLImageElement = fixture.nativeElement.querySelector('img');
    expect(image.getAttribute('src')).toBe('assets/images/collection-cover-placeholder_thumb.jpg');
    expect(image.alt).toBe('Collection cover image');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('retains the backend error placeholder and title fallback for Markdown without an image', () => {
    const fixture = TestBed.createComponent(ContentGridComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${endpoint}sv-08-204`).flush('Unavailable', {
      status: 503, statusText: 'Service Unavailable'
    });
    http.expectOne(`${endpoint}sv-08-203`).flush({ content: 'No cover image' });

    expect(fixture.componentInstance.contentItems()).toEqual([
      expect.objectContaining({
        id: 204, imageURL: 'assets/images/collection-cover-placeholder_thumb.jpg', imageAltText: 'Collection cover image'
      }),
      expect.objectContaining({ id: 203, imageURL: undefined, imageAltText: 'First collection' })
    ]);
  });
});
