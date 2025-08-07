import { Pipe, PipeTransform } from '@angular/core';


@Pipe({
  name: 'arrayIncludesAny',
  standalone: true
})
export class ArrayIncludesAnyPipe implements PipeTransform {
  /**
   * Angular pipe to check if **any** value in a list exists in a target array using `includes()`.
   *
   * This is a more efficient and cleaner alternative to writing repeated OR conditions like:
   * `array.includes(a) || array.includes(b)` in templates.
   *
   * The pipe runs only when the array or the list of values changes.
   *
   * Usage:
   *   `array | arrayIncludesAny:[value1, value2, ...]`
   *
   * Example:
   *   `[class.open]="selectedMenu | arrayIncludesAny:[item.itemId, item.nodeId]"`
   *
   * @param array The array to search.
   * @param values An array of values to check for presence in the array.
   * @returns `true` if any value from `values` is included in `array`, otherwise `false`.
   */
  transform(array: any[] | null | undefined, values: any[] | null | undefined): boolean {
    if (!array || !values || !values.length) return false;
    return values.some(v => array.includes(v));
  }
}
