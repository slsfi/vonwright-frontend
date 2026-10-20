import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { config } from '@config';
import { CollectionContentService } from '@services/collection-content.service';
import { CollectionsService } from '@services/collections.service';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { CommentService } from '@services/comment.service';
import { DocumentHeadService } from '@services/document-head.service';
import { HtmlParserService } from '@services/html-parser.service';
import { MarkdownService } from '@services/markdown.service';
import { ReferenceDataService } from '@services/reference-data.service';
import { DownloadTextsModal } from './download-texts.modal';

describe('DownloadTextsModal manuscript titles', () => {
  let originalManuscripts: typeof config.component.manuscripts;
  let printDocument: Document;

  beforeEach(() => {
    originalManuscripts = config.component.manuscripts;
    printDocument = document.implementation.createHTMLDocument('Print');
    vi.spyOn(window, 'open').mockReturnValue({
      document: printDocument,
      focus: vi.fn()
    } as unknown as Window);

    const contentService: MockedObject<Pick<CollectionContentService, 'getManuscripts'>> = {
      getManuscripts: vi.fn().mockReturnValue(of([{ changesHtml: '<p>Manuscript text</p>', language: 'sv' }]))
    };
    const parserService: MockedObject<Pick<HtmlParserService, 'postprocessManuscriptText'>> = {
      postprocessManuscriptText: vi.fn().mockImplementation(text => text)
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CollectionContentService, useValue: contentService },
        { provide: CollectionsService, useValue: {} },
        { provide: CollectionTableOfContentsService, useValue: {} },
        { provide: CommentService, useValue: {} },
        { provide: DocumentHeadService, useValue: {} },
        { provide: HtmlParserService, useValue: parserService },
        { provide: MarkdownService, useValue: {} },
        { provide: ModalController, useValue: {} },
        { provide: ReferenceDataService, useValue: {} }
      ]
    });
  });

  afterEach(() => {
    config.component.manuscripts = originalManuscripts;
  });

  it.each([
    { configured: undefined, visible: true },
    { configured: true, visible: true },
    { configured: false, visible: false }
  ])('uses showTitle=$configured in printable manuscript output', ({ configured, visible }) => {
    config.component.manuscripts = { showTitle: configured };
    const modal = TestBed.runInInjectionContext(() => new DownloadTextsModal());
    modal.textKey = { collectionID: '203', publicationID: '100', textItemID: '203_100' };
    modal.publicationTitle.set('Publication title');
    modal.openPrintFriendlyText('ms', 'sv', 1, 'Draft A');

    expect(modal.showPrintError()).toBe(false);
    expect(printDocument.querySelector('.text-metadata')?.textContent?.includes('Draft A')).toBe(visible);
    expect(printDocument.body.textContent).toContain('Manuscript text');
  });
});
