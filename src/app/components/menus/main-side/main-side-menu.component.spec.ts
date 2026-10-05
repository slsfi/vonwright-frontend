import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, UrlSegment } from '@angular/router';
import { of } from 'rxjs';

import { config } from '@config';
import { AUTH_ENABLED } from '@tokens/auth.tokens';
import { CollectionsService } from '@services/collections.service';
import { DocumentHeadService } from '@services/document-head.service';
import { MarkdownService } from '@services/markdown.service';
import { MediaCollectionService } from '@services/media-collection.service';
import { MainSideMenuComponent } from './main-side-menu.component';

describe('MainSideMenuComponent', () => {
  let originalMenuItems: Record<string, boolean>;

  beforeEach(async () => {
    originalMenuItems = { ...config.component!.mainSideMenu!.items };
    config.component!.mainSideMenu!.items = {
      indexPersons: true,
      search: true
    };

    await TestBed.configureTestingModule({
      imports: [MainSideMenuComponent],
      providers: [
        provideRouter([]),
        { provide: AUTH_ENABLED, useValue: false },
        { provide: LOCALE_ID, useValue: 'sv' },
        { provide: CollectionsService, useValue: { getCollections: () => of([]) } },
        { provide: DocumentHeadService, useValue: { setTitle: jasmine.createSpy('setTitle') } },
        { provide: MarkdownService, useValue: { getMenuTree: () => of(null) } },
        { provide: MediaCollectionService, useValue: { getMediaCollections: () => of([]) } }
      ]
    })
      .overrideComponent(MainSideMenuComponent, {
        set: { template: '<span>{{ highlightedNodeId() }}</span>' }
      })
      .compileComponents();
  });

  afterEach(() => {
    config.component!.mainSideMenu!.items = originalMenuItems;
  });

  it('updates the highlighted item when navigation changes', async () => {
    const fixture = TestBed.createComponent(MainSideMenuComponent);
    const component = fixture.componentInstance;

    fixture.componentRef.setInput('urlSegments', [new UrlSegment('search', {})]);
    await fixture.whenStable();

    const searchItem = component.mainMenu().find(item => item.menuType === 'search');
    expect(searchItem).toBeDefined();
    expect(component.highlightedNodeId()).toBe(searchItem!.nodeId as string);

    fixture.componentRef.setInput('urlSegments', [
      new UrlSegment('index', {}),
      new UrlSegment('persons', {})
    ]);
    await fixture.whenStable();

    const personsItem = component.mainMenu().find(item => item.menuType === 'persons');
    expect(personsItem).toBeDefined();
    expect(component.highlightedNodeId()).toBe(personsItem!.nodeId as string);
  });
});
