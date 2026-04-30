/**
 * MSW handlers mocking the Kaseya VSA REST API.
 *
 * All paths use the trailing-slash form because the SDK normalizes URLs
 * before sending. The base URL is `https://vsa.example.com/api/v1.0`.
 */

import { http, HttpResponse } from 'msw';

const BASE = 'https://vsa.example.com/api/v1.0';

/**
 * Wrap a payload in the standard VSA envelope.
 */
export function envelope<T>(result: T, totalRecords?: number): {
  Result: T;
  TotalRecords?: number;
  ResponseCode: number;
  Status: string;
  Error: null;
} {
  const out: {
    Result: T;
    TotalRecords?: number;
    ResponseCode: number;
    Status: string;
    Error: null;
  } = {
    Result: result,
    ResponseCode: 0,
    Status: 'Ok',
    Error: null,
  };
  if (totalRecords !== undefined) out.TotalRecords = totalRecords;
  return out;
}

/**
 * Default working auth handler — returns a token valid for 15 minutes.
 */
export const authHandlers = [
  http.get(`${BASE}/auth/`, () => {
    return HttpResponse.json(
      envelope({
        Token: 'test-token-abc',
        TokenExpires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        'Token-Expires-In': 900,
      })
    );
  }),
  http.get(`${BASE}/auth/sso/`, () => {
    return HttpResponse.json(
      envelope({
        Token: 'sso-token-xyz',
        'Token-Expires-In': 900,
      })
    );
  }),
];

export const handlers = [
  ...authHandlers,

  // Agents
  http.get(`${BASE}/assetmgmt/agents/`, ({ request }) => {
    const url = new URL(request.url);
    const top = parseInt(url.searchParams.get('$top') ?? '100', 10);
    const skip = parseInt(url.searchParams.get('$skip') ?? '0', 10);
    const all = [
      { AgentId: '1', ComputerName: 'pc-1' },
      { AgentId: '2', ComputerName: 'pc-2' },
      { AgentId: '3', ComputerName: 'pc-3' },
    ];
    return HttpResponse.json(envelope(all.slice(skip, skip + top), all.length));
  }),

  http.get(`${BASE}/assetmgmt/agents/1/`, () => {
    return HttpResponse.json(envelope({ AgentId: '1', ComputerName: 'pc-1' }));
  }),

  http.get(`${BASE}/assetmgmt/agents/MISSING/`, () => {
    return HttpResponse.json({ ResponseCode: 404, Error: 'not found' }, { status: 404 });
  }),

  http.get(`${BASE}/assetmgmt/agents/FORBIDDEN/`, () => {
    return HttpResponse.json({ Error: 'forbidden' }, { status: 403 });
  }),

  http.get(`${BASE}/assetmgmt/agents/RATE_LIMITED/`, () => {
    return HttpResponse.json(
      { Error: 'rate limited' },
      { status: 429, headers: { 'Retry-After': '0' } }
    );
  }),

  // Application-level error: HTTP 200 with a non-zero ResponseCode.
  http.get(`${BASE}/assetmgmt/agents/APPERR/`, () => {
    return HttpResponse.json({
      Result: null,
      ResponseCode: 1001,
      Status: 'Failed',
      Error: 'Something broke at the application layer',
    });
  }),

  // Audit
  http.get(`${BASE}/assetmgmt/audit/1/software/`, () => {
    return HttpResponse.json(envelope([{ ProductName: 'Chrome', Version: '120' }]));
  }),
  http.get(`${BASE}/assetmgmt/audit/1/hardware/`, () => {
    return HttpResponse.json(envelope({ Manufacturer: 'Dell', Model: 'OptiPlex' }));
  }),

  // Patches
  http.get(`${BASE}/assetmgmt/patch/status/1/`, () => {
    return HttpResponse.json(envelope({ AgentId: '1', MissingPatches: 5, InstalledPatches: 100 }));
  }),
  http.post(`${BASE}/assetmgmt/patch/1/deploypatchnow/`, () => {
    return HttpResponse.json(envelope({ Queued: true }));
  }),

  // Procedures
  http.get(`${BASE}/automation/agentprocs/1/`, () => {
    return HttpResponse.json(envelope([{ AgentProcedureId: '42', AgentProcedureName: 'Reboot' }]));
  }),
  http.post(`${BASE}/automation/agentprocs/1/42/runnow/`, () => {
    return HttpResponse.json(envelope({ Started: true }));
  }),

  // Alarms
  http.get(`${BASE}/assetmgmt/alarms/`, () => {
    return HttpResponse.json(envelope([{ AlarmId: 'a-1', AlarmState: 'Open' }]));
  }),

  // Tickets — Service Desk module disabled returns 404.
  http.get(`${BASE}/servicedesk/tickets/`, () => {
    return HttpResponse.json({ Error: 'not found' }, { status: 404 });
  }),

  // Orgs / Machine groups
  http.get(`${BASE}/system/orgs/`, () => {
    return HttpResponse.json(envelope([{ OrgId: 1, OrgName: 'Acme' }]));
  }),
  http.get(`${BASE}/system/machinegroups/`, () => {
    return HttpResponse.json(envelope([{ MachineGroupId: 1, MachineGroupName: 'root.acme' }]));
  }),
];
