import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server.js';
import { envelope } from '../mocks/handlers.js';
import { KaseyaVsaClient } from '../../src/client.js';
import {
  KaseyaVsaForbiddenError,
  KaseyaVsaNotFoundError,
  KaseyaVsaRateLimitError,
} from '../../src/errors.js';

function makeClient(): KaseyaVsaClient {
  return new KaseyaVsaClient({
    baseUrl: 'https://vsa.example.com',
    username: 'alice',
    password: 'pw',
    rateLimit: { maxRetries: 0, retryAfterMs: 1, throttleThreshold: 1.1 },
  });
}

describe('KaseyaVsaClient', () => {
  it('exposes all resource namespaces', () => {
    const c = makeClient();
    expect(c.agents).toBeDefined();
    expect(c.audit).toBeDefined();
    expect(c.patches).toBeDefined();
    expect(c.procedures).toBeDefined();
    expect(c.alarms).toBeDefined();
    expect(c.tickets).toBeDefined();
    expect(c.organizations).toBeDefined();
    expect(c.machineGroups).toBeDefined();
  });

  it('lists agents (single page)', async () => {
    const c = makeClient();
    const list = await c.agents.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]?.AgentId).toBe('1');
  });

  it('gets a single agent', async () => {
    const c = makeClient();
    const a = await c.agents.get('1');
    expect(a.AgentId).toBe('1');
    expect(a.ComputerName).toBe('pc-1');
  });

  it('lists software audit data', async () => {
    const c = makeClient();
    const sw = await c.audit.listSoftware('1');
    expect(sw[0]?.ProductName).toBe('Chrome');
  });

  it('gets hardware audit data', async () => {
    const c = makeClient();
    const hw = await c.audit.getHardware('1');
    expect(hw.Manufacturer).toBe('Dell');
  });

  it('gets patch status and triggers a deploy', async () => {
    const c = makeClient();
    const status = await c.patches.getStatus('1');
    expect(status.MissingPatches).toBe(5);
    const r = (await c.patches.deployNow('1')) as { Queued: boolean };
    expect(r.Queued).toBe(true);
  });

  it('lists procedures and runs one', async () => {
    const c = makeClient();
    const list = await c.procedures.list('1');
    expect(list[0]?.AgentProcedureId).toBe('42');
    const r = (await c.procedures.runNow('1', '42')) as { Started: boolean };
    expect(r.Started).toBe(true);
  });

  it('lists alarms', async () => {
    const c = makeClient();
    const alarms = await c.alarms.list();
    expect(alarms[0]?.AlarmState).toBe('Open');
  });

  it('lists organizations and machine groups', async () => {
    const c = makeClient();
    expect((await c.organizations.list())[0]?.OrgName).toBe('Acme');
    expect((await c.machineGroups.list())[0]?.MachineGroupName).toBe('root.acme');
  });

  it('surfaces a friendly 404 for the Service Desk endpoint when the module is missing', async () => {
    const c = makeClient();
    const err = await c.tickets.list().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(KaseyaVsaNotFoundError);
    expect((err as Error).message).toMatch(/Service Desk/i);
  });

  it('maps 404 to KaseyaVsaNotFoundError', async () => {
    const c = makeClient();
    await expect(c.agents.get('MISSING')).rejects.toBeInstanceOf(KaseyaVsaNotFoundError);
  });

  it('maps 403 to KaseyaVsaForbiddenError', async () => {
    const c = makeClient();
    await expect(c.agents.get('FORBIDDEN')).rejects.toBeInstanceOf(KaseyaVsaForbiddenError);
  });

  it('maps 429 (after retries exhausted) to KaseyaVsaRateLimitError', async () => {
    const c = makeClient();
    await expect(c.agents.get('RATE_LIMITED')).rejects.toBeInstanceOf(KaseyaVsaRateLimitError);
  });

  it('retries 429 with backoff and succeeds when permitted', async () => {
    let calls = 0;
    server.use(
      http.get('https://vsa.example.com/api/v1.0/assetmgmt/agents/77/', () => {
        calls += 1;
        if (calls === 1) {
          return HttpResponse.json({ Error: 'rate limited' }, {
            status: 429,
            headers: { 'Retry-After': '0' },
          });
        }
        return HttpResponse.json(envelope({ AgentId: '77', ComputerName: 'pc-77' }));
      })
    );

    const c = new KaseyaVsaClient({
      baseUrl: 'https://vsa.example.com',
      username: 'alice',
      password: 'pw',
      rateLimit: { maxRetries: 3, retryAfterMs: 1, throttleThreshold: 1.1 },
    });
    const a = await c.agents.get('77');
    expect(a.AgentId).toBe('77');
    expect(calls).toBe(2);
  });
});
