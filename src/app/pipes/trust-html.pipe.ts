import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';


/**
 * Bypass security and trust the given value to be safe HTML.
 */
@Pipe({
  name: 'trustHtml',
  standalone: true
})
export class TrustHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);


  transform(html: string | null | undefined): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html ?? '');
  }
}
