import { Pipe, PipeTransform } from '@angular/core';


/**
 * Returns true if the URL is external, i.e. includes site origin.
 */
@Pipe({
  name: 'isExternalURL',
  standalone: true
})
export class IsExternalURLPipe implements PipeTransform {
  transform(url: string | undefined): boolean {
    return (String(url).indexOf('://') > 0 || String(url).indexOf('//') === 0);
  }
}
