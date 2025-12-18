import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { config } from '@config';
import { splitFilename } from '@utility-functions';


@Component({
  selector: 'page-ebook',
  templateUrl: './ebook.page.html',
  styleUrls: ['./ebook.page.scss'],
  standalone: false
})
export class EbookPage implements OnDestroy, OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  ebookType: string = '';
  filename: string = '';
  routeParamsSubscr: Subscription | null = null;
  title: string = '';

  ngOnInit() {
    const availableEbooks: any[] = config.ebooks ?? [];

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
        this.filename = '';
        this.title = '';
        this.ebookType = '';
        for (const ebook of availableEbooks) {
          const requestedFilename = `${params.name}.${params.type}`;

          if (ebook.filename === requestedFilename) {
            this.filename = ebook.filename;
            this.title = ebook.title;
            this.ebookType = params.type;
            break;
          }
        }
      }
    });
  }

  ngOnDestroy() {
    this.routeParamsSubscr?.unsubscribe();
  }

}
