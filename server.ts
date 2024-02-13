/***************************************************************************************************
 * Load `$localize` onto the global scope - used if i18n tags appear in Angular templates.
 */
import '@angular/localize/init';
import 'zone.js/node';
import { LOCALE_ID } from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import * as express from 'express';
import { existsSync } from 'fs';
import { join } from 'path';

import AppServerModule from './src/main.server';
import { environment } from './src/environments/environment';
import { REQUEST } from './src/express.tokens';

// The Express app is exported so that it can be used by serverless Functions.
export function app(lang: string): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), `dist/app/browser/${lang}`);
  const staticHtmlFolder = join(process.cwd(), `dist/app/browser/${lang}/static-html`);
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? join(distFolder, 'index.original.html')
    : join(distFolder, 'index.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Serve static files from /static-html
  server.use('/static-html', express.static(staticHtmlFolder, {
    fallthrough: true // Allows the request to continue to the next middleware if no file is found
  }));

  // Handle 404 for /static-html, this is to prevent the built-in Angular wildcard route for
  // 404 pages from handling missing files in the path
  server.use('/static-html', (req, res) => {
    res.status(404).send('File not found');
  });

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Angular engine
  server.get('*', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    // * Inlining critical CSS is disabled here and in angular.json:
    // * architect.build.configurations.production.optimization.styles.inlineCritical
    commonEngine
      .render({
        bootstrap: AppServerModule,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        inlineCriticalCss: false,
        publicPath: distFolder,
        providers: [
          { provide: APP_BASE_HREF, useValue: baseUrl },
          { provide: LOCALE_ID, useValue: lang },
          { provide: REQUEST, useValue: req }
        ],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

// * In production mode, the server is started by proxy-server.js
// * and this function is never run.
function runDev(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const appSv = app('sv');
  const server = express();
  server.use('/sv', appSv);
  server.use('', appSv);
  server.listen(port, () => {
    console.log(`Node Express dev server listening on http://localhost:${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
// * This is run ONLY in development mode!
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (
  !environment.production &&
  (moduleFilename === __filename || moduleFilename.includes('iisnode'))
) {
  runDev();
}

export * from './src/main.server';
