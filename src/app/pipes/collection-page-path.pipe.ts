import { Pipe, PipeTransform } from '@angular/core';


/**
 * Generates a routerLink path for a collection page from a
 * collection text item id. If typeOfPage argument is not
 * undefined, itemId argument must be a collection id.
 */
@Pipe({
    name: 'collectionPagePath',
    standalone: true
})
export class CollectionPagePathPipe implements PipeTransform {
    transform(itemId: string, typeOfPage?: string): any {
        switch (typeOfPage) {
            case 'cover':
                return `/collection/${itemId}/cover`;
            case 'title':
                return `/collection/${itemId}/title`;
            case 'foreword':
                return `/collection/${itemId}/foreword`;
            case 'introduction':
                return `/collection/${itemId}/introduction`;
            default:
                const idList = itemId.split(';')[0].split('_');
                if (idList.length > 1) {
                    let url = `/collection/${idList[0]}/text/${idList[1]}`;
                    if (idList.length > 2) {
                        url += `/${idList[2]}`;
                    }
                    return url;
                } else {
                    return '';
                }
        }
    }
}
