import { Injectable, signal } from '@angular/core';

import { config } from '@config';
import { Textsize, VariationType, ViewFlags } from '@models/view-options.models';


@Injectable({
  providedIn: 'root',
})
export class ViewOptionsService {
  readonly selectedVariationType = signal<VariationType>(
    (() => {
      const v = config.page?.text?.variantViewOptions?.defaultVariationType;
      return v === 'sub' || v === 'none' ? v : 'all';
    })()
  );
  
  readonly show = signal<ViewFlags>({
    comments: false,
    personInfo: false,
    abbreviations: false,
    placeInfo: false,
    workInfo: false,
    emendations: false,
    normalisations: false,
    paragraphNumbering: false,
    pageBreakOriginal: false,
    pageBreakEdition: false,
  });

  readonly textsize = signal<Textsize>('small');

  constructor() {
    // Apply defaults from config immutably
    const defaults: string[] = config.page?.text?.defaultViewOptions ?? [];
    if (defaults.length) {
      this.show.update(s => {
        // 1) clone the previous value so we return a NEW object (important for change detection)
        const next = { ...s };
        // 2) iterate the list of default option keys from config
        for (const key of defaults) {
          // 3) if this key exists on the flags object…
          if (key in next) {
            // 4) …set it to true
            (next as any)[key] = true;
          }
        }
        // 5) return the new object → signal value changes → template updates
        return next;
      });
    }
  }

  /**
   * Merges a partial set of flags into the current view flags.
   * Uses an immutable update so the signal emits and OnPush templates refresh.
   *
   * @param patch Subset of {@link ViewFlags} to override (e.g. `{ comments: true }`).
   *
   * @example
   * updateShow({ comments: true, workInfo: false });
   */
  updateShow(patch: Partial<ViewFlags>) {
    this.show.update(s => ({ ...s, ...patch }));
  }

  /**
   * Sets a single view flag to a specific value.
   * Immutable update ensures change detection in OnPush components.
   *
   * @typeParam K - A key of {@link ViewFlags}.
   * @param key   The flag name (e.g. `"comments"`).
   * @param value The new boolean value for that flag.
   *
   * @example
   * setShow('comments', true);
   */
  setShow<K extends keyof ViewFlags>(key: K, value: ViewFlags[K]) {
    this.show.update(s => ({ ...s, [key]: value }));
  }

  /**
   * Toggles a single view flag.
   * Equivalent to `setShow(key, !currentValue)`; performed immutably.
   *
   * @typeParam K - A key of {@link ViewFlags}.
   * @param key   The flag name to toggle.
   *
   * @example
   * toggleShow('comments');
   */
  toggleShow<K extends keyof ViewFlags>(key: K) {
    this.show.update(s => ({ ...s, [key]: !s[key] }));
  }

  setTextsize(size: Textsize) {
    this.textsize.set(size);
  }

  setVariationType(v: VariationType) {
    this.selectedVariationType.set(v);
  }

}
