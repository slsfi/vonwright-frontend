import { Pipe, PipeTransform } from '@angular/core';


/**
 * Generates a position queryParam for a collection page from a
 * collection text item id.
 */
@Pipe({
    name: 'collectionPagePositionQueryparam',
    standalone: true
})
export class CollectionPagePositionQueryparamPipe implements PipeTransform {
    transform(itemId: string): any {
        const idList = itemId.split(';');
        if (idList.length > 1) {
            return {
                position: idList[1]
            }
        }
        return;
    }
}
