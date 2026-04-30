import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import { envelope } from '../mocks/handlers.js';
import { buildPaginationParams } from '../../src/pagination.js';
import { KaseyaVsaClient } from '../../src/client.js';

describe('buildPaginationParams', () => {
  it('returns empty for nothing', () => {
    expect(buildPaginationParams()).toEqual({});
  });

  it('maps to OData $-prefixed keys', () => {
    expect(
      buildPaginationParams({ top: 50, skip: 100, filter: "x eq 'y'", orderby: 'name' })
    ).toEqual({
      $top: 50,
      $skip: 100,
      $filter: "x eq 'y'",
      $orderby: 'name',
    });
  });
});

describe('PaginatedIterable', () => {
  it('iterates across multiple pages until a short page is returned', async () => {
    server.use(
      http.get('https://vsa.example.com/api/v1.0/assetmgmt/agents/', ({ request }) => {
        const url = new URL(request.url);
        const skip = parseInt(url.searchParams.get('$skip') ?? '0', 10);
        const top = parseInt(url.searchParams.get('$top') ?? '100', 10);
        const all = Array.from({ length: 5 }, (_v, i) => ({ AgentId: String(i + 1) }));
        const slice = all.slice(skip, skip + top);
        return HttpResponse.json(envelope(slice, all.length));
      })
    );

    const c = new KaseyaVsaClient({
      baseUrl: 'https://vsa.example.com',
      username: 'alice',
      password: 'pw',
      rateLimit: { maxRetries: 0, throttleThreshold: 1.1 },
    });
    const ids: string[] = [];
    for await (const a of c.agents.listAll({ top: 2 })) {
      ids.push(String(a.AgentId));
    }
    expect(ids).toEqual(['1', '2', '3', '4', '5']);
  });
});
