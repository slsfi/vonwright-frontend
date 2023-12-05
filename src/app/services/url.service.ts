import { Injectable } from '@angular/core';

import JsonURL from '@jsonurl/jsonurl';


@Injectable({
  providedIn: 'root',
})
export class UrlService {
    constructor() {}

    parse(text: string, impliedArray: boolean = false): any {
        return JsonURL.parse(text, {
            AQF: true,
            ...(impliedArray && { impliedArray: [] })
        });
    }

    stringify(value: any, impliedArray: boolean = false): string | undefined {
        return JsonURL.stringify(value, {
            AQF: true,
            ...(impliedArray && { impliedArray: true })
        });
    }

}
