import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { IonicModule } from '@ionic/angular';
import { catchError, of, switchMap, tap } from 'rxjs';

import { PublicationMetadata } from '@models/metadata.models';
import { CollectionContentService } from '@services/collection-content.service';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'text-metadata',
  templateUrl: './metadata.component.html',
  styleUrls: ['./metadata.component.scss'],
  imports: [IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetadataComponent {
  // ─────────────────────────────────────────────────────────────────────────────
  // Dependency injection, Input/Output signals, Fields, Local state signals
  // ─────────────────────────────────────────────────────────────────────────────
  private collectionContentService = inject(CollectionContentService);
  private destroyRef = inject(DestroyRef);
  private activeLocale = inject(LOCALE_ID);

  readonly publicationID = input.required<string>();

  error = signal(false);
  publicationMetadata = signal<PublicationMetadata | null>(null);


  // ─────────────────────────────────────────────────────────────────────────────
  // Constructor: Load data
  // ─────────────────────────────────────────────────────────────────────────────
  constructor() {
    toObservable(this.publicationID).pipe(
      tap(() => {
        // new load → show spinner and clear error
        this.publicationMetadata.set(null);
        this.error.set(false);
      }),
      switchMap((id) =>
        this.collectionContentService.getMetadata(id, this.activeLocale).pipe(
          catchError((err) => {
            console.error('Error loading metadata', err);
            this.error.set(true);
            // keep metadata = null so the template shows the error block
            return of<PublicationMetadata | null>(null);
          })
        )
      ),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((meta) => {
      if (meta) {
        this.publicationMetadata.set(meta);
      }
    });
  }

}
