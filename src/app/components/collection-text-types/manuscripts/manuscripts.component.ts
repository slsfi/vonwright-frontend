import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterRenderEffect, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { AlertButton, AlertController, AlertInput, IonicModule } from '@ionic/angular';
import { catchError, of, switchMap, tap } from 'rxjs';

import { config } from '@config';
import { TextKey } from '@models/collection.models';
import { Manuscript } from '@models/manuscript.models';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'manuscripts',
  templateUrl: './manuscripts.component.html',
  styleUrls: ['./manuscripts.component.scss'],
  imports: [IonicModule, TrustHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ManuscriptsComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private alertCtrl = inject(AlertController);
  private collectionContentService = inject(CollectionContentService);
  private destroyRef = inject(DestroyRef);
  private elementRef = inject(ElementRef);
  private injector = inject(Injector);
  private parserService = inject(HtmlParserService);
  private scrollService = inject(ScrollService);
  viewOptionsService = inject(ViewOptionsService);

  readonly msID = input<number>();
  readonly searchMatches = input<string[]>([]);
  readonly textKey = input.required<TextKey>();
  readonly openNewLegendView = output<any>();
  readonly selectedMsID = output<number>();
  readonly selectedMsName = output<string>();

  readonly showNormalizedToggle: boolean = config.component?.manuscripts?.showNormalizedToggle ?? true;
  readonly showOpenLegendButton: boolean = config.component?.manuscripts?.showOpenLegendButton ?? false;
  readonly showTitle: boolean = config.component?.manuscripts?.showTitle ?? true;

  intervalTimerId: number = 0;
  private _lastScrollKey: string | null = null;

  manuscripts = signal<Manuscript[] | null>(null);
  private pickedMsId = signal<number | undefined>(undefined);
  private showNormalizedMs = signal(false);
  private statusMessage = signal<string | null>(null);


  // ─────────────────────────────────────────────────────────────────────────────
  // Derived computeds (pure, no side-effects)
  // ─────────────────────────────────────────────────────────────────────────────
  selectedManuscript = computed<Manuscript | undefined> (() => {
    const list = this.manuscripts();
    if (!Array.isArray(list) || list.length === 0) {
      return undefined;
    }
    const id = this.pickedMsId() ?? this.msID();
    return list.find(m => m.id === id) ?? list[0];
  });

  textLanguage = computed<string>(() => this.selectedManuscript()?.language ?? '');

  // Derived computed that builds the final HTML for the template
  //    - Returns:
  //        undefined  → "loading" (spinner)
  //        string     → final HTML or a user-facing status message
  html = computed<string | undefined>(() => {
    // Show status (None/Error) when present
    const message = this.statusMessage();
    if (message) {
      return message;
    }

    // Loading state: manuscripts === null → spinner in template
    const list = this.manuscripts();
    if (list === null) {
      return undefined;
    }

    const m = this.selectedManuscript();
    // No manuscripts (handled above with a message), but defend anyway
    if (!m) {
      return '';
    }

    // Compose final HTML
    const raw = this.showNormalizedMs()
          ? m.normalizedHtml
          : m.changesHtml;
    const post = this.parserService.postprocessManuscriptText(raw);
    return this.parserService.insertSearchMatchTags(post, this.searchMatches());
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: wire side effects (data load, emits, after-render hook)
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.loadManuscripts();
    this.registerOutputEmissions();
    this.registerAfterRenderEffects();
  }

  private loadManuscripts() {
    // Load manuscripts when textKey changes
    toObservable(this.textKey).pipe(
      tap(() => {
        // reset state for a new load
        this.manuscripts.set(null);
        this.statusMessage.set(null);
        this.pickedMsId.set(undefined);
        this._lastScrollKey = null;
      }),
      switchMap((tk: TextKey) =>
        this.collectionContentService.getManuscripts(tk).pipe(
          catchError(err => {
            console.error(err);
            this.statusMessage.set($localize`:@@Manuscripts.Error:Ett fel har uppstått. Manuskript kunde inte hämtas.`);
            return of<Manuscript[]>([]);
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((list: Manuscript[]) => {
      this.manuscripts.set(list);
      // If loaded but empty, show "None" message (unless an error already set one)
      if (list.length === 0 && !this.statusMessage()) {
        this.statusMessage.set($localize`:@@Manuscripts.None:Inga manuskriptutskrifter.`);
      }
    });
  }

  private registerOutputEmissions() {
    // Emit outputs when user-visible selection changes (only if multiple manuscripts)
    effect(() => {
      const list = this.manuscripts();
      const m = this.selectedManuscript();

      if (Array.isArray(list) && list.length > 1 && m) {
        this.selectedMsID.emit(m.id);
        this.selectedMsName.emit(m.name);
      }
    }, { injector: this.injector });
  }

  private registerAfterRenderEffects() {
    // After-render hook: scroll to first search match
    //     Triggers only when:
    //       - manuscripts finished loading (null -> array)
    //       - searchMatches changed
    //       - textKey changed
    //     Not triggered when user just switches selected manuscript.
    afterRenderEffect({
      write: () => {
        const list = this.manuscripts();
        const matches = this.searchMatches();
        const tk = untracked(this.textKey);

        // only after data finished loading and we have matches
        if (!Array.isArray(list) || list.length === 0 || matches.length === 0) {
          return;
        }

        const key = `${tk.textItemID}|matches:${matches.join(',')}`;
        if (this._lastScrollKey !== key) {
          this._lastScrollKey = key;

          this.scrollService.scrollToFirstSearchMatch(
            this.elementRef.nativeElement,
            this.intervalTimerId
          );
        }
      }
    }, { injector: this.injector });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Public UI actions (called from template)
  // ─────────────────────────────────────────────────────────────────────────────

  toggleNormalizedManuscript() {
    this.showNormalizedMs.update(v => !v);
  }

  async selectManuscript() {
    const list = this.manuscripts();
    if (!Array.isArray(list) || list.length === 0) {
      return;
    }

    const currentId = this.selectedManuscript()?.id;

    const inputs: AlertInput[] = list.map((m: Manuscript) => ({
      type: 'radio',
      label: m.name,
      value: String(m.id),
      checked: m.id === currentId
    }));

    const buttons: AlertButton[] = [
      { text: $localize`:@@BasicActions.Cancel:Avbryt` },
      {
        text: $localize`:@@BasicActions.Ok:Ok`,
        handler: (value: string) => {
          const id = Number(value);
          if (!Number.isNaN(id)) {
            this.pickedMsId.set(id);
          }
        }
      }
    ];

    const alert = await this.alertCtrl.create({
      header: $localize`:@@Manuscripts.SelectMsDialogTitle:Välj manuskript`,
      subHeader: $localize`:@@Manuscripts.SelectMsDialogSubtitle:Manuskriptet ersätter det manuskript som visas i kolumnen där du klickade.`,
      cssClass: 'custom-select-alert',
      inputs,
      buttons
    });

    await alert.present();
  }

  openNewLegend(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const id = {
      viewType: 'legend',
      id: 'ms-legend'
    }
    this.openNewLegendView.emit(id);
  }

}
