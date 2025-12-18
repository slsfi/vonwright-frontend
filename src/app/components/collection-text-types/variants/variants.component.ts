import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterRenderEffect, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { AlertButton, AlertController, AlertInput, IonicModule } from '@ionic/angular';
import { catchError, of, switchMap, tap } from 'rxjs';

import { config } from '@config';
import { TextKey } from '@models/collection.models';
import { Variant } from '@models/variant.models';
import { TrustHtmlPipe } from '@pipes/trust-html.pipe';
import { CollectionContentService } from '@services/collection-content.service';
import { HtmlParserService } from '@services/html-parser.service';
import { ScrollService } from '@services/scroll.service';
import { ViewOptionsService } from '@services/view-options.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'variants',
  templateUrl: './variants.component.html',
  styleUrls: ['./variants.component.scss'],
  imports: [IonicModule, TrustHtmlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VariantsComponent {
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

  readonly searchMatches = input<string[]>([]);
  readonly sortOrder = input<number | undefined>();
  readonly textKey = input.required<TextKey>();
  readonly varID = input<number | undefined>();
  readonly openNewLegendView = output<any>();
  readonly openNewVarView = output<any>();
  readonly selectedVarID = output<number>();
  readonly selectedVarName = output<string>();
  readonly selectedVarSortOrder = output<number>();

  readonly showOpenLegendButton: boolean = config.component?.variants?.showOpenLegendButton ?? false;

  intervalTimerId: number = 0;
  private _lastScrollKey: string | null = null;

  variants = signal<Variant[] | null>(null);
  private pickedVarId = signal<number | undefined>(undefined);
  private statusMessage = signal<string | null>(null);


  // ─────────────────────────────────────────────────────────────────────────────
  // Derived computeds (pure, no side-effects)
  // ─────────────────────────────────────────────────────────────────────────────

  selectedVariant = computed<Variant | undefined>(() => {
    const list = this.variants();
    if (!Array.isArray(list) || list.length === 0) {
      return undefined;
    }

    // precedence: picked → varID input → sortOrder input → first
    const picked = this.pickedVarId();
    if (picked !== undefined) {
      return list.find(v => v.id === picked) ?? list[0];
    }

    const byId = this.varID();
    if (byId != undefined) {
      return list.find(v => v.id === byId) ?? list[0];
    }

    const byOrder = this.sortOrder();
    if (byOrder != undefined) {
      return list.find(v => v.sortOrder === byOrder) ?? list[0];
    }

    return list[0];
  });

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

    // Loading state: variants === null → spinner in template
    const list = this.variants();
    if (list === null) {
      return undefined;
    }

    const v = this.selectedVariant();
    // No variants (handled above with a message), but defend anyway
    if (!v) {
      return '';
    }

    // Compose final HTML
    const post = this.parserService.postprocessVariantText(v.html);
    return this.parserService.insertSearchMatchTags(post, this.searchMatches());
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: wire side effects (data load, emits, after-render hook)
  // ─────────────────────────────────────────────────────────────────────────────

  constructor() {
    this.loadVariants();
    this.registerOutputEmissions();
    this.registerAfterRenderEffects();
  }

  private loadVariants() {
    // Load variants when textKey changes
    toObservable(this.textKey).pipe(
      tap(() => {
        // reset state for a new load
        this.variants.set(null);
        this.statusMessage.set(null);
        this.pickedVarId.set(undefined);
        this._lastScrollKey = null;
      }),
      switchMap((tk: TextKey) =>
        this.collectionContentService.getVariants(tk).pipe(
          catchError(err => {
            console.error(err);
            this.statusMessage.set($localize`:@@Variants.Error:Ett fel har uppstått. Varianter kunde inte laddas.`);
            return of<Variant[]>([]);
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((list: Variant[]) => {
      this.variants.set(list);
      // If loaded but empty, show "None" message (unless an error already set one)
      if (list.length === 0 && !this.statusMessage()) {
        this.statusMessage.set($localize`:@@Variants.None:Inga tryckta varianter tillgängliga.`);
      }
    });
  }

  private registerOutputEmissions() {
    // Emit outputs when user-visible selection changes (only if multiple variants)
    effect(
      () => {
        const list = this.variants();
        const v = this.selectedVariant();

        if (Array.isArray(list) && list.length > 1 && v) {
          this.selectedVarID.emit(v.id);
          this.selectedVarName.emit(v.name);
          this.selectedVarSortOrder.emit(v.sortOrder);
        }
      },
      { injector: this.injector }
    );
  }

  private registerAfterRenderEffects() {
    // (c) After-render hook: scroll to first search match
    //     Triggers only when:
    //       - variants finished loading (null -> array)
    //       - searchMatches changed
    //       - textKey changed
    //     Not triggered when user just switches selected variant.
    afterRenderEffect({
      write: () => {
        const list = this.variants();
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
      },
    }, { injector: this.injector });
  }


  // ─────────────────────────────────────────────────────────────────────────────
  // Public UI actions (called from template)
  // ─────────────────────────────────────────────────────────────────────────────

  async selectVariant() {
    const list = this.variants();
    if (!Array.isArray(list) || list.length === 0) {
      return;
    }

    const currentId = this.selectedVariant()?.id;

    const inputs: AlertInput[] = list.map((v: Variant) => ({
      type: 'radio',
      label: v.name,
      value: String(v.id),
      checked: v.id === currentId,
    }));

    const buttons: AlertButton[] = [
      { text: $localize`:@@BasicActions.Cancel:Avbryt` },
      {
        text: $localize`:@@BasicActions.Ok:Ok`,
        handler: (value: string) => {
          const id = Number(value);
          if (!Number.isNaN(id)) {
            this.pickedVarId.set(id);
          }
        },
      },
    ];

    const alert = await this.alertCtrl.create({
      header: $localize`:@@Variants.SelectVariantDialogTitle:Välj variant`,
      subHeader: $localize`:@@Variants.SelectVariantDialogSubtitle:Varianten ersätter den variant som visas i kolumnen där du klickade.`,
      cssClass: 'custom-select-alert',
      inputs,
      buttons,
    });

    await alert.present();
  }

  async selectVariantForNewView() {
    const list = this.variants();
    if (!Array.isArray(list) || list.length === 0) {
      return;
    }

    const inputs: AlertInput[] = list.map((v: Variant) => ({
      type: 'radio',
      label: v.name,
      value: String(v.id),
    }));

    const buttons: AlertButton[] = [
      { text: $localize`:@@BasicActions.Cancel:Avbryt` },
      {
        text: $localize`:@@BasicActions.Ok:Ok`,
        handler: (value: string) => {
          const id = Number(value);
          if (Number.isNaN(id)) {
            return;
          }
          const v = list.find(x => x.id === id);
          if (!v) {
            return;
          }
          this.openNewVariant(v);
        },
      },
    ];

    const alert = await this.alertCtrl.create({
      header: $localize`:@@Variants.OpenNewVariantDialogTitle:Välj variant`,
      subHeader: $localize`:@@Variants.OpenNewVariantDialogSubtitle:Varianten öppnas i en ny kolumn.`,
      cssClass: 'custom-select-alert',
      inputs,
      buttons,
    });

    await alert.present();
  }

  openNewLegend(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const id = {
      viewType: 'legend',
      id: 'var-legend'
    }
    this.openNewLegendView.emit(id);
  }

  openNewVariant(variant: Variant) {
    this.openNewVarView.emit({ ...variant, viewType: 'variants' });
  }

}
