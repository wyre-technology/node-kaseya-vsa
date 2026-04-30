/**
 * Auth tests — header construction, token caching/refresh, single-flight,
 * SSO path, and error mapping.
 */

import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createHash } from 'node:crypto';
import { server } from '../mocks/server.js';
import { envelope } from '../mocks/handlers.js';
import { AuthManager, buildLegacyAuthHeader, randomString } from '../../src/auth.js';
import { resolveConfig } from '../../src/config.js';
import { KaseyaVsaAuthenticationError } from '../../src/errors.js';

describe('buildLegacyAuthHeader', () => {
  it('builds the Basic header with deterministic SHA-256/SHA-1 hashes', () => {
    const username = 'alice';
    const password = 'p@ssw0rd';
    const nonce = 'AAAAAAAAAAAAAAAAAAAA';
    const header = buildLegacyAuthHeader(username, password, nonce);

    const sha256Inner = createHash('sha256').update(password + username).digest('hex');
    const sha256Hash = createHash('sha256').update(sha256Inner + nonce).digest('hex');
    const sha1Inner = createHash('sha1').update(password + username).digest('hex');
    const sha1Hash = createHash('sha1').update(sha1Inner + nonce).digest('hex');

    expect(header).toBe(
      `Basic user=${username},pass2=${sha256Hash},pass1=${sha1Hash},rand2=${nonce}`
    );
  });

  it('changes when any input changes', () => {
    const a = buildLegacyAuthHeader('u', 'p', 'A');
    expect(buildLegacyAuthHeader('u2', 'p', 'A')).not.toBe(a);
    expect(buildLegacyAuthHeader('u', 'p2', 'A')).not.toBe(a);
    expect(buildLegacyAuthHeader('u', 'p', 'B')).not.toBe(a);
  });
});

describe('randomString', () => {
  it('produces alphanumeric strings of the requested length', () => {
    const s = randomString(20);
    expect(s).toHaveLength(20);
    expect(s).toMatch(/^[A-Za-z0-9]{20}$/);
  });
});

describe('AuthManager — local user', () => {
  it('fetches a token via /auth and caches it', async () => {
    let calls = 0;
    server.use(
      http.get('https://vsa.example.com/api/v1.0/auth/', ({ request }) => {
        calls += 1;
        expect(request.headers.get('authorization')).toMatch(/^Basic user=alice,pass2=/);
        return HttpResponse.json(
          envelope({ Token: 'tok-1', 'Token-Expires-In': 900 })
        );
      })
    );

    const config = resolveConfig({
      baseUrl: 'https://vsa.example.com',
      username: 'alice',
      password: 'pw',
      randomStringFn: () => 'A'.repeat(20),
    });
    const auth = new AuthManager(config);

    expect(await auth.getToken()).toBe('tok-1');
    expect(await auth.getToken()).toBe('tok-1'); // cached, no second call
    expect(calls).toBe(1);
  });

  it('refreshes when the token is near expiry', async () => {
    let issued = 0;
    server.use(
      http.get('https://vsa.example.com/api/v1.0/auth/', () => {
        issued += 1;
        return HttpResponse.json(
          envelope({ Token: `tok-${issued}`, 'Token-Expires-In': 900 })
        );
      })
    );

    let nowMs = 1_000_000_000_000;
    const config = resolveConfig({
      baseUrl: 'https://vsa.example.com',
      username: 'alice',
      password: 'pw',
      randomStringFn: () => 'A'.repeat(20),
      now: () => nowMs,
    });
    const auth = new AuthManager(config);

    expect(await auth.getToken()).toBe('tok-1');
    // Advance to within the 5-minute leeway → triggers refresh.
    nowMs += 14 * 60 * 1000;
    expect(await auth.getToken()).toBe('tok-2');
    expect(issued).toBe(2);
  });

  it('single-flights concurrent refresh calls', async () => {
    let issued = 0;
    server.use(
      http.get('https://vsa.example.com/api/v1.0/auth/', async () => {
        issued += 1;
        await new Promise((r) => setTimeout(r, 10));
        return HttpResponse.json(envelope({ Token: `tok-${issued}`, 'Token-Expires-In': 900 }));
      })
    );

    const config = resolveConfig({
      baseUrl: 'https://vsa.example.com',
      username: 'alice',
      password: 'pw',
    });
    const auth = new AuthManager(config);

    const [a, b, c] = await Promise.all([auth.getToken(), auth.getToken(), auth.getToken()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(issued).toBe(1);
  });

  it('throws KaseyaVsaAuthenticationError on bad credentials', async () => {
    server.use(
      http.get('https://vsa.example.com/api/v1.0/auth/', () =>
        HttpResponse.json({ Error: 'bad creds' }, { status: 401 })
      )
    );
    const config = resolveConfig({
      baseUrl: 'https://vsa.example.com',
      username: 'alice',
      password: 'pw',
    });
    const auth = new AuthManager(config);
    await expect(auth.getToken()).rejects.toBeInstanceOf(KaseyaVsaAuthenticationError);
  });
});

describe('AuthManager — Kaseya One SSO', () => {
  it('uses /auth/sso with the Kaseya One bearer token', async () => {
    const captured = vi.fn<(req: Request) => void>();
    server.use(
      http.get('https://vsa.example.com/api/v1.0/auth/sso/', ({ request }) => {
        captured(request);
        return HttpResponse.json(envelope({ Token: 'sso-1', 'Token-Expires-In': 900 }));
      })
    );

    const config = resolveConfig({
      baseUrl: 'https://vsa.example.com',
      kaseyaOneToken: 'k1-token',
    });
    const auth = new AuthManager(config);
    expect(await auth.getToken()).toBe('sso-1');
    expect(captured).toHaveBeenCalledOnce();
    const req = captured.mock.calls[0]![0];
    expect(req.headers.get('authorization')).toBe('Bearer k1-token');
  });
});
