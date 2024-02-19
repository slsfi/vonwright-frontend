import { Component, Inject, Input, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { AsyncPipe, DOCUMENT, NgClass, NgFor, NgIf, NgStyle, NgTemplateOutlet } from '@angular/common';
import { PRIMARY_OUTLET, Router, UrlSegment, UrlTree } from '@angular/router';
import { IonicModule, ModalController } from '@ionic/angular';
import { catchError, forkJoin, map, Observable, of, Subscription, tap } from 'rxjs';

import { config } from '@config';
import { TrustHtmlPipe } from '@pipes/trust-html-pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { CollectionsService } from '@services/collections.service';
import { CollectionTableOfContentsService } from '@services/collection-toc.service';
import { CommentService } from '@services/comment.service';
import { DocumentHeadService } from '@services/document-head.service';
import { HtmlParserService } from '@services/html-parser.service';
import { MarkdownService } from '@services/markdown.service';
import { ReferenceDataService } from '@services/reference-data.service';
import { ViewOptionsService } from '@services/view-options.service';
import { concatenateNames } from '@utility-functions';


@Component({
  standalone: true,
  selector: 'modal-download-texts',
  templateUrl: './download-texts.modal.html',
  styleUrls: ['./download-texts.modal.scss'],
  imports: [AsyncPipe, NgClass, NgFor, NgIf, NgStyle, NgTemplateOutlet, IonicModule, TrustHtmlPipe]
})
export class DownloadTextsModal implements OnDestroy, OnInit {
  @Input() origin: string = '';
  @Input() textItemID: string = '';

  collectionId: string = '';
  collectionTitle: string = '';
  commentTitle: string = '';
  copyrightText: string = '';
  copyrightURL: string = '';
  currentUrl: string = '';
  downloadFormatsCom: string[] = [];
  downloadFormatsEst: string[] = [];
  downloadFormatsIntro: string[] = [];
  downloadFormatsMs: string[] = [];
  downloadOptionsExist: boolean = false;
  downloadTextSubscription: Subscription | null = null;
  instructionsText$: Observable<string | null>;
  introductionMode: boolean = false;
  introductionTitle: string = '';
  loadingCom: boolean = false;
  loadingEst: boolean = false;
  loadingIntro: boolean = false;
  loadingMs: boolean = false;
  loadingGroupIndex: number = -1;
  manuscriptsList$: Observable<any[]>;
  readTextLanguages: string[] = [];
  referenceData: any = null;
  pageTitleSubscr: Subscription | null = null;
  printTextSubscription: Subscription | null = null;
  printTranslation: string = '';
  publicationData$: Observable<any>;
  publicationTitle: string = '';
  readTextsMode: boolean = false;
  replaceImageAssetsPaths: boolean = true;
  showLoadingError: boolean = false;
  showMissingTextError: boolean = false;
  showPrintError: boolean = false;
  siteUrl: string = '';
  textSizeTranslation: string = '';
  urnResolverUrl: string = '';

  constructor(
    private collectionContentService: CollectionContentService,
    private collectionsService: CollectionsService,
    private commentService: CommentService,
    private headService: DocumentHeadService,
    private mdService: MarkdownService,
    private modalCtrl: ModalController,
    private parserService: HtmlParserService,
    private referenceDataService: ReferenceDataService,
    private router: Router,
    private tocService: CollectionTableOfContentsService,
    private viewOptionsService: ViewOptionsService,
    @Inject(LOCALE_ID) private activeLocale: string,
    @Inject(DOCUMENT) private document: Document
  ) {
    // Get configs
    this.readTextLanguages = config.app?.i18n?.multilingualReadingTextLanguages ?? [];
    if (this.readTextLanguages.length < 2) {
      this.readTextLanguages = ['default'];
    }

    this.siteUrl = config.app?.siteURLOrigin ?? '';

    const formatsCom = config.modal?.downloadTexts?.commentsFormats ?? {};
    const formatsEst = config.modal?.downloadTexts?.readingTextFormats ?? {};
    const formatsIntro = config.modal?.downloadTexts?.introductionFormats ?? {};
    const formatsMs = config.modal?.downloadTexts?.manuscriptsFormats ?? {};

    const supportedFormats: string[] = ['xml', 'html', 'xhtml', 'txt', 'print'];

    // Set enabled download formats
    Object.entries(formatsCom).forEach(([key, value]) => {
      if (value && supportedFormats.includes(key)) {
        this.downloadFormatsCom.push(key);
      }
    });

    Object.entries(formatsEst).forEach(([key, value]) => {
      if (value && supportedFormats.includes(key)) {
        this.downloadFormatsEst.push(key);
      }
    });

    Object.entries(formatsIntro).forEach(([key, value]) => {
      if (value && supportedFormats.includes(key)) {
        this.downloadFormatsIntro.push(key);
      }
    });

    Object.entries(formatsMs).forEach(([key, value]) => {
      if (value && supportedFormats.includes(key)) {
        this.downloadFormatsMs.push(key);
      }
    });

    // Move any 'print' formats to the end of the arrays
    this.downloadFormatsCom.length && this.downloadFormatsCom.push(
      this.downloadFormatsCom.splice(this.downloadFormatsCom.indexOf('print'), 1)[0]
    );
    this.downloadFormatsEst.length && this.downloadFormatsEst.push(
      this.downloadFormatsEst.splice(this.downloadFormatsEst.indexOf('print'), 1)[0]
    );
    this.downloadFormatsIntro.length && this.downloadFormatsIntro.push(
      this.downloadFormatsIntro.splice(this.downloadFormatsIntro.indexOf('print'), 1)[0]
    );
    this.downloadFormatsMs.length && this.downloadFormatsMs.push(
      this.downloadFormatsMs.splice(this.downloadFormatsMs.indexOf('print'), 1)[0]
    );

    this.replaceImageAssetsPaths = config.collections?.replaceImageAssetsPaths ?? true;
  }

  ngOnInit(): void {
    let instructionsTextMdNode: string = '06';
    // Set which page has initiated the download modal
    if (this.origin === 'page-text') {
      this.readTextsMode = true;
    } else if (this.origin === 'page-introduction') {
      this.introductionMode = true;
      instructionsTextMdNode = '07';
      if (this.downloadFormatsIntro.length) {
        this.downloadOptionsExist = true;
      }
    }

    this.urnResolverUrl = this.referenceDataService.getUrnResolverUrl();
    this.currentUrl = this.document.defaultView?.location.href.split('?')[0] || '';
    this.instructionsText$ = this.mdService.getParsedMdContent(
      this.activeLocale + '-12-' + instructionsTextMdNode
    );
    this.setTranslations();
    this.setReferenceData();

    if (this.textItemID) {
      // Parse text item id
      const idParts = this.textItemID.split(';')[0].split('_');
      this.collectionId = idParts[0];

      this.setCollectionTitle();

      if (this.readTextsMode) {
        // Get publication title
        this.pageTitleSubscr = this.headService.getCurrentPageTitle().subscribe(
          (pubTitle: string) => {
            this.publicationTitle = pubTitle?.slice(-1) === '.'
                  ? pubTitle.slice(0, -1)
                  : pubTitle;
          }
        );

        if (this.downloadFormatsEst.length || this.downloadFormatsCom.length) {
          // Get publication data in order to determine if reading-texts and
          // comments are available. original_filename is used to determine if
          // reading-texts exist, and publication_comment_id if comments exist.
          this.publicationData$ = this.collectionsService.getPublication(
            idParts[1]
          ).pipe(
            tap((res: any) => {
              if (res?.original_filename) {
                this.downloadOptionsExist = true;
              }
            }),
            catchError((e: any) => {
              console.error('unable to get publication data', e);
              return of(null);
            })
          );
        }

        if (this.downloadFormatsMs.length) {
          // Get a list of all manuscripts in the publication
          this.manuscriptsList$ = this.collectionContentService.getManuscriptsList(
            this.textItemID
          ).pipe(
            tap((res: any) => {
              if (res?.manuscripts?.length) {
                this.downloadOptionsExist = true;
              }
            }),
            map((res: any) => {
              return res?.manuscripts?.length ? res.manuscripts : null;
            })
          );
        }
      }
    }
  }

  ngOnDestroy() {
    this.downloadTextSubscription?.unsubscribe();
    this.printTextSubscription?.unsubscribe();
    this.pageTitleSubscr?.unsubscribe();
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  initiateDownload(textType: string, format: string, language?: string, typeID?: number) {
    this.showLoadingError = false;
    this.showMissingTextError = false;
    this.showPrintError = false;
    let mimetype = 'application/xml';
    let fileExtension = 'xml';

    if (format === 'txt') {
      mimetype = 'text/plain';
      fileExtension = 'txt';
    } else if (format === 'html') {
      mimetype = 'text/html';
      fileExtension = 'html';
    } else if (format === 'xhtml') {
      mimetype = 'application/xhtml+xml';
      fileExtension = 'xhtml';
    }

    if (!language || language === 'default') {
      language = '';
    }

    let dlText$: Observable<any> | null = null;

    if (textType === 'intro') {
      this.loadingIntro = true;
      dlText$ = this.collectionContentService.getDownloadableIntroduction(
        this.textItemID, format, this.activeLocale
      );
    } else if (textType === 'rt') {
      this.loadingEst = true;
      dlText$ = this.collectionContentService.getDownloadableReadingText(
        this.textItemID, format, language
      );
    } else if (textType === 'com') {
      this.loadingCom = true;
      dlText$ = this.commentService.getDownloadableComments(
        this.textItemID, format
      );
    } else if (textType === 'ms') {
      this.loadingMs = true;
      dlText$ = this.collectionContentService.getDownloadableManuscript(
        this.textItemID, typeID || 0, format
      );
    }

    if (dlText$) {
      this.downloadTextSubscription?.unsubscribe();
      this.downloadTextSubscription = dlText$.subscribe({
        next: (res: any) => {
          let fileContent: any = res.content || '';
          let fileName: string = 'file';

          if (textType === 'intro') {
            fileName = this.convertToFilename(
              this.introductionTitle + '-' + this.collectionTitle
            ) + '.' + fileExtension;
          } else if (textType === 'rt') {
            const langForFilename = language ? '_' + language : '';
            fileName = this.convertToFilename(this.publicationTitle)
                  + langForFilename + '-id-' + this.textItemID.split('_')[1]
                  + '.' + fileExtension;
          } else if (textType === 'com') {
            fileName = this.convertToFilename(
              this.commentTitle + ' ' + this.publicationTitle
            ) + '-id-' + this.textItemID.split('_')[1] + '.' + fileExtension;
          } else if (textType === 'ms') {
            fileName = this.convertToFilename(this.publicationTitle)
                  + '-id-' + this.textItemID.split('_')[1]
                  + '-ms-' + typeID + '.' + fileExtension;
          }

          if (fileContent && fileContent !== 'File not found') {
            const blob = new Blob([fileContent], {type: mimetype});
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            link.target = '_blank'
            link.click();
            URL.revokeObjectURL(blobUrl);
          } else {
            console.error('the text does not exist and can’t be downloaded');
            this.showMissingTextError = true;
          }
          this.loadingIntro = false;
          this.loadingEst = false;
          this.loadingCom = false;
          this.loadingMs = false;
        },
        error: (e: any) => {
          console.error('error getting downloadable ' + textType + ' in ' + format + ' format', e);
          this.loadingIntro = false;
          this.loadingEst = false;
          this.loadingCom = false;
          this.loadingMs = false;
          this.showLoadingError = true;
        }
      });
    }
  }

  openPrintFriendlyText(textType: string, language?: string, typeID?: number, typeTitle?: string) {
    if (language === 'default' || !language) {
      language = '';
    }
    this.showLoadingError = false;
    this.showMissingTextError = false;
    this.showPrintError = false;

    let text$: Observable<any> | null = null;

    if (textType === 'intro') {
      this.loadingIntro = true;
      text$ = this.collectionContentService.getIntroduction(this.textItemID, this.activeLocale);
    } else if (textType === 'rt') {
      this.loadingEst = true;
      text$ = this.collectionContentService.getReadingText(this.textItemID, language);
    } else if (textType === 'com') {
      this.loadingCom = true;
      text$ = forkJoin([
        this.commentService.getComments(this.textItemID).pipe(
          catchError(error => of({ error }))
        ),
        this.commentService.getCorrespondanceMetadata(this.textItemID.split('_')[1]).pipe(
          catchError(error => of({ error }))
        )
      ]).pipe(
        map((res: any[]) => {
          return { comments: res[0], metadata: res[1] };
        })
      );
    } else if (textType === 'ms') {
      this.loadingMs = true;
      text$ = this.collectionContentService.getManuscripts(this.textItemID, typeID);
    }

    if (text$) {
      this.printTextSubscription?.unsubscribe();
      this.printTextSubscription = text$.subscribe({
        next: (res: any) => {
          if (
            (textType === 'intro' && res?.content) ||
            (
              textType === 'rt' &&
              res?.content &&
              res?.content !== '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>File not found</body></html>'
            ) ||
            (textType === 'com' && res?.comments && !res.comments.error) ||
            (
              textType === 'ms' &&
              res?.manuscripts?.length > 0 &&
              res?.manuscripts[0]?.manuscript_changes
            )
          ) {
            let text: string = '';

            if (textType === 'intro') {
              text = this.getProcessedPrintIntro(res.content);
            } else if (textType === 'rt') {
              text = this.getProcessedPrintReadText(res.content, language);
            } else if (textType === 'com') {
              text = this.getProcessedPrintComments(res);
            } else if (textType === 'ms') {
              text = this.getProcessedPrintManuscripts(res.manuscripts[0].manuscript_changes, res.manuscripts[0].language, typeTitle);
            }

            try {
              const newWindowRef = window.open();
              if (newWindowRef) {
                newWindowRef.document.write(text);
                newWindowRef.document.close();
                newWindowRef.focus();
              } else {
                this.showPrintError = true;
                console.log('unable to open new window');
              }
            } catch (e: any) {
              this.showPrintError = true;
              console.error('unable to open new window', e);
            }

          } else {
            if (textType === 'rt') {
              this.showMissingTextError = true;
            } else {
              this.showPrintError = true;
            }
            console.log('invalid text format for print version');
          }

          this.loadingIntro = false;
          this.loadingEst = false;
          this.loadingCom = false;
          this.loadingMs = false;
        },
        error: (e: any) => {
          console.error('error loading text', e);
          this.loadingIntro = false;
          this.loadingEst = false;
          this.loadingCom = false;
          this.loadingMs = false;
          this.showPrintError = true;
        }
      });
    }
  }

  private getProcessedPrintIntro(text: string): string {
    if (this.replaceImageAssetsPaths) {
      text = text.replace(/src="images\//g, 'src="assets/images/');
    }
    text = this.fixImagePaths(text);
    return this.constructHtmlForPrint(text, 'intro');
  }

  private getProcessedPrintReadText(text: string, language?: string): string {
    text = this.parserService.postprocessReadingText(text, this.textItemID.split('_')[0]);
    text = text.replace('<p> </p><p> </p><section role="doc-endnotes"><ol class="tei footnotesList"></ol></section>', '');
    text = this.fixImagePaths(text);
    return this.constructHtmlForPrint(text, 'rt', language);
  }

  private getProcessedPrintComments(commentsData: any): string {
    let text = this.constructHtmlForPrint(commentsData.comments, 'com');
    let metaContent = '';

    if (commentsData.metadata?.letter) {
      let concatSenders = '';
      let concatReceivers = '';

      if (commentsData.metadata?.subjects?.length > 0) {
        const senders: string[] = [];
        const receivers: string[] = [];
        commentsData.metadata.subjects.forEach((subject: any) => {
          if (subject['avs\u00e4ndare']) {
            senders.push(subject['avs\u00e4ndare']);
          }
          if (subject['mottagare']) {
            receivers.push(subject['mottagare']);
          }
        });
        concatSenders = concatenateNames(senders);
        concatReceivers = concatenateNames(receivers);
      }

      if (commentsData.metadata.letter) {
        metaContent = this.getCorrespondenceDataAsHtml(
          commentsData.metadata.letter, concatSenders, concatReceivers
        );
        const contentParts = text.split('</div>\n</comments>');
        text = contentParts[0] + metaContent + '</div>\n</comments>' + contentParts[1];
      }
    }
    return text;
  }

  private getProcessedPrintManuscripts(text: string, language?: string, typeTitle?: string): string {
    text = this.parserService.postprocessManuscriptText(text);
    text = this.fixImagePaths(text);
    return this.constructHtmlForPrint(text, 'ms', language, typeTitle);
  }

  private constructHtmlForPrint(text: string, textType: string, language?: string, typeTitle?: string): string {
    const cssStylesheets = [];
    for (let i = 0; i < document.styleSheets.length; i++) {
      if (document.styleSheets[i].href) {
        cssStylesheets.push(document.styleSheets[i].href);
      }
    }

    const textTitle = this.constructPrintHtmlTitle(textType);
    typeTitle = typeTitle && config.component?.manuscripts?.showTitle ? typeTitle : '';
    const referenceURL = this.referenceData?.urn
          ? this.urnResolverUrl + this.referenceData.urn
          : this.currentUrl;

    let header = '<!DOCTYPE html>\n';
    if (language) {
      header += '<html lang="' + language + '" class="hydrated">\n';
    } else {
      header += '<html class="hydrated">\n';
    }
    header += '<head>\n';
    header += '<meta charset="UTF-8">\n';
    header += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
    header += '<title>' + textTitle + '</title>\n';
    cssStylesheets.forEach(sheetUrl => {
      header += '<link href="' + sheetUrl + '" rel="stylesheet">\n';
    });
    header += '<style>\n';
    header += '    body  { background-color: #fff; position: static; overflow: auto; height: initial; max-height: initial; width: initial; font-family: var(--font-stack-app-base); font-size: 1.0625rem; }\n';
    header += '    page-text, page-introduction { display: block; padding: 0 1.5em 4em 1.5em; }\n';
    header += '    div.tei.teiContainer * { cursor: auto !important; }\n';
    header += '    div.tei.teiContainer { padding-bottom: 0; line-height: 1.45em; }\n';
    header += '    div.tei.teiContainer p { line-height: 1.45em; }\n';
    header += '    div.tei p.teiComment.note { margin-top: 0.25rem; margin-left: 1.5em; text-indent: -1.5em; }\n';
    header += '    reading-text .tei.show_paragraphNumbering, page-introduction .tei.show_paragraphNumbering { padding-left: 35px; }\n';
    header += '    div.tei ol.footnotesList li.footnoteItem a.footnoteReference { color: initial; }\n';
    header += '    page-introduction div.tei span.footnoteindicator { color: initial; }\n';
    header += '    h1, h2, h3, h4, h5, h6 { break-after: avoid; break-inside: avoid; }\n';
    header += '    h1.tei.commentPublicationTitle { font-variant: small-caps; }\n';
    header += '    table { page-break-inside:auto; }\n';
    header += '    tr    { page-break-inside:avoid; page-break-after:auto; }\n';
    header += '    thead { display:table-header-group; }\n';
    header += '    tfoot { display:table-footer-group; }\n';
    header += '    .print-header { padding: 1px; margin-bottom: 2rem; background-color: #ededed; }\n';
    header += '    .print-header button { display: block; font-size: 1.0625rem; font-weight: 600; text-shadow: 0 0.04em 0.04em rgba(0,0,0,0.35); text-transform: uppercase; color: #fff; background-color: #2a75cb; border-radius: 0.4em; padding: 0.5em 1.3em; margin: 2em auto; cursor: pointer; transition: all 0.2s; line-height: 1.5; }\n';
    header += '    .print-header button:hover, .print-header button:focus { background-color: #12447e; }\n';
    header += '    .text-metadata { padding: 0.625rem !important; margin: 0 0 2.5rem 0; border: 1px solid #000; }\n';
    header += '    .text-metadata a { color: #000 !important; text-decoration: none !important; }\n';
    header += '    .text-metadata p { padding-left: 1em; text-indent: 0 !important; line-height: 1.35em !important; }\n';
    header += '    .text-metadata p.apart { margin-top: 1em !important; }\n';
    header += '    .text-metadata p.apart::before, .text-metadata p:first-child::before { content: "▪"; margin-left: -1em; position: absolute; }\n';
    header += '    .slide-container { display: flex; flex-direction: column; align-items: center; }\n';
    header += '    .slide-container label { font-weight: 600; }\n';
    header += '    .slider { width: 300px; max-width: 90%; margin: 1em auto 0.25em auto; display: block; }\n';
    header += '    .slide-container .range-labels { width: 300px; max-width: 90%; display: flex; justify-content: space-between; align-items: center; padding: 0 1px 0 4px; margin-bottom: 2em; font-size: 1rem; font-weight: 600; }\n';
    header += '    .slide-container .range-labels .smallest { font-size: 0.75rem; }\n';
    header += '    .slide-container .range-labels .largest { font-size: 1.375rem; }\n';
    header += '    @media only print {\n';
    header += '        .print-header, .print-header button { display: none; }\n';
    header += '        page-text, page-introduction { padding: 0; }\n';
    header += '    }\n';
    header += '    @page { size: auto; margin: 25mm 20mm 25mm 20mm; }\n';
    header += '</style>\n';
    header += '</head>\n';

    header += '<body class="print-mode">\n';
    header += '<div class="print-header" lang="' + this.activeLocale + '">\n';
    header += '    <button type="button" tabindex="0" onclick="window.print();return false;">' + this.printTranslation + '</button>\n';
    header += '    <div class="slide-container">\n';
    header += '        <label for="textSizeSlider">' + this.textSizeTranslation + '</label>\n';
    header += '        <input type="range" min="1" max="7" value="3" class="slider" id="textSizeSlider" list="tickmarks">\n';
    header += '        <datalist id="tickmarks">\n';
    header += '        <option value="1"></option>\n';
    header += '        <option value="2"></option>\n';
    header += '        <option value="3"></option>\n';
    header += '        <option value="4"></option>\n';
    header += '        <option value="5"></option>\n';
    header += '        <option value="6"></option>\n';
    header += '        <option value="7"></option>\n';
    header += '        </datalist>\n';
    header += '        <div class="range-labels"><span class="smallest">A</span><span class="largest">A</span></div>\n';
    header += '    </div>\n';
    header += '</div>\n';

    if (textType === 'intro') {
      header += '<page-introduction>\n';
    } else {
      header += '<page-text>\n';
    }
    header += '<div id="contentContainer" class="content xxxsmallFontSize">\n';

    header += '<div class="text-metadata tei" lang="' + this.activeLocale + '">\n';
    if (textType === 'intro') {
      header += '    <p><b>' + this.introductionTitle + '</b></p>\n';
    } else if (textType === 'com') {
      header += '    <p><b>' + this.commentTitle + ' ' + this.publicationTitle + '</b></p>\n';
    } else if (textType === 'ms') {
      header += '    <p><b>' + $localize`:@@Manuscripts.Manuscript:Manuskript` + ': ' + this.publicationTitle + (typeTitle ? ' (' + typeTitle + ')' : '') + '</b></p>\n';
    } else {
      header += '    <p><b>' + this.publicationTitle + '</b></p>\n';
    }
    header += '    <p>' + this.collectionTitle + '</p>\n';
    header += '    <p>' + $localize`:@@Site.Title:Webbplatsens titel` + (this.siteUrl ? (' – ' + '<a href="' + this.siteUrl + '">' + this.siteUrl + '</a>') : '') + '</p>\n';
    if ((textType === 'rt' || textType === 'intro') && this.referenceData) {

      header += '    <p class="apart">' + (textType === 'rt' ? $localize`:@@Reference.ReferToReadingText:Hänvisa till denna lästext` : $localize`:@@Reference.ReferToIntroduction:Hänvisa till denna inledning`) + ':</p>\n';
      header += '    <p>' + this.referenceData.reference_text + ', <a href="' + referenceURL + '">' + referenceURL + '</a></p>\n';
    } else {
      header += '    <p class="apart">' + $localize`:@@DownloadTexts.Source:Texten är hämtad från` + ':</p>\n';
      header += '    <p><a href="' + this.currentUrl + '">' + this.currentUrl + '</a></p>\n';
    }
    if (this.copyrightText) {
      header += '    <p class="apart">' + $localize`:@@DownloadTexts.CopyrightNoticeLabel:Licens` + ': ' + this.copyrightText + (this.copyrightURL ? (', <a href="' + this.copyrightURL + '">' + this.copyrightURL + '</a>') : '') + '</p>\n';
    }
    header += '</div>\n';

    if (textType === 'rt') {
      header += '<reading-text>\n';
    } else if (textType === 'com') {
      header += '<comments>\n';
    } else if (textType === 'ms') {
      header += '<manuscripts>\n';
    }
    header += '<div class="tei teiContainer ' + this.getViewOptionsClassNames(textType) + '">\n';
    if (textType === 'com') {
      header += '<h1 class="tei commentPublicationTitle">' + this.publicationTitle + '</h1>\n';
    }

    let closer = '</div>\n';
    if (textType === 'rt') {
      closer += '</reading-text>\n';
    } else if (textType === 'com') {
      closer += '</comments>\n';
    } else if (textType === 'ms') {
      closer += '</manuscripts>\n';
    }
    closer += '</div>\n';
    if (textType === 'intro') {
      closer += '</page-introduction>\n';
    } else {
      closer += '</page-text>\n';
    }
    closer += '<script>\n';
    closer += '    const slider = document.getElementById("textSizeSlider");\n';
    closer += '    const contentWrapper = document.getElementById("contentContainer")\n';
    closer += '    slider.oninput = function() {\n';
    closer += '        let fontSize = "";\n';
    closer += '        if (this.value === "1") {\n';
    closer += '            fontSize = "miniFontSize";\n';
    closer += '        } else if (this.value === "2") {\n';
    closer += '            fontSize = "tinyFontSize";\n';
    closer += '        } else if (this.value === "4") {\n';
    closer += '            fontSize = "xxsmallFontSize";\n';
    closer += '        } else if (this.value === "5") {\n';
    closer += '            fontSize = "xsmallFontSize";\n';
    closer += '        } else if (this.value === "6") {\n';
    closer += '            fontSize = "smallFontSize";\n';
    closer += '        } else if (this.value === "7") {\n';
    closer += '            fontSize = "mediumFontSize";\n';
    closer += '        } else {\n';
    closer += '            fontSize = "xxxsmallFontSize";\n';
    closer += '        }\n';
    closer += '        const classes = contentWrapper.className.split(" ");\n';
    closer += '        for (let i = 0; i < classes.length; i++) {\n';
    closer += '            if (classes[i].indexOf("FontSize") !== -1) {\n';
    closer += '                contentWrapper.classList.remove(classes[i]);\n';
    closer += '                break;\n';
    closer += '            }\n';
    closer += '        }\n';
    closer += '        contentWrapper.classList.add(fontSize);\n';
    closer += '    }\n';
    closer += '    \n';
    closer += '</script>\n';
    closer += '</body>\n';
    closer += '</html>\n';

    text = header + text + closer;
    return text;
  }

  private getViewOptionsClassNames(textType: string): string {
    let classes = '';
    if (textType === 'rt' || textType === 'intro') {
      if (this.viewOptionsService.show.paragraphNumbering) {
        classes += 'show_paragraphNumbering ';
      }
      if (this.viewOptionsService.show.pageBreakEdition) {
        classes += 'show_pageBreakEdition ';
      }
      if (textType === 'rt' && this.viewOptionsService.show.pageBreakOriginal) {
        classes += 'show_pageBreakOriginal ';
      }
    }
    return classes.trim();
  }

  private constructPrintHtmlTitle(textType: string) {
    let title: string = '';
    if (textType === 'intro') {
      if (this.introductionTitle) {
        title = this.introductionTitle + ' | ';
      }
      title += this.collectionTitle;
      if (this.siteUrl) {
        title += ' | ' + this.siteUrl;
      }
    } else {
      title = this.publicationTitle;
      if (title) {
        title += ' | ';
      }
      title += this.collectionTitle;
      if (this.siteUrl) {
        title += ' | ' + this.siteUrl;
      }
      if (textType === 'com' && this.commentTitle) {
        title = this.commentTitle + ' | ' + title;
      }
    }
    return title;
  }

  private setReferenceData() {
    const currentUrlTree: UrlTree = this.router.parseUrl(this.router.url);
    const currentUrlSegments: UrlSegment[] = currentUrlTree?.root?.children[PRIMARY_OUTLET]?.segments;

    if (currentUrlSegments?.length) {
      this.referenceDataService.getReferenceData(currentUrlSegments).subscribe(
        (data: any) => {
          this.referenceData = data;
        }
      );
    }
  }

  private setTranslations() {
    // Set translations
    if (this.readTextsMode) {
      this.commentTitle = $localize`:@@DownloadTexts.CommentaryTo:Kommentarer till`;

      if ($localize`:@@DownloadTexts.CopyrightNotice:CC BY-NC-ND 4.0`) {
        this.copyrightText = $localize`:@@DownloadTexts.CopyrightNotice:CC BY-NC-ND 4.0`;
      }

      if ($localize`:@@DownloadTexts.CopyrightURL:https://creativecommons.org/licenses/by-nc-nd/4.0/deed.sv`) {
        this.copyrightURL = $localize`:@@DownloadTexts.CopyrightURL:https://creativecommons.org/licenses/by-nc-nd/4.0/deed.sv`;
      }
    } else if (this.introductionMode) {
      this.introductionTitle = $localize`:@@CollectionIntroduction.Introduction:Inledning`;

      if ($localize`:@@DownloadTexts.CopyrightNoticeIntroduction:CC BY-NC-ND 4.0`) {
        this.copyrightText = $localize`:@@DownloadTexts.CopyrightNoticeIntroduction:CC BY-NC-ND 4.0`;
      }

      if ($localize`:@@DownloadTexts.CopyrightURLIntroduction:https://creativecommons.org/licenses/by-nc-nd/4.0/deed.sv`) {
        this.copyrightURL = $localize`:@@DownloadTexts.CopyrightURLIntroduction:https://creativecommons.org/licenses/by-nc-nd/4.0/deed.sv`;
      }
    }

    if ($localize`:@@BasicActions.Print:Skriv ut`) {
      this.printTranslation = $localize`:@@BasicActions.Print:Skriv ut`;
    } else {
      this.printTranslation = 'Skriv ut';
    }

    if ($localize`:@@ViewOptions.Textsize:Textstorlek`) {
      this.textSizeTranslation = $localize`:@@ViewOptions.Textsize:Textstorlek`;
    } else {
      this.textSizeTranslation = 'Text storlek';
    }
  }

  private setCollectionTitle() {
    // Get collection title from database
    if (this.collectionId) {
      this.collectionsService.getCollection(this.collectionId).subscribe(
        (collectionData: any) => {
          if (collectionData?.[0]?.['name']) {
            this.collectionTitle = collectionData[0]['name'];
          } else {
            this.collectionTitle = '';
          }
        }
      );
    }
  }

  // Returns the given title string as a string that can be used as a filename
  private convertToFilename(title: string, maxLength = 70): string {
    let filename = title
          ? title.replace(/[àáåä]/gi, 'a')
                  .replace(/[öøô]/gi, 'o')
                  .replace(/[æ]/gi, 'ae')
                  .replace(/[èéêë]/gi, 'e')
                  .replace(/[ûü]/gi, 'u')
          : 'filename';
    filename = filename.replace(/[  ]/gi, '_')
                  .replace(/[,:;*+?!"'^%/${}()|[\]\\]/g, '')
                  .replace(/[^a-z0-9_-]/gi, '-');
    filename = filename.replace(/_{2,}/g, '_')
                  .replace(/\-{2,}/g, '-')
                  .replace('-_', '_')
                  .toLowerCase();
    if (filename.length > maxLength) {
      filename = filename.slice(0, maxLength - 3);
      filename += '---'
    }
    return filename;
  }

  private getCorrespondenceDataAsHtml(data: any, concatSenders: string, concatReceivers: string): string {
    let mContent = '';
    mContent += '<div class="ms">\n';
    mContent += '<h3>' + $localize`:@@Commentary.Manuscript.Title:Manuskriptbeskrivning` + '</h3>\n';

    if (data.legacy_id || concatSenders || concatReceivers || data.source_archive || data.source_collection_id) {
      mContent += '<ul>\n';
    }
    if (data.legacy_id) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.LegacyId:Brevsignum` + ': ' + data.legacy_id + '</li>\n';
    }
    if (concatSenders) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Sender:Avsändare` + ': ' + concatSenders + '</li>\n';
    }
    if (concatReceivers) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Receiver:Mottagare` + ': ' + concatReceivers + '</li>\n';
    }
    if (data.source_archive) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Archive:Arkiv` + ': ' + data.source_archive + '</li>\n';
    }
    if (data.source_collection_id) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Collection:Samling, signum` + ': ' + data.source_collection_id + '</li>\n';
    }
    if (data.legacy_id || concatSenders || concatReceivers || data.source_archive || data.source_collection_id) {
      mContent += '</ul>\n';
    }

    mContent += '<ul>\n';
    if (data.material_type) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Type:Form` + ': ' + data.material_type + '</li>\n';
    }
    if (data.material_source) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Status:Status` + ': ' + data.material_source + '</li>\n';
    }
    if (data.material_format) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Format:Format` + ': ' + data.material_format + '</li>\n';
    }
    if (data.leaf_count) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Leafs:Lägg` + ': ' + data.leaf_count + '</li>\n';
    }
    if (data.sheet_count) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Sheets:Antal blad` + ': ' + data.sheet_count + '</li>\n';
    }
    if (data.page_count) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Pages:Sidor brevtext` + ': ' + data.page_count + '</li>\n';
    }
    if (data.material_color) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Color:Färg` + ': ' + data.material_color + '</li>\n';
    }
    if (data.material_quality) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Quality:Kvalitet` + ': ' + data.material_quality + '</li>\n';
    }
    if (data.material_pattern) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Pattern:Mönster` + ': ' + data.material_pattern + '</li>\n';
    }
    if (data.material_state) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.State:Tillstånd` + ': ' + data.material_state + '</li>\n';
    }
    if (data.material) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Material:Skrivmaterial` + ': ' + data.material + '</li>\n';
    }
    if (data.material_notes) {
      mContent += '<li>' + $localize`:@@Commentary.Manuscript.Other:Övrigt` + ': ' + data.material_notes + '</li>\n';
    }
    mContent += '</ul>\n';
    mContent += '</div>\n';
    return mContent;
  }

  private fixImagePaths(text: string): string {
    // fix image paths
    return text.replace(
      /src="assets\/images\//g,
      'src="' + (this.document.defaultView?.location.origin ?? '')
            + (this.document.defaultView?.location.pathname.split('/')[1] === this.activeLocale ? '/' + this.activeLocale : '')
            + '/assets/images/'
    );
  }

}
