import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { marked } from 'marked';

import { config } from '@config';


@Injectable({
  providedIn: 'root',
})
export class MarkdownContentService {
  private apiURL: string = '';

  constructor(
    private http: HttpClient
  ) {
    const apiBaseURL = config.app?.backendBaseURL ?? '';
    const projectName = config.app?.projectNameDB ?? '';
    this.apiURL = apiBaseURL + '/' + projectName;
  }

  getMdContent(fileID: string): Observable<any> {
    const endpoint = `${this.apiURL}/md/${fileID}`;
    return this.http.get(endpoint);
  }

  getMenuTree(language: string, rootNodeID: string): Observable<any> {
    const endpoint = `${this.apiURL}/static-pages-toc/${language}`;
    return this.http.get(endpoint).pipe(
      map((res: any) => {
        if (language && rootNodeID) {
          res = this.getNodeById(`${language}-${rootNodeID}`, res);
        } else {
          res = res.children[0].children;
        }
        res.id = this.stripLocaleFromID(res.id);
        this.stripLocaleFromAboutPagesIDs(res.children);
        return res;
      }),
      catchError((e) => {
        return of({});
      })
    );
  }

  getParsedMd(md: string): string {
    return marked.parse(md) as string;
  }

  /**
   * Find a node by id in a JSON tree
   */
  private getNodeById(id: any, tree: any) {
    const reduce = [].reduce;
    const runner: any = (result: any, node: any) => {
      if (result || !node) {
        return result;
      }
      return (
        (node.id === id && node) ||
        runner(null, node.children) ||
        reduce.call(Object(node), runner, result)
      );
    };
    return runner(null, tree);
  }

  private stripLocaleFromAboutPagesIDs(array: any[]) {
    for (let i = 0; i < array.length; i++) {
      array[i]['id'] = this.stripLocaleFromID(array[i]['id']);
      if (array[i]['children']?.length) {
        this.stripLocaleFromAboutPagesIDs(array[i]['children']);
      }
    }
  }

  private stripLocaleFromID(id: string) {
    return id.slice(id.indexOf('-') + 1);
  }

}
