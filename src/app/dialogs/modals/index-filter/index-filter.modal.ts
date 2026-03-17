import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';

import { NamedEntityService } from '@services/named-entity.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'modal-index-filter',
  templateUrl: './index-filter.modal.html',
  styleUrls: ['./index-filter.modal.scss'],
  imports: [FormsModule, IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IndexFilterModal implements OnInit {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, @Input properties, local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private destroyRef = inject(DestroyRef);
  private modalCtrl = inject(ModalController);
  private namedEntityService = inject(NamedEntityService);

  @Input() activeFilters: any = undefined;
  @Input() searchType: string = '';

  filterCategoryTypes = signal<any[] | undefined>(undefined);
  filterCollections = signal<any[] | undefined>(undefined);
  filterPersonTypes = signal<any[] | undefined>(undefined);
  filterPlaceCountries = signal<any[] | undefined>(undefined);
  filterYearMax?: number;
  filterYearMin?: number;
  shouldFilterYear = signal(false);
  showLoading = signal(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle wiring
  // ─────────────────────────────────────────────────────────────────────────────
  ngOnInit() {
    if (this.activeFilters?.filterYearMin) {
      this.filterYearMin = Number(this.activeFilters.filterYearMin);
    }
    if (this.activeFilters?.filterYearMax) {
      this.filterYearMax = Number(this.activeFilters.filterYearMax);
    }

    if (this.searchType === 'persons') {
      this.shouldFilterYear.set(true);
    }
    this.setFilters();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public UI actions (called from template)
  // ─────────────────────────────────────────────────────────────────────────────
  cancel() {
    return this.modalCtrl.dismiss(null, 'close');
  }

  apply() {
    const filters: any = {};
    const filterCollections = [];
    const filterPersonTypes = [];
    const filterCategoryTypes = [];
    const filterPlaceCountries = [];

    if (this.filterYearMin) {
      filters['filterYearMin'] = this.filterYearMin;
    }
    if (this.filterYearMax) {
      filters['filterYearMax'] = this.filterYearMax;
    }

    const currentFilterCollections = this.filterCollections();
    if (currentFilterCollections) {
      for (const filter of currentFilterCollections) {
        if (filter.selected) {
          filterCollections.push(filter);
        }
      }
      filters['filterCollections'] = filterCollections;
    }

    const currentFilterPersonTypes = this.filterPersonTypes();
    if (currentFilterPersonTypes) {
      for (const filter of currentFilterPersonTypes) {
        if (filter.selected) {
          filterPersonTypes.push(filter);
        }
      }
      filters['filterPersonTypes'] = filterPersonTypes;
    }

    const currentFilterCategoryTypes = this.filterCategoryTypes();
    if (currentFilterCategoryTypes) {
      for (const filter of currentFilterCategoryTypes) {
        if (filter.selected) {
          filterCategoryTypes.push(filter);
        }
      }
      filters['filterCategoryTypes'] = filterCategoryTypes;
    }

    const currentFilterPlaceCountries = this.filterPlaceCountries();
    if (currentFilterPlaceCountries) {
      for (const filter of currentFilterPlaceCountries) {
        if (filter.selected) {
          filterPlaceCountries.push(filter);
        }
      }
      filters['filterPlaceCountries'] = filterPlaceCountries;
    }

    this.normalizePersonYearFilters(filters);
    filters['isEmpty'] = this.areFiltersEmpty(filters);

    return this.modalCtrl.dismiss(filters, 'apply');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────────
  private setFilters() {
    this.showLoading.set(true);
    const typeKey: string = (this.searchType === 'persons') ? 'filterPersonTypes'
          : (this.searchType === 'places') ? 'filterPlaceCountries'
          : 'filterCategoryTypes';

    this.namedEntityService.getFilterOptionsFromElastic(this.searchType).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(
      (res: any) => {
        const buckets = res?.aggregations?.types?.buckets;
        buckets?.forEach((cat: any) => {
          cat.name = cat.key;
          if (this.activeFilters?.[typeKey] && this.activeFilters[typeKey].length > 0) {
            for (let i = 0; i < this.activeFilters[typeKey].length; i++) {
              if (cat.name === this.activeFilters[typeKey][i].name) {
                cat.selected = true;
                break;
              } else {
                cat.selected = false;
              }
            }
          } else {
            cat.selected = false;
          }
        });
        if (this.searchType === 'persons') {
          this.filterPersonTypes.set(buckets);
        } else if (this.searchType === 'places') {
          this.filterPlaceCountries.set(buckets);
        } else if (this.searchType === 'keywords') {
          this.filterCategoryTypes.set(buckets);
        }
        this.showLoading.set(false);
      }
    );
  }

  private normalizePersonYearFilters(filters: any) {
    if (this.searchType !== 'persons') {
      return;
    }

    const d = new Date();
    if (!filters['filterYearMin'] && filters['filterYearMax']) {
      filters['filterYearMin'] = 1;
    }
    if (
      (filters['filterYearMin'] && !filters['filterYearMax']) ||
      (Number(filters['filterYearMax']) > d.getFullYear())
    ) {
      filters['filterYearMax'] = d.getFullYear();
    }
  }

  private areFiltersEmpty(filters: any): boolean {
    if (this.searchType === 'persons') {
      return (
        !filters['filterYearMin'] &&
        !filters['filterYearMax'] &&
        filters['filterPersonTypes'].length < 1
      );
    }

    if (this.searchType === 'places') {
      return filters['filterPlaceCountries'].length < 1;
    }

    if (this.searchType === 'keywords') {
      return filters['filterCategoryTypes'].length < 1;
    }

    return false;
  }

}
