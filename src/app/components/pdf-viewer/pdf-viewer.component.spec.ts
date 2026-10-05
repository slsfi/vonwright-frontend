import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';

import { PdfViewerComponent } from './pdf-viewer.component';

describe('PdfViewerComponent', () => {
  let queryParamMap: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    queryParamMap = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [PdfViewerComponent],
      providers: [
        { provide: LOCALE_ID, useValue: 'sv' },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParamMap.asObservable() }
        },
        { provide: ModalController, useValue: { create: jasmine.createSpy('create') } }
      ]
    })
      .overrideComponent(PdfViewerComponent, {
        set: { template: '<span>{{ pageNumber() }}</span>' }
      })
      .compileComponents();
  });

  it('updates PDF parameters when query parameters change', async () => {
    const fixture = TestBed.createComponent(PdfViewerComponent);
    const component = fixture.componentInstance;

    queryParamMap.next(convertToParamMap({ page: '12', q: ['first', 'second'] }));
    await fixture.whenStable();

    expect(component.pageNumber()).toBe(12);
    expect(component.params().pdfParams).toBe('#page=12&search=first second');
    expect(fixture.nativeElement.textContent.trim()).toBe('12');

    queryParamMap.next(convertToParamMap({ q: 'motif' }));
    await fixture.whenStable();

    expect(component.pageNumber()).toBeNull();
    expect(component.params().pdfParams).toBe('#search=motif');
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
