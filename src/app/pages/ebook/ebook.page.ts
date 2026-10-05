import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { Subscription } from 'rxjs';

import { PdfViewerComponent } from '@components/pdf-viewer/pdf-viewer.component';
import { config } from '@config';
import { Ebook } from '@models/ebook.models';
import { splitFilename } from '@utility-functions';


@Component({
  selector: 'page-ebook',
  templateUrl: './ebook.page.html',
  styleUrls: ['./ebook.page.scss'],
  imports: [IonContent, PdfViewerComponent]
})
export class EbookPage implements OnDestroy, OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly ebookType = signal('');
  readonly filename = signal('');
  routeParamsSubscr: Subscription | null = null;
  title: string = '';

  ngOnInit() {
    const availableEbooks: Ebook[] = config.ebooks ?? [];

    this.routeParamsSubscr = this.route.params.subscribe(params => {
      if (params.filename && !params.type && !params.name) {
        // Legacy route -> redirect to correct route
        const filenameparts = splitFilename(params.filename);
        if (filenameparts.extension) {
          this.router.navigate(
            ['/ebook', filenameparts.extension, filenameparts.name],
            { replaceUrl: true }
          );
        }
      } else {
        const requestedFilename = `${params.name}.${params.type}`;
        const reqEbook = availableEbooks.find(ebook => ebook.filename === requestedFilename);
        this.filename.set(reqEbook?.filename ?? '');
        this.title = reqEbook?.title ?? '';
        this.ebookType.set(params.type);
      }
    });
  }

  ngOnDestroy() {
    this.routeParamsSubscr?.unsubscribe();
  }

}
