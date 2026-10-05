import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { DocumentHeadService } from '@services/document-head.service';
import { PlatformService } from '@services/platform.service';
import { TextChangerComponent } from './text-changer.component';

describe('TextChangerComponent', () => {
  let paramMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let toc: BehaviorSubject<any>;

  beforeEach(async () => {
    paramMap = new BehaviorSubject(convertToParamMap({
      collectionID: '203',
      publicationID: '1',
      chapterID: '1'
    }));
    queryParamMap = new BehaviorSubject(convertToParamMap({}));
    toc = new BehaviorSubject<any>(null);

    await TestBed.configureTestingModule({
      imports: [TextChangerComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMap.asObservable(),
            queryParamMap: queryParamMap.asObservable()
          }
        },
        {
          provide: CollectionTableOfContentsService,
          useValue: { getCurrentFlattenedCollectionToc: () => toc.asObservable() }
        },
        {
          provide: DocumentHeadService,
          useValue: { setTitle: jasmine.createSpy('setTitle') }
        },
        { provide: PlatformService, useValue: { isMobile: () => false } }
      ]
    })
      .overrideComponent(TextChangerComponent, {
        set: { template: '<span>{{ navItems().current?.text }}</span>' }
      })
      .compileComponents();
  });

  it('applies the latest route state when a cached Ionic page becomes active again', async () => {
    const fixture = TestBed.createComponent(TextChangerComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('parentPageType', 'text');
    fixture.componentRef.setInput('ionViewActive', true);

    toc.next({
      collectionId: 203,
      order: 'default',
      text: 'Collection',
      children: [
        { itemId: '203_1_1', text: 'Chapter' },
        { itemId: '203_1_1;motif', text: 'Motif' }
      ]
    });
    await fixture.whenStable();
    expect(component.navItems().current?.text).toBe('Chapter');

    fixture.componentRef.setInput('ionViewActive', false);
    await fixture.whenStable();
    queryParamMap.next(convertToParamMap({ position: 'motif' }));
    await fixture.whenStable();
    expect(component.navItems().current?.text).toBe('Chapter');

    fixture.componentRef.setInput('ionViewActive', true);
    await fixture.whenStable();
    expect(component.navItems().current?.text).toBe('Motif');
  });
});
