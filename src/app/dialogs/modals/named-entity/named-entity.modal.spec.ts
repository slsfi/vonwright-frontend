import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { of, Subject, throwError } from 'rxjs';

import { config } from '@config';
import { NamedEntityDetails } from '@models/named-entity.models';
import { NamedEntityService } from '@services/named-entity.service';
import { TooltipService } from '@services/tooltip.service';
import { NamedEntityModal } from './named-entity.modal';

describe('NamedEntityModal', () => {
  let originalNamedEntityConfig: typeof config.modal.namedEntity;
  let details$: Subject<NamedEntityDetails>;
  let namedEntityService: MockedObject<Pick<
    NamedEntityService,
    'getEntity' | 'getEntityMediaData' | 'getEntityArticleData' | 'getEntityMediaCollectionOccurrences'
  >>;

  beforeEach(async () => {
    originalNamedEntityConfig = config.modal.namedEntity;
    config.modal.namedEntity = {
      ...originalNamedEntityConfig,
      showArticleData: true,
      showGalleryOccurrences: true,
      showMediaData: true,
      showOccurrences: false
    };
    details$ = new Subject<NamedEntityDetails>();
    namedEntityService = {
      getEntity: vi.fn().mockReturnValue(details$),
      getEntityMediaData: vi.fn().mockReturnValue(of({})),
      getEntityArticleData: vi.fn().mockReturnValue(of({})),
      getEntityMediaCollectionOccurrences: vi.fn().mockReturnValue(of({}))
    };

    await TestBed.configureTestingModule({
      imports: [NamedEntityModal],
      providers: [
        provideRouter([]),
        { provide: ModalController, useValue: {} },
        { provide: NamedEntityService, useValue: namedEntityService },
        {
          provide: TooltipService,
          useValue: { constructYearBornDeceasedString: () => '' }
        }
      ]
    }).compileComponents();
  });

  afterEach(() => {
    config.modal.namedEntity = originalNamedEntityConfig;
  });

  function createModal() {
    const fixture = TestBed.createComponent(NamedEntityModal);
    fixture.componentRef.setInput('id', '1');
    fixture.componentRef.setInput('type', 'person');
    fixture.detectChanges();
    return fixture;
  }

  it('shows loading and then the empty state when all requests fail or return no data', async () => {
    namedEntityService.getEntityMediaData.mockReturnValue(
      throwError(() => new Error('Media unavailable'))
    );
    const fixture = createModal();

    expect(fixture.nativeElement.querySelector('ion-spinner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sd-header')).toBeNull();

    details$.error(new Error('Details unavailable'));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('ion-spinner')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Ingen information hittades.');
  });

  it.each([
    { authorData: undefined, expectedAuthors: null },
    { authorData: [], expectedAuthors: null },
    { authorData: [{ full_name: 'Author name' }], expectedAuthors: 'Author name' }
  ])('renders partial metadata with author_data=$authorData', async ({ authorData, expectedAuthors }) => {
    const fixture = createModal();

    details$.next({ title: 'Entity title', author_data: authorData });
    details$.complete();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.title').textContent).toBe('Entity title');
    expect(fixture.nativeElement.querySelector('ion-spinner')).toBeNull();
    expect(fixture.nativeElement.querySelector('.media_image_wrapper')).toBeNull();
    expect(fixture.nativeElement.querySelector('.articles')).toBeNull();
    const authors = fixture.nativeElement.querySelector('.authors');
    if (expectedAuthors) {
      expect(authors.textContent).toContain(expectedAuthors);
    } else {
      expect(authors).toBeNull();
    }
  });

  it('renders media when details are unavailable', async () => {
    namedEntityService.getEntityMediaData.mockReturnValue(of({
      image_path: 'assets/entity.jpg',
      description: 'Entity image'
    }));
    const fixture = createModal();

    details$.error(new Error('Details unavailable'));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.media_image_wrapper img').getAttribute('src'))
      .toBe('assets/entity.jpg');
    expect(fixture.nativeElement.querySelector('.media_description').textContent).toContain('Entity image');
    expect(fixture.nativeElement.querySelector('.authors')).toBeNull();
    expect(fixture.componentInstance.loadingErrorData()).toBe(false);
  });
});
