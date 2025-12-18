import { Directive, ElementRef, OnChanges, inject, input } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';

import { config } from '@config';
import { isBrowser } from '@utility-functions';


declare var MathJax: {
  Hub: {
    Queue: (param: Object[]) => void
  }
}

@Directive({
  standalone: true,
  selector: '[MathJax]'
})
export class MathJaxDirective implements OnChanges {
  private elRef = inject(ElementRef);

  readonly mathJaxInput = input<string | SafeHtml | null>(null, { alias: "MathJax" });

  readonly mathJaxEnabled: boolean = config.collections?.enableMathJax ?? false;

  ngOnChanges() {
    if (isBrowser() && this.mathJaxEnabled && this.mathJaxInput()) {
      try {
        // Tell the MathJax-processor to convert any TeX notated math in this.elRef.nativeElement
        MathJax.Hub.Queue(['Typeset', MathJax.Hub, this.elRef.nativeElement]);
      } catch (e) {
        console.error('MathJax error', e);
      }
    }
  }

}
