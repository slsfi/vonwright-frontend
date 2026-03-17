import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { AUTH_ENABLED } from '@tokens/auth.tokens';


export interface ResolvedFacsimileImageSrc {
  src: string;
  objectURL: string | null;
}

export interface ResolveFacsimileImageSrcOptions {
  onFetchError?: (error: unknown) => void;
}

/**
 * Platform-agnostic image source resolver for facsimile images.
 *
 * Why this abstraction exists:
 * - Browser: authenticated image URLs may need HttpClient + interceptors.
 * - Server (SSR): always return plain URLs and avoid browser-only APIs.
 *
 * Platform-specific implementations are provided in AppModule/AppServerModule.
 */
export abstract class FacsimileImageService {
  abstract resolveImageSrc(
    imageURL: string | null,
    options?: ResolveFacsimileImageSrcOptions
  ): Observable<ResolvedFacsimileImageSrc>;

  abstract revokeObjectURL(objectURL: string | null): void;
}

@Injectable()
export class BrowserFacsimileImageService extends FacsimileImageService {
  private readonly http = inject(HttpClient);
  private readonly authEnabled = inject(AUTH_ENABLED);

  /**
   * Resolve the image source to bind in templates.
   *
   * Why this exists:
   * - `<img [src]="url">` performs a native browser image request, which does not go
   *   through Angular `HttpClient` interceptors, so auth headers are not attached.
   * - For authenticated image endpoints we instead fetch via `HttpClient` (so the
   *   auth interceptor can attach the bearer token), convert to a blob URL, and bind
   *   that object URL to `<img>`.
   * - For SSR and auth-disabled projects, plain URL assignment is preferred.
   */
  override resolveImageSrc(
    imageURL: string | null,
    options?: ResolveFacsimileImageSrcOptions
  ): Observable<ResolvedFacsimileImageSrc> {
    if (!imageURL) {
      return of({ src: '', objectURL: null });
    }

    if (!this.authEnabled) {
      return of({ src: imageURL, objectURL: null });
    }

    return this.http.get(imageURL, { responseType: 'blob' }).pipe(
      map((blob: Blob) => {
        const objectURL = URL.createObjectURL(blob);
        return { src: objectURL, objectURL };
      }),
      catchError((error: unknown) => {
        options?.onFetchError?.(error);
        return of({ src: imageURL, objectURL: null });
      })
    );
  }

  /**
   * Revoke previously created blob URLs to avoid leaking browser memory.
   */
  override revokeObjectURL(objectURL: string | null): void {
    if (objectURL) {
      URL.revokeObjectURL(objectURL);
    }
  }
}

@Injectable()
export class ServerFacsimileImageService extends FacsimileImageService {
  override resolveImageSrc(
    imageURL: string | null,
    _options?: ResolveFacsimileImageSrcOptions
  ): Observable<ResolvedFacsimileImageSrc> {
    return of({ src: imageURL ?? '', objectURL: null });
  }

  override revokeObjectURL(_objectURL: string | null): void {}
}
