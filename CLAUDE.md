# node-kaseya-vsa

Node.js/TypeScript SDK for the Kaseya VSA REST API.

## Project info

- **GitHub**: https://github.com/wyre-technology/node-kaseya-vsa
- **Package**: `@wyre-technology/node-kaseya-vsa` (GitHub Packages)
- **Sister SDKs**: [`node-datto-bcdr`](https://github.com/wyre-technology/node-datto-bcdr), [`node-datto-rmm`](https://github.com/wyre-technology/node-datto-rmm)

## Architecture

- `src/client.ts` — composition root (`KaseyaVsaClient`)
- `src/config.ts` — config resolution, baseUrl normalization, rate-limit defaults
- `src/auth.ts` — `AuthManager` with both legacy (SHA-256/SHA-1 + nonce) and Kaseya One SSO paths
- `src/http.ts` — fetch + envelope unwrapping + single-flight 401 retry + error mapping
- `src/rate-limiter.ts` — sliding-window limiter (120/min default)
- `src/pagination.ts` — `PaginatedIterable` for OData `$top`/`$skip` async iteration
- `src/resources/*.ts` — one class per API entity
- `src/types/*.ts` — domain types (intentionally permissive — `[key: string]: unknown` on most interfaces)

## Auth model gotchas

- Per-tenant `baseUrl` is required; both `https://vsa.example.com` and `https://vsa.example.com/api/v1.0` are accepted.
- Legacy auth: `Basic user=<u>,pass2=<sha256(sha256(pw+u)+rand)>,pass1=<sha1(sha1(pw+u)+rand)>,rand2=<rand>` to `/auth`.
- SSO: `Authorization: Bearer <kaseyaOneToken>` to `/auth/sso`.
- Token cached, refreshed ~5 min before expiry; concurrent refresh single-flighted.
- 401 on any non-auth call invalidates the cache, refreshes once, retries the original call once.
- HTTP 200 + non-zero `ResponseCode` (or non-null `Error`) → `KaseyaVsaApplicationError`. The SDK never returns the raw envelope.
- All paths normalized to trailing-slash form before fetch (VSA's 301 strips `Authorization`).

## Build / test

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
```

## Release

Pushes to `main` trigger semantic-release via `.github/workflows/release.yml`,
which publishes to GitHub Packages.
