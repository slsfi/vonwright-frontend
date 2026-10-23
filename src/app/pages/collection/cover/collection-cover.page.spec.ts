import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, LOCALE_ID, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { config } from '@config';
import { TextChangerComponent } from '@components/text-changer/text-changer.component';
import { PlatformService } from '@services/platform.service';
import { collectionCovers } from 'src/project/data/collection-covers';
import { CollectionCoverPage } from './collection-cover.page';

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

@Component({ selector: 'text-changer', template: '' })
class TextChangerStubComponent {
  parentPageType = input('');
  ionViewActive = input(true);
}

describe('CollectionCoverPage cover sources', () => {
  let originalCollections: typeof config.collections;
  let params$: BehaviorSubject<Params>;
  let originalCovers: typeof collectionCovers;
  const endpoint = `${config.app.backendBaseURL}/${config.app.projectNameDB}/md/`;

  beforeEach(async () => {
    originalCollections = config.collections;
    originalCovers = { 203: collectionCovers[203], 204: collectionCovers[204] };
    Object.assign(collectionCovers, testCovers);
    config.collections = { ...originalCollections, useStaticCoverData: true };
    params$ = new BehaviorSubject<Params>({ collectionID: '203' });
    await TestBed.configureTestingModule({
      imports: [CollectionCoverPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: ActivatedRoute, useValue: { params: params$ } },
        { provide: PlatformService, useValue: { isMobile: () => false } }
      ]
    }).overrideComponent(CollectionCoverPage, {
      remove: { imports: [TextChangerComponent] },
      add: { imports: [TextChangerStubComponent] }
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    config.collections = originalCollections;
    Object.assign(collectionCovers, originalCovers);
  });

  it.each(['sv', 'fi'])('renders the full-size static image and alt text for %s', async locale => {
    TestBed.overrideProvider(LOCALE_ID, { useValue: locale });
    const fixture = TestBed.createComponent(CollectionCoverPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const image: HTMLImageElement = fixture.nativeElement.querySelector('img.cover-image');
    expect(image.getAttribute('src')).toBe(`assets/images/first-${locale}.jpg`);
    expect(image.alt).toBe(locale === 'sv' ? 'Första omslaget' : 'Ensimmäinen kansikuva');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('updates static covers on route reuse and waits to apply inactive-page route changes', async () => {
    const fixture = TestBed.createComponent(CollectionCoverPage);
    fixture.detectChanges();
    await fixture.whenStable();
    const image = () => fixture.nativeElement.querySelector('img.cover-image') as HTMLImageElement;

    params$.next({ collectionID: '204' });
    await fixture.whenStable();
    expect(image().getAttribute('src')).toBe('assets/images/second-sv.jpg');
    expect(image().alt).toBe('Andra omslaget');

    fixture.componentInstance.ionViewWillLeave();
    await fixture.whenStable();
    params$.next({ collectionID: '203' });
    await fixture.whenStable();
    expect(image().getAttribute('src')).toBe('assets/images/second-sv.jpg');

    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();
    expect(image().getAttribute('src')).toBe('assets/images/first-sv.jpg');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it('renders a placeholder for missing static data without HTTP requests', async () => {
    params$.next({ collectionID: '999' });
    const fixture = TestBed.createComponent(CollectionCoverPage);
    fixture.detectChanges();
    await fixture.whenStable();

    const image: HTMLImageElement = fixture.nativeElement.querySelector('img.cover-image');
    expect(image.getAttribute('src')).toBe('assets/images/collection-cover-placeholder.jpg');
    expect(image.alt).toBe('Collection cover image');
    TestBed.inject(HttpTestingController).expectNone(() => true);
  });

  it.each([
    { fails: false, alt: 'Collection cover image' },
    { fails: true, alt: 'Cover image' }
  ])('retains the backend placeholder when Markdown is empty or fails: $fails', async ({ fails, alt }) => {
    delete config.collections.useStaticCoverData;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fixture = TestBed.createComponent(CollectionCoverPage);
    fixture.detectChanges();
    const request = TestBed.inject(HttpTestingController).expectOne(`${endpoint}sv-08-203`);
    if (fails) {
      request.flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    } else {
      request.flush({ content: '' });
    }
    await fixture.whenStable();

    const image: HTMLImageElement = fixture.nativeElement.querySelector('img.cover-image');
    expect(image.getAttribute('src')).toBe('assets/images/collection-cover-placeholder.jpg');
    expect(image.alt).toBe(alt);
    expect(error).toHaveBeenCalledTimes(fails ? 1 : 0);
  });
});
