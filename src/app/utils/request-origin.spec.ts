import { config } from '../../project/config';
import {
  getConfiguredSiteHostname,
  getConfiguredSiteOrigin,
  getRequestOrigin,
  getRequestRenderUrl
} from './request-origin';
import type { OriginRequest, RenderRequest } from './request-origin';

function createRequest(
  headers: OriginRequest['headers'] = { host: 'localhost:4201' },
  protocol = 'http',
  originalUrl = '/fi/collection/203/introduction?view=readingtext'
): RenderRequest {
  return { headers, protocol, originalUrl };
}

describe('SSR public-origin resolution', () => {
  let originalSiteOrigin: unknown;

  beforeEach(() => {
    originalSiteOrigin = config.app.siteURLOrigin;
    config.app.siteURLOrigin = 'https://edition.example';
  });

  afterEach(() => {
    config.app.siteURLOrigin = originalSiteOrigin;
  });

  it('normalizes a host-only configured origin to HTTPS', () => {
    config.app.siteURLOrigin = 'EDITION.EXAMPLE:8443';

    expect(getConfiguredSiteOrigin()).toBe('https://edition.example:8443');
    expect(getConfiguredSiteHostname()).toBe('edition.example');
  });

  it('uses only the origin from a configured URL with a path and query', () => {
    config.app.siteURLOrigin = 'https://edition.example:8443/path?query=1';

    expect(getConfiguredSiteOrigin()).toBe('https://edition.example:8443');
  });

  for (const invalidOrigin of [undefined, null, 42, '', '   ', 'https://[']) {
    it(`ignores invalid configured origin ${String(invalidOrigin)}`, () => {
      config.app.siteURLOrigin = invalidOrigin;

      expect(getConfiguredSiteOrigin()).toBeUndefined();
      expect(getConfiguredSiteHostname()).toBeUndefined();
    });
  }

  it('keeps the configured HTTPS origin for a matching direct public host', () => {
    expect(getRequestOrigin(createRequest({ host: 'edition.example' })))
      .toBe('https://edition.example');
  });

  it('prefers the configured origin over an internal forwarded HTTP protocol', () => {
    const request = createRequest({
      host: 'internal.example:4201',
      'x-forwarded-host': 'edition.example',
      'x-forwarded-proto': 'http'
    });

    expect(getRequestOrigin(request)).toBe('https://edition.example');
    expect(getRequestRenderUrl(request))
      .toBe('https://edition.example/fi/collection/203/introduction?view=readingtext');
  });

  it('matches the configured hostname case-insensitively and preserves its port', () => {
    config.app.siteURLOrigin = 'https://edition.example:8443';

    expect(getRequestOrigin(createRequest({ host: 'EDITION.EXAMPLE:4201' })))
      .toBe('https://edition.example:8443');
  });

  it('uses the first forwarded host and protocol from proxy header chains', () => {
    const request = createRequest({
      host: 'internal.example:4201',
      'x-forwarded-host': [' proxy.example:8443, internal.example', 'ignored.example'],
      'x-forwarded-proto': [' https, http', 'http']
    });

    expect(getRequestOrigin(request)).toBe('https://proxy.example:8443');
  });

  it('uses the Host header when the forwarded host is empty', () => {
    expect(getRequestOrigin(createRequest({ host: 'localhost:4201', 'x-forwarded-host': ' ' })))
      .toBe('http://localhost:4201');
  });

  it('uses the configured protocol for an unknown non-local host without forwarding', () => {
    expect(getRequestOrigin(createRequest({ host: 'preview.example:4201' })))
      .toBe('https://preview.example:4201');
  });

  for (const host of ['localhost:4201', '127.0.0.1:4201', '[::1]:4201']) {
    it(`preserves the direct local protocol and port for ${host}`, () => {
      expect(getRequestOrigin(createRequest({ host }))).toBe(`http://${host}`);
      expect(getRequestOrigin(createRequest({ host }, 'https'))).toBe(`https://${host}`);
    });
  }

  it('honors forwarded HTTPS for a local proxy request', () => {
    expect(getRequestOrigin(createRequest({ host: 'localhost:4201', 'x-forwarded-proto': 'https' })))
      .toBe('https://localhost:4201');
  });

  it('falls back to the request protocol when the configured origin is absent', () => {
    config.app.siteURLOrigin = undefined;

    expect(getRequestOrigin(createRequest({ host: 'preview.example' }, 'http')))
      .toBe('http://preview.example');
  });

  it('returns no origin when the request or host is missing', () => {
    expect(getRequestOrigin()).toBeUndefined();
    expect(getRequestOrigin(null)).toBeUndefined();
    expect(getRequestOrigin(createRequest({}))).toBeUndefined();
  });

  it('preserves locale prefixes, query strings, and escaped characters in the render URL', () => {
    const request = createRequest({ host: 'localhost:4201' }, 'http', '/fi/about/a%20b?search=a%2Bb');

    expect(getRequestRenderUrl(request)).toBe('http://localhost:4201/fi/about/a%20b?search=a%2Bb');
  });

  it('falls back to localhost and HTTP when request host and protocol are missing', () => {
    expect(getRequestRenderUrl(createRequest({}, '', '/sv/?query=1')))
      .toBe('http://localhost/sv/?query=1');
  });
});
