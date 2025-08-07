import { Pipe, PipeTransform } from '@angular/core';


@Pipe({
  name: 'arrayIncludes',
  standalone: true
})
export class ArrayIncludesPipe implements PipeTransform {
/**
 * Angular pipe to check if a given value exists in an array using `includes()`.
 *
 * This pipe runs only when the array or the value changes.
 * It is useful in templates to avoid repeated direct calls to `array.includes(value)`,
 * which can be inefficient during frequent change detection cycles.
 *
 * Usage:
 *   `array | arrayIncludes:value`
 *
 * Example:
 *   `[class.selected]="selectedItems | arrayIncludes:item.id"`
 *
 * @param array The array to search.
 * @param value The value to check for presence in the array.
 * @returns `true` if the value is included in the array, otherwise `false`.
 */
  transform(array: any[] | null | undefined, value: any): boolean {
    return !!array?.includes(value);
  }
}
