import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { config } from '@config';


@Component({
  selector: 'page-ebook',
  templateUrl: './ebook.page.html',
  styleUrls: ['./ebook.page.scss'],
})
export class EbookPage implements OnInit {
  ebookType: string = '';
  filename: string = '';
  title: string = '';

  constructor(
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.filename = '';
      this.ebookType = '';
      const availableEbooks: any[] = config.ebooks ?? [];
      for (const ebook of availableEbooks) {
        if (ebook.filename === params.filename) {
          this.filename = ebook.filename;
          this.title = ebook.title;
          this.ebookType = this.filename.substring(
            this.filename.lastIndexOf('.') + 1, this.filename.length
          ) || '';
          break;
        }
      }
    });
  }

}
