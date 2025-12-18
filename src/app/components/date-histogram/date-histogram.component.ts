import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { YearBucket, YearRange } from '@models/elastic-search.models';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Year-based histogram:
 * - Input: all years (yearsAll) & current-filter years (years)
 * - Output: { from: 'YYYY', to: 'YYYY' } | null
 */
@Component({
  selector: 'date-histogram',
  templateUrl: './date-histogram.component.html',
  styleUrls: ['./date-histogram.component.scss'],
  imports: [NgClass, FormsModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateHistogramComponent {
  // --- Inputs & outputs (signal-based) ------------------------------

  /** Selected year range coming from parent (e.g. { from: '1847', to: '1868' }). */
  readonly selectedRange = input<YearRange | null>(null);

  /**
   * Buckets for the currently filtered results.
   * Example: [{ key_as_string: '1847', doc_count: 3 }, ...]
   */
  readonly years = input<YearBucket[] | undefined>();

  /**
   * Buckets for all results (unfiltered histogram).
   * Used as base for the padded histogram (decade boundaries).
   */
  readonly yearsAll = input<YearBucket[] | undefined>();

  /**
   * Emits whenever the user picks a new year range or clears it.
   * Emits either { from: 'YYYY', to: 'YYYY' } or null.
   */
  readonly rangeChange = output<YearRange | null>();

  // --- Internal signals --------------------------------------------

  /** From year (as string "YYYY"). */
  readonly from = signal<string | null>(null);

  /** To year (as string "YYYY"). */
  readonly to = signal<string | null>(null);

  /**
   * Max doc_count_current, used for relative bar widths,
   * derived from paddedYearsAll.
   * */
  readonly max = computed<number>(() => {
    const padded = this.paddedYearsAll();
    let m = 0;
    for (const y of padded) {
      const c = y.doc_count_current ?? 0;
      if (c > m) m = c;
    }
    return m;
  });

  /**
   * Padded and merged year buckets:
   * - copies yearsAll()
   * - pads to decade boundaries
   */
  readonly paddedYearsAll = computed<YearBucket[]>(() => {
    const all = this.yearsAll() ?? [];
    if (!all.length) return [];

    const base: YearBucket[] = all.map((y) => ({
      key: y.key,
      key_as_string: y.key_as_string,
      doc_count: y.doc_count,
      doc_count_current: 0,
    }));

    let firstYear = Number(base[0].key_as_string);
    let lastYear = Number(base[base.length - 1].key_as_string);

    if (Number.isNaN(firstYear) || Number.isNaN(lastYear)) {
      return base;
    }

    const padded: YearBucket[] = [...base];

    // pad backwards to decade
    while (firstYear % 10 !== 0) {
      firstYear -= 1;
      padded.unshift({
        key: firstYear,
        key_as_string: String(firstYear),
        doc_count: 0,
        doc_count_current: 0,
      });
    }

    // pad forwards to decade
    while (lastYear % 10 !== 0) {
      lastYear += 1;
      padded.push({
        key: lastYear,
        key_as_string: String(lastYear),
        doc_count: 0,
        doc_count_current: 0,
      });
    }

    // merge current counts
    const current = this.years() ?? [];
    const currentMap = new Map<string, number>();
    current.forEach((y) =>
      currentMap.set(y.key_as_string, y.doc_count ?? 0)
    );

    padded.forEach((y) => {
      y.doc_count_current = currentMap.get(y.key_as_string) ?? 0;
    });

    return padded;
  });

  /** First year (real data, not padded). Mainly for potential future UI. */
  readonly firstYear = computed<string | undefined>(() => {
    const all = this.yearsAll() ?? [];
    return all.length ? all[0].key_as_string : undefined;
  });

  /** Last year (real data, not padded). */
  readonly lastYear = computed<string | undefined>(() => {
    const all = this.yearsAll() ?? [];
    return all.length ? all[all.length - 1].key_as_string : undefined;
  });

  // --- Effects -----------------------------------------------------

  constructor() {
    // Sync incoming selectedRange → local from/to
    effect(() => {
      const sel = this.selectedRange();
      if (sel && sel.from && sel.to) {
        this.from.set(sel.from);
        this.to.set(sel.to);
      } else {
        this.from.set(null);
        this.to.set(null);
      }
    });
  }

  // --- Public API used from template -------------------------------

  reset() {
    this.from.set(null);
    this.to.set(null);
    this.rangeChange.emit(null);
  }

  getYearRelativeToMax(year: YearBucket): string {
    const max = this.max();
    if (!max) return '0%';
    const current = year.doc_count_current ?? 0;
    return `${Math.floor((current / max) * 100)}%`;
  }

  isDecade(year: YearBucket): boolean {
    const y = parseInt(year.key_as_string || '', 10);
    return !Number.isNaN(y) && y % 10 === 0;
  }

  selectYear(selected: YearBucket) {
    const year = selected.key_as_string;
    const from = this.from();
    const to = this.to();

    if (!from) {
      this.from.set(year);
      this.to.set(null);
    } else if (!to && parseInt(year, 10) >= parseInt(from, 10)) {
      this.to.set(year);
    } else {
      // Restart range
      this.from.set(year);
      this.to.set(null);
    }

    this.emitIfValidRange();
  }

  isYearInRange(year: YearBucket): boolean {
    const from = this.from();
    const to = this.to();
    const yearStr = year.key_as_string || '';
    const y = parseInt(yearStr, 10);

    // Highlight endpoints even if only one side is selected
    if (yearStr === from || yearStr === to) {
      return true;
    }

    // If both ends are set, highlight the entire range
    if (from && to) {
      const fromYear = parseInt(from, 10);
      const toYear = parseInt(to, 10);

      if (
        Number.isNaN(fromYear) ||
        Number.isNaN(toYear) ||
        Number.isNaN(y)
      ) {
        return false;
      }

      return y >= fromYear && y <= toYear;
    }

    return false;
  }

  updateYearFrom(event: any) {
    const value: string | undefined = event?.detail?.value;
    if (!value) return;

    const to = this.to();
    if (!to || parseInt(value, 10) > parseInt(to, 10)) {
      this.from.set(value);
      this.to.set(null);
    } else {
      this.from.set(value);
    }
    this.emitIfValidRange();
  }

  updateYearTo(event: any) {
    const value: string | undefined = event?.detail?.value;
    if (!value) return;

    const from = this.from();
    if (!from || parseInt(value, 10) < parseInt(from, 10)) {
      this.to.set(value);
      this.from.set(null);
    } else {
      this.to.set(value);
    }
    this.emitIfValidRange();
  }

  // --- Helpers -----------------------------------------------------

  private emitIfValidRange() {
    const from = this.from();
    const to = this.to();
    if (!from || !to) return;

    const fromYear = parseInt(from, 10);
    const toYear = parseInt(to, 10);

    if (!Number.isNaN(fromYear) && !Number.isNaN(toYear) && fromYear <= toYear) {
      this.rangeChange.emit({ from, to });
    }
  }
}
