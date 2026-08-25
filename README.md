# @wyre-ai/node-kaseya-vsa

Comprehensive, fully-typed Node.js / TypeScript client library for the
Kaseya VSA REST API.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

## Features

- Full coverage of core VSA resources: agents, audit, patches, procedures, alarms, tickets, organizations, machine groups
- Two authentication modes: legacy local users (two-step token exchange) **and** Kaseya One SSO
- Automatic token caching with single-flight refresh on 401
- OData pagination via async iterators (`$top`, `$skip`, `$filter`, `$orderby`)
- Token-bucket rate limiting tuned for VSA's defensive defaults
- Typed error hierarchy including `KaseyaVsaApplicationError` for HTTP 200 + non-zero `ResponseCode`
- ESM and CommonJS dual exports, full `.d.ts` types
- Zero `any` in the public API

## Install

```bash
npm install @wyre-ai/node-kaseya-vsa
```

The package is published to GitHub Packages under the `@wyre-ai` scope.
Add this to a project-local `.npmrc`:

```
@wyre-ai:registry=https://npm.pkg.github.com
```

## Quick start

VSA is per-tenant: each MSP has a private base URL such as
`https://vsa.example-msp.com/api/v1.0`. **There is no shared default**; you must
provide the `baseUrl`.

```typescript
import { KaseyaVsaClient } from '@wyre-ai/node-kaseya-vsa';

// Local user (legacy) auth
const client = new KaseyaVsaClient({
  baseUrl: 'https://vsa.example-msp.com/api/v1.0',
  username: process.env.VSA_USER!,
  password: process.env.VSA_PASS!,
});

// Or Kaseya One SSO
const ssoClient = new KaseyaVsaClient({
  baseUrl: 'https://vsa.example-msp.com',
  kaseyaOneToken: process.env.KASEYA_ONE_TOKEN!,
});

// Iterate every agent, fetching pages on demand
for await (const agent of client.agents.listAll({ top: 500 })) {
  console.log(agent.AgentId, agent.ComputerName);
}
```

## Authentication

### Legacy / local users — two-step token exchange

The SDK builds the `Authorization: Basic` header automatically:

1. Generate a 20-character random nonce.
2. Compute `SHA-256( SHA-256(password+username) + nonce )` → `pass2`.
3. Compute `SHA-1( SHA-1(password+username) + nonce )` → `pass1`.
4. Send `Basic user=<u>,pass2=<sha256>,pass1=<sha1>,rand2=<nonce>` to `GET /auth`.
5. Use the returned `Result.Token` as `Authorization: Bearer <token>` on every subsequent call.

### Kaseya One SSO

When a `kaseyaOneToken` is provided, the SDK uses `GET /auth/sso` with that
token as a bearer. The response shape and refresh behavior are identical.

### Token lifecycle

- Tokens default to ~15-minute lifetime (`Token-Expires-In` is honored if returned).
- Refreshes happen ~5 minutes before expiry.
- On 401 from any non-auth call, the SDK invalidates the cache, **single-flights**
  the re-auth (so concurrent in-flight requests share one refresh), and retries
  the original request once.

## Pagination

VSA list endpoints use OData `$top` / `$skip`:

| Param      | Default | Max    |
|------------|---------|--------|
| `$top`     | 100     | 1000   |
| `$skip`    | 0       | —      |
| `$filter`  | none    | —      |
| `$orderby` | none    | —      |

Both single-page and async-iterator helpers are exposed:

```typescript
// Single page
const page = await client.agents.list({ top: 100 });

// Auto-paging iterator
for await (const agent of client.agents.listAll({ filter: "Online eq true" })) {
  // ...
}
```

## API surface

```typescript
client.agents.list({ top, skip, filter, orderby })
client.agents.listAll(params)
client.agents.get(agentId)

client.audit.listSoftware(agentId)
client.audit.getHardware(agentId)

client.patches.getStatus(agentId)
client.patches.deployNow(agentId)

client.procedures.list(agentId)
client.procedures.runNow(agentId, procId)

client.alarms.list({ filter: "AlarmState eq 'Open'" })
client.alarms.listAll(params)

client.tickets.list(params)        // 404s if Service Desk module disabled
client.tickets.listAll(params)
client.tickets.get(ticketId)

client.organizations.list(params)
client.machineGroups.list(params)
```

## Error handling

The SDK never lets the raw VSA envelope leak to the caller; it unwraps to the
`Result` field automatically and throws `KaseyaVsaApplicationError` when the
envelope reports failure (`ResponseCode != 0` or non-null `Error`) on an
otherwise-successful HTTP 200.

```typescript
import {
  KaseyaVsaError,
  KaseyaVsaAuthenticationError,
  KaseyaVsaApplicationError,
  KaseyaVsaForbiddenError,
  KaseyaVsaNotFoundError,
  KaseyaVsaRateLimitError,
  KaseyaVsaServerError,
} from '@wyre-ai/node-kaseya-vsa';

try {
  await client.agents.get('123');
} catch (err) {
  if (err instanceof KaseyaVsaRateLimitError) {
    await new Promise((r) => setTimeout(r, err.retryAfter));
  } else if (err instanceof KaseyaVsaApplicationError) {
    console.error('VSA app error', err.responseCode, err.response);
  } else {
    throw err;
  }
}
```

## Known gotchas

- **Trailing slashes.** VSA redirects `/api/v1.0/agents` → `/agents/` (HTTP 301),
  and Node's `fetch` strips the `Authorization` header on cross-origin redirect.
  The SDK normalizes every path to its trailing-slash form before sending so the
  redirect never fires.
- **Concurrent token refresh.** Multiple in-flight requests racing on a 401
  would each try to re-auth. The SDK wraps re-auth in a single-flight mutex.
- **Tenant URL forms.** Both `https://vsa.example.com` and
  `https://vsa.example.com/api/v1.0` are accepted and normalized.
- **HTTP 200 + `ResponseCode != 0`.** Treated as a business-logic failure and
  raised as `KaseyaVsaApplicationError` with VSA's `Error` field as the message.
- **Service Desk 404.** When the SD module is not enabled on the tenant, ticket
  endpoints return 404. The SDK surfaces this as a friendly
  `KaseyaVsaNotFoundError` mentioning the SD module.

## Development

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## License

Apache-2.0
