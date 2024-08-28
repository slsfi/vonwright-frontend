import { Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output, Renderer2 } from '@angular/core';
import { NgIf } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

import { IllustrationModal } from '@modals/illustration/illustration.modal';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CommentService } from '@services/comment.service';
import { HtmlParserService } from '@services/html-parser.service';
import { PlatformService } from '@services/platform.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';
import { concatenateNames, isBrowser } from '@utility-functions';


@Component({
  standalone: true,
  selector: 'comments',
  templateUrl: './comments.component.html',
  styleUrls: ['./comments.component.scss'],
  imports: [NgIf, IonicModule, TrustHtmlPipe]
})
export class CommentsComponent implements OnInit, OnDestroy {
  @Input() searchMatches: string[] = [];
  @Input() textItemID: string = '';
  @Output() openNewReadingTextView: EventEmitter<string> = new EventEmitter();
  @Output() setMobileModeActiveText: EventEmitter<string> = new EventEmitter();

  intervalTimerId: number = 0;
  letter: any = undefined;
  manuscript: any = undefined;
  mobileMode: boolean = true;
  receiver: string = '';
  sender: string = '';
  text: string = '';

  private unlistenClickEvents?: () => void;

  constructor(
    private commentService: CommentService,
    private elementRef: ElementRef,
    private modalController: ModalController,
    private ngZone: NgZone,
    private parserService: HtmlParserService,
    private platformService: PlatformService,
    private renderer2: Renderer2,
    private scrollService: ScrollService,
    public viewOptionsService: ViewOptionsService
  ) {}

  ngOnInit() {
    this.mobileMode = this.platformService.isMobile();

    if (this.textItemID) {
      this.loadCommentsText();
      this.getCorrespondanceMetadata();
    }
    if (isBrowser()) {
      this.setUpTextListeners();
    }
  }

  ngOnDestroy() {
    this.unlistenClickEvents?.();
  }

  loadCommentsText() {
    this.commentService.getComments(this.textItemID).subscribe({
      next: (text) => {
        if (text) {
          this.text = this.parserService.insertSearchMatchTags(String(text), this.searchMatches);
          if (this.searchMatches.length) {
            this.scrollService.scrollToFirstSearchMatch(this.elementRef.nativeElement, this.intervalTimerId);
          }
        } else {
          this.text = $localize`:@@Commentary.None:Inga kommentarer.`;
        }
      },
      error: (e) =>  {
        console.error(e);
        this.text = $localize`:@@Commentary.Error:Ett fel har uppstått. Kommentarer kunde inte hämtas.`;
      }
    });
  }

  getCorrespondanceMetadata() {
    this.commentService.getCorrespondanceMetadata(this.textItemID.split('_')[1]).subscribe(
      (text: any) => {
        if (text?.subjects?.length > 0) {
          const senders: string[] = [];
          const receivers: string[] = [];
          text.subjects.forEach((subject: any) => {
            if (subject['avs\u00e4ndare']) {
              senders.push(subject['avs\u00e4ndare']);
            }
            if (subject['mottagare']) {
              receivers.push(subject['mottagare']);
            }
          });
          this.sender = concatenateNames(senders);
          this.receiver = concatenateNames(receivers);
        }

        if (text?.letter) {
          this.letter = text.letter;
        }
      }
    );
  }

  private setUpTextListeners() {
    const nElement: HTMLElement = this.elementRef.nativeElement;

    this.ngZone.runOutsideAngular(() => {

      /* CLICK EVENTS */
      this.unlistenClickEvents = this.renderer2.listen(nElement, 'click', (event) => {
        try {
          // This check for xreference is necessary since we don't want the comment to
          // scroll if the clicked target is a link in a comment. Clicks on links are
          // handled by read.ts.
          let targetIsLink = false;
          let targetElem: HTMLElement | null = event.target as HTMLElement;

          if (
            targetElem.classList.contains('xreference') ||
            (
              targetElem.parentElement !== null &&
              targetElem.parentElement.classList.contains('xreference')
            ) ||
            (
              targetElem.parentElement?.parentElement !== null &&
              targetElem.parentElement?.parentElement.classList.contains('xreference')
            )
          ) {
            targetIsLink = true;
          }

          if (!targetIsLink && this.viewOptionsService.show.comments) {
            // This is linking to a comment lemma ("asterisk") in the reading text,
            // i.e. the user has clicked a comment in the comments-column.
            event.preventDefault();

            // Find the comment element that has been clicked in the comment-column.
            if (!targetElem.classList.contains('commentScrollTarget')) {
              targetElem = targetElem.parentElement;
              while (
                targetElem !== null &&
                !targetElem.classList.contains('commentScrollTarget') &&
                targetElem.tagName !== 'COMMENTS'
              ) {
                targetElem = targetElem.parentElement;
              }
            }
            if (targetElem) {
              // Find the lemma in the reading text.
              // Remove all non-digits at the start of the comment's id.
              const numId: string = targetElem.classList[targetElem.classList.length - 1]
                    .replace( /^\D+/g, '');
              const targetId: string = 'start' + numId;
              const lemmaStart = this.scrollService.findElementInColumnByAttribute('data-id', targetId, 'reading-text');

              if (lemmaStart) {
                // There is a reading text view open.
                // Scroll to start of lemma in reading text and temporarily prepend arrow.
                if (this.mobileMode) {
                  this.setMobileModeActiveText.emit('readingtext');
                  // In mobile mode the reading text view needs time to be made
                  // visible before scrolling can start.
                  setTimeout(() => {
                    this.scrollService.scrollToCommentLemma(lemmaStart);
                  }, 700);
                } else {
                  this.scrollService.scrollToCommentLemma(lemmaStart);
                  // Scroll to comment in the comments-column.
                  this.scrollService.scrollToComment(numId, targetElem);
                }
              } else {
                // A reading text view is not open -> open one so the lemma can be scrolled
                // into view there.
                this.ngZone.run(() => {
                  this.openNewReadingTextView.emit(targetId);
                });
                // Scroll to comment in the comments-column.
                this.scrollService.scrollToComment(numId, targetElem);
              }
            }
          }

          // Check if click on a link to an illustration that should be opened in a modal
          if (targetIsLink && targetElem?.classList.contains('ref_illustration')) {
            const imageNumber = (targetElem as HTMLAnchorElement).hash.split('#')[1];
            this.ngZone.run(() => {
              this.openIllustration(imageNumber);
            });
          }
        } catch (e) {}
      });

    });
  }

  async openIllustration(imageNumber: string) {
    const modal = await this.modalController.create({
      component: IllustrationModal,
      componentProps: { 'imageNumber': imageNumber }
    });
    modal.present();
  }

}
