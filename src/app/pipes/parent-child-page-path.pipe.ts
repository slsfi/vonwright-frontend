import { Pipe, PipeTransform } from '@angular/core';

import { config } from '@config';


/**
 * Generates a routerLink path to a page based on parent path
 * and child id.
 */
@Pipe({
    name: 'parentChildPagePath',
    standalone: true
})
export class ParentChildPagePathPipe implements PipeTransform {
    transform(parentPath: string, childId: string): string {
        if (parentPath === '/collection') {
            if (config.collections?.frontMatterPages?.cover) {
                return `${parentPath}/${childId}/cover`;
            } else if (config.collections?.frontMatterPages?.title) {
                return `${parentPath}/${childId}/title`;
            } else if (config.collections?.frontMatterPages?.foreword) {
                return `${parentPath}/${childId}/foreword`;
            } else if (config.collections?.frontMatterPages?.introduction) {
                return `${parentPath}/${childId}/introduction`;
            } else if (config.collections?.firstTextItem) {
                const idPath = config.collections.firstTextItem[childId]?.split('_') || [];
                if (idPath.length) {
                    idPath[0] = 'text';
                }
                return `/collection/${childId}/${idPath.join('/')}`;
            }
            return '';
        } else {
            return childId ? `${parentPath}/${childId}` : `${parentPath}`
        }
    }
}
