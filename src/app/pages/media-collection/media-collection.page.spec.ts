import type { MockedObject } from 'vitest';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { BehaviorSubject, of, Subject } from 'rxjs';

import { DocumentHeadService } from '@services/document-head.service';
import { FacsimileImageService, ResolvedFacsimileImageSrc } from '@services/facsimile-image.service';
import { MarkdownService } from '@services/markdown.service';
import { MediaCollectionService } from '@services/media-collection.service';
import { UrlService } from '@services/url.service';
import { MediaCollectionPage } from './media-collection.page';

describe('MediaCollectionPage', () => {
  let params$: BehaviorSubject<Params>;
  let queryParams$: BehaviorSubject<Params>;
  let facsimileImageService: MockedObject<Pick<FacsimileImageService, 'resolveImageSrc' | 'revokeObjectURL'>>;
  let markdownService: MockedObject<Pick<MarkdownService, 'getParsedMdContent'>>;
  let mediaCollectionService: MockedObject<Pick<
    MediaCollectionService,
    'getAllNamedEntityOccInMediaCollsByType'
    | 'getMediaCollections'
    | 'getNamedEntityOccInMediaColls'
    | 'getSingleMediaCollection'
  >>;
  let modalController: MockedObject<Pick<ModalController, 'create'>>;
  let router: MockedObject<Pick<Router, 'navigate'>>;
  let urlService: MockedObject<Pick<UrlService, 'parse' | 'stringify'>>;

  beforeEach(async () => {
    params$ = new BehaviorSubject<Params>({});
    queryParams$ = new BehaviorSubject<Params>({});
    facsimileImageService = {
      resolveImageSrc: vi.fn().mockName('FacsimileImageService.resolveImageSrc'),
      revokeObjectURL: vi.fn().mockName('FacsimileImageService.revokeObjectURL')
    };
    facsimileImageService.resolveImageSrc.mockImplementation(
      (url: string | null) => of({ src: url ?? '', objectURL: null })
    );
    markdownService = {
      getParsedMdContent: vi.fn().mockName('MarkdownService.getParsedMdContent')
    };
    markdownService.getParsedMdContent.mockImplementation(
      (fileId: string) => of(`<p>${fileId}</p>`)
    );
    mediaCollectionService = {
      getAllNamedEntityOccInMediaCollsByType: vi.fn().mockName('MediaCollectionService.getAllNamedEntityOccInMediaCollsByType'),
      getMediaCollections: vi.fn().mockName('MediaCollectionService.getMediaCollections'),
      getNamedEntityOccInMediaColls: vi.fn().mockName('MediaCollectionService.getNamedEntityOccInMediaColls'),
      getSingleMediaCollection: vi.fn().mockName('MediaCollectionService.getSingleMediaCollection')
    };
    mediaCollectionService.getAllNamedEntityOccInMediaCollsByType.mockReturnValue(of([]));
    mediaCollectionService.getMediaCollections.mockReturnValue(of([
      { id: 1, title: 'Portraits', description: 'Collection description', mediaCount: 2 }
    ]));
    mediaCollectionService.getSingleMediaCollection.mockReturnValue(of([]));
    mediaCollectionService.getNamedEntityOccInMediaColls.mockReturnValue(of([]));
    modalController = {
      create: vi.fn().mockName('ModalController.create')
    };
    router = {
      navigate: vi.fn().mockName('Router.navigate')
    };
    router.navigate.mockResolvedValue(true);
    urlService = {
      parse: vi.fn().mockName('UrlService.parse'),
      stringify: vi.fn().mockName('UrlService.stringify')
    };
    urlService.parse.mockReturnValue([]);
    urlService.stringify.mockReturnValue('encoded-filters');

    await TestBed.configureTestingModule({
      imports: [MediaCollectionPage],
      providers: [
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: ActivatedRoute, useValue: { params: params$, queryParams: queryParams$ } },
        {
          provide: DocumentHeadService,
          useValue: {
            setTitle: vi.fn().mockName('DocumentHeadService.setTitle')
          } satisfies MockedObject<Pick<DocumentHeadService, 'setTitle'>>
        },
        { provide: FacsimileImageService, useValue: facsimileImageService },
        { provide: MarkdownService, useValue: markdownService },
        { provide: MediaCollectionService, useValue: mediaCollectionService },
        { provide: ModalController, useValue: modalController },
        { provide: Router, useValue: router },
        { provide: UrlService, useValue: urlService }
      ]
    })
      .overrideTemplate(
        MediaCollectionPage,
        `
          @let galleryData = this.galleryData();
          @let resolvedURLs = this.galleryThumbResolvedURLsByID();
          @let loadingGallery = this.loadingGallery();
          @let loadingImageModal = this.loadingImageModal();
          @let mdContent = this.mdContent();
          @let title = this.mediaCollectionTitle();
          <span class="title">{{ title }}</span>
          <span class="loading-gallery">{{ loadingGallery }}</span>
          <span class="loading-modal">{{ loadingImageModal }}</span>
          <span class="markdown">{{ mdContent }}</span>
          <span class="gallery">{{ galleryData.length }}|{{ resolvedURLs[galleryData[0]?.id] }}</span>
        `
      )
      .compileComponents();
  });

  it('renders collection and thumbnail resolution updates without manual change detection', async () => {
    const collections$ = new Subject<any[]>();
    const resolvedImage$ = new Subject<ResolvedFacsimileImageSrc>();
    mediaCollectionService.getMediaCollections.mockReturnValue(collections$);
    facsimileImageService.resolveImageSrc.mockReturnValue(resolvedImage$);

    const fixture = TestBed.createComponent(MediaCollectionPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.loading-gallery').textContent).toContain('true');

    collections$.next([{ id: 1, title: 'Portraits', mediaCount: 2 }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.gallery').textContent).toContain('1|');
    expect(fixture.nativeElement.querySelector('.loading-gallery').textContent).toContain('false');

    resolvedImage$.next({ src: 'blob:resolved-thumbnail', objectURL: 'blob:resolved-thumbnail' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.gallery').textContent).toContain('blob:resolved-thumbnail');

    fixture.destroy();
    expect(facsimileImageService.revokeObjectURL).toHaveBeenCalledWith('blob:resolved-thumbnail');
  });

  it('applies query-parameter filters and updates filter URLs', async () => {
    mediaCollectionService.getAllNamedEntityOccInMediaCollsByType.mockImplementation(
      (type: string) => type === 'person'
        ? of([{ id: 7, name: 'Ada', media_collection_id: 1, filename: 'portrait.jpg' }])
        : of([])
    );
    urlService.parse.mockReturnValue([{ person: [7] }]);

    const fixture = TestBed.createComponent(MediaCollectionPage);
    fixture.detectChanges();
    queryParams$.next({ filters: 'person-filter' });
    await fixture.whenStable();

    expect(urlService.parse).toHaveBeenCalledWith('person-filter', true);
    expect(fixture.componentInstance.activePersonFilters()).toEqual([7]);
    expect(fixture.componentInstance.filterResultCount()).toBe(1);

    fixture.componentInstance.onFilterChanged('place', { detail: { value: [9] } });
    expect(urlService.stringify).toHaveBeenCalledWith(
      [{ person: [7] }, { place: [9] }],
      true
    );
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { filters: 'encoded-filters' },
      replaceUrl: true
    }));
  });

  it('derives Markdown content directly from the collection route', async () => {
    mediaCollectionService.getNamedEntityOccInMediaColls.mockReturnValue(of([{
      collection_id: 1,
      front: 'portrait.jpg',
      full_name: 'Ada Lovelace'
    }]));
    const fixture = TestBed.createComponent(MediaCollectionPage);
    fixture.detectChanges();

    expect(markdownService.getParsedMdContent).toHaveBeenCalledWith('sv-11-all');
    expect(fixture.nativeElement.querySelector('.markdown').textContent).toContain('sv-11-all');

    params$.next({ mediaCollectionID: '2' });
    await fixture.whenStable();
    expect(markdownService.getParsedMdContent).toHaveBeenCalledWith('sv-11-2');
    expect(fixture.nativeElement.querySelector('.markdown').textContent).toContain('sv-11-2');

    params$.next({ mediaCollectionID: 'entity' });
    queryParams$.next({ id: '7', type: 'person' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.markdown').textContent.trim()).toBe('');
  });

  it('keeps the image-modal loading state zoneless-safe', async () => {
    let dismissModal: (value: { role: string }) => void = () => undefined;
    const modal = {
      present: vi.fn().mockName('present'),
      onWillDismiss: vi.fn().mockName('onWillDismiss').mockReturnValue(new Promise<{
    role: string;
}>(resolve => dismissModal = resolve))
    };
    modalController.create.mockResolvedValue(modal as any);

    const fixture = TestBed.createComponent(MediaCollectionPage);
    fixture.detectChanges();
    const imageURL = fixture.componentInstance.galleryData()[0].imageURL;
    const openImage = fixture.componentInstance.openImage(imageURL);
    await Promise.resolve();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.loading-modal').textContent).toContain('true');

    dismissModal({ role: 'close' });
    await openImage;
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.loading-modal').textContent).toContain('false');
  });
});
