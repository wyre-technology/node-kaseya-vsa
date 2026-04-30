/**
 * HTTP layer integration tests.
 */

import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import { envelope } from '../mocks/handlers.js';
import { normalizePath, buildQueryString } from '../../src/http.js';
import { KaseyaVsaClient } from '../../src/client.js';
import { KaseyaVsaApplicationError } from '../../src/errors.js';

describe('normalizePath', () => {
  it('appends a trailing slash', () => {
    expect(normalizePath('/agents')).toBe('/agents/');
    expect(normalizePath('/agents/')).toBe('/agents/');
  });

  it('preserves the slash before query strings', () => {
    expect(normalizePath('/agents?$top=10')).toBe('/agents/?$top=10');
    expect(normalizePath('/agents/?$top=10')).toBe('/agents/?$top=10');
  });

  it('adds a leading slash when missing', () => {
    expect(normalizePath('agents')).toBe('/agents/');
  });
});

describe('buildQueryString', () => {
  it('returns empty string for nothing', () => {
    expect(buildQueryString()).toBe('');
    expect(buildQueryString({})).toBe('');
  });

  it('omits undefined params', () => {
    expect(buildQueryString({ a: 1, b: undefined })).toBe('?a=1');
  });

  it('encodes OData $-prefixed params correctly', () => {
    const out = buildQueryString({ $top: 50, $filter: "AlarmState eq 'Open'" });
    expect(out).toContain('%24top=50');
    expect(out).toContain('%24filter=');
  });
});

describe('HTTP wire behavior', () => {
  function makeClient(): KaseyaVsaClient {
    return new KaseyaVsaClient({
      baseUrl: 'https://vsa.example.com',
      username: 'alice',
      password: 'pw',
      rateLimit: { maxRetries: 0, retryAfterMs: 1, throttleThreshold: 1.1 },
    });
  }

  it('sends Authorization: Bearer <token> on resource requests', async () => {
    let captured: string | null = null;
    server.use(
      http.get('https://vsa.example.com/api/v1.0/assetmgmt/agents/', ({ request }) => {
        captured = request.headers.get('authorization');
        return HttpResponse.json(envelope([]));
      })
    );
    const c = makeClient();
    await c.agents.list();
    expect(captured).toBe('Bearer test-token-abc');
  });

  it('normalizes the path to include a trailing slash', async () => {
    let pathSeen: string | null = null;
    server.use(
      http.get('https://vsa.example.com/api/v1.0/assetmgmt/agents/', ({ request }) => {
        pathSeen = new URL(request.url).pathname;
        return HttpResponse.json(envelope([]));
      })
    );
    const c = makeClient();
    await c.agents.list();
    expect(pathSeen).toBe('/api/v1.0/assetmgmt/agents/');
  });

  it('unwraps the VSA envelope and returns Result', async () => {
    const c = makeClient();
    const list = await c.agents.list({ top: 100 });
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]?.AgentId).toBe('1');
  });

  it('maps non-zero ResponseCode (HTTP 200) to KaseyaVsaApplicationError', async () => {
    const c = makeClient();
    await expect(c.agents.get('APPERR')).rejects.toBeInstanceOf(KaseyaVsaApplicationError);
  });

  it('refreshes auth on 401 and retries the original request once', async () => {
    let firstCallReturned401 = false;
    server.use(
      http.get('https://vsa.example.com/api/v1.0/assetmgmt/agents/', () => {
        if (!firstCallReturned401) {
          firstCallReturned401 = true;
          return HttpResponse.json({ Error: 'expired' }, { status: 401 });
        }
        return HttpResponse.json(envelope([{ AgentId: '99' }]));
      })
    );
    const c = makeClient();
    const list = await c.agents.list();
    expect(list[0]?.AgentId).toBe('99');
    expect(firstCallReturned401).toBe(true);
  });
});
