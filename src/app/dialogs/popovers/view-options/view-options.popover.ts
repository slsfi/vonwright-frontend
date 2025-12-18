import { ChangeDetectionStrategy, Component, Input, OnInit, computed, inject } from '@angular/core';
import { IonicModule, PopoverController } from '@ionic/angular';

import { config } from '@config';
import { Textsize, ViewFlags } from '@models/view-options.models';
import { ViewOptionsService } from '@services/view-options.service';


type FlagKey = keyof ViewFlags;
const ALL_FLAG_KEYS = [
  'comments',
  'personInfo',
  'abbreviations',
  'placeInfo',
  'workInfo',
  'emendations',
  'normalisations',
  'paragraphNumbering',
  'pageBreakOriginal',
  'pageBreakEdition',
] as const satisfies readonly FlagKey[];

function isFlagKey(k: string): k is FlagKey {
  return (ALL_FLAG_KEYS as readonly string[]).includes(k);
}

@Component({
  selector: 'popover-view-options',
  templateUrl: './view-options.popover.html',
  styleUrls: ['./view-options.popover.scss'],
  imports: [IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewOptionsPopover implements OnInit {
  private popoverCtrl = inject(PopoverController);
  protected viewOptionsService = inject(ViewOptionsService);

  /** Which toggles are visible in this popover (overrides config). */
  @Input() toggles?: Partial<Record<FlagKey, boolean>>;

  /** Base availability from config; overridden by @Input if provided. */
  availableToggles: Partial<Record<FlagKey, boolean>> =
    (config.page?.text?.viewOptions as Partial<Record<FlagKey, boolean>>) ?? {};

  showVariationTypeOption: boolean = config.page?.text?.variantViewOptions?.showVariationTypeOption ?? false;

  /** List of keys actually shown in this instance (derived). */
  availableKeys: FlagKey[] = [];

  /** Static count of visible toggles; used for the “Select all” UI. */
  togglesCounter = 0;

  /** Reactive count of checked (true) flags among the visible keys. */
  checkedCount = computed(() => {
    const flags = this.viewOptionsService.show();
    let n = 0;
    for (const k of this.availableKeys) {
      if (flags[k]) n++;
    }
    return n;
  });

  ngOnInit() {
    // If the parent provided explicit visibility, use that; otherwise fall back to config.
    if (this.toggles && Object.keys(this.toggles).length > 0) {
      this.availableToggles = this.toggles;
    }

    // Build list of visible keys, type-safe.
    this.availableKeys = (Object.entries(this.availableToggles) as [string, boolean][])
      .filter(([k, show]) => isFlagKey(k) && !!show)
      .map(([k]) => k as FlagKey);

    this.togglesCounter = this.availableKeys.length;

    // Collection text page special-case: if input toggles are provided, hide the variation type UI.
    // The collection text page is the only page where variant view options
    // should be possibly shown, here we are assuming it's the only page that
    // does not define the input toggles.
    if (this.toggles !== undefined && this.showVariationTypeOption) {
      this.showVariationTypeOption = false;
    }
  }

  close() {
    this.popoverCtrl.dismiss();
  }

  /** Toggle all visible flags on/off. */
  toggleAll(e: any) {
    const checked: boolean = !!e?.detail?.checked;
    const patch: Partial<ViewFlags> = {};
    for (const k of this.availableKeys) {
      patch[k] = checked;
    }
    this.viewOptionsService.updateShow(patch);
  }

  /** Toggle a single flag. */
  onToggle(key: FlagKey, checked: boolean) {
    this.viewOptionsService.setShow(key, checked);
  }

  setTextSize(size: Textsize) {
    this.viewOptionsService.setTextsize(size);
  }

  setSelectedVariationType(event: any) {
    const value = event?.detail?.value;
    if (value) {
      this.viewOptionsService.setVariationType(value);
    }
  }

}
