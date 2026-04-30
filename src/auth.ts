/**
 * Authentication for the Kaseya VSA REST API.
 *
 * Two paths are supported:
 *
 * 1. Local user — two-step token exchange:
 *    - Build a Basic auth header containing SHA-256 and SHA-1 hashes of
 *      `password+username` mixed with a per-request random nonce.
 *    - GET `/auth` with that header. The response body has a `Token` field;
 *      subsequent calls send `Authorization: Bearer <token>`.
 *
 * 2. Kaseya One SSO:
 *    - GET `/auth/sso` with `Authorization: Bearer <kaseyaOneToken>`.
 *    - Same response shape; same caching/refresh behavior.
 *
 * Tokens default to ~15 minutes. Cache and refresh ~5 minutes before expiry.
 * On a 401 from any non-auth call, run a single-flight re-auth and retry once.
 */

import { createHash } from 'node:crypto';
import type { ResolvedConfig } from './config.js';
import { KaseyaVsaAuthenticationError, KaseyaVsaError } from './errors.js';

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** Refresh tokens this many milliseconds before expiry. */
const REFRESH_LEEWAY_MS = 5 * 60 * 1000;
/** Fallback token lifetime when the server omits an expiry hint. */
const DEFAULT_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

/**
 * Generate a random alphanumeric string of the given length (≥10 in practice).
 */
export function randomString(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHANUM.charAt(Math.floor(Math.random() * ALPHANUM.length));
  }
  return out;
}

/**
 * Build the legacy `Authorization: Basic` header value for the two-step
 * token exchange.
 *
 * Format: `Basic user=<u>,pass2=<sha256>,pass1=<sha1>,rand2=<nonce>`
 */
export function buildLegacyAuthHeader(
  username: string,
  password: string,
  nonce: string
): string {
  const sha256Inner = createHash('sha256').update(password + username).digest('hex');
  const sha256Hash = createHash('sha256').update(sha256Inner + nonce).digest('hex');
  const sha1Inner = createHash('sha1').update(password + username).digest('hex');
  const sha1Hash = createHash('sha1').update(sha1Inner + nonce).digest('hex');
  return `Basic user=${username},pass2=${sha256Hash},pass1=${sha1Hash},rand2=${nonce}`;
}

/**
 * Shape of the `/auth` and `/auth/sso` envelope, abbreviated to the fields
 * the SDK uses.
 */
interface AuthEnvelope {
  Result?: {
    Token?: string;
    TokenExpires?: string;
    'Token-Expires-In'?: number | string;
  };
  ResponseCode?: number;
  Status?: string;
  Error?: string | null;
}

/**
 * Parse an auth response and return token + absolute expiry timestamp.
 */
function parseAuthEnvelope(envelope: AuthEnvelope, now: number): {
  token: string;
  expiresAt: number;
} {
  if (envelope.ResponseCode !== undefined && envelope.ResponseCode !== 0) {
    throw new KaseyaVsaAuthenticationError(
      `Authentication failed: ${envelope.Error ?? 'unknown error'}`,
      401,
      envelope
    );
  }
  const result = envelope.Result;
  const token = result?.Token;
  if (!token) {
    throw new KaseyaVsaAuthenticationError(
      'Authentication response did not include a Token',
      401,
      envelope
    );
  }
  let expiresAt = now + DEFAULT_TOKEN_LIFETIME_MS;
  const expiresIn = result?.['Token-Expires-In'];
  if (typeof expiresIn === 'number' && expiresIn > 0) {
    expiresAt = now + expiresIn * 1000;
  } else if (typeof expiresIn === 'string') {
    const parsed = parseInt(expiresIn, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      expiresAt = now + parsed * 1000;
    }
  } else if (typeof result?.TokenExpires === 'string') {
    const t = Date.parse(result.TokenExpires);
    if (Number.isFinite(t)) expiresAt = t;
  }
  return { token, expiresAt };
}

/**
 * Manages bearer-token acquisition and refresh for the VSA client.
 *
 * Caches the current token. Refreshes ~5 minutes before expiry.
 * Single-flights concurrent refreshes via a shared promise so multiple
 * in-flight requests racing on a 401 only trigger one auth call.
 */
export class AuthManager {
  private readonly config: ResolvedConfig;
  private token: string | null = null;
  private expiresAt = 0;
  private inflight: Promise<string> | null = null;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /** The clock used for refresh decisions. */
  private now(): number {
    return (this.config.now ?? Date.now)();
  }

  /**
   * Get a valid bearer token, refreshing if missing or near-expiry.
   * Concurrent callers share a single in-flight refresh.
   */
  async getToken(): Promise<string> {
    if (this.token && this.now() < this.expiresAt - REFRESH_LEEWAY_MS) {
      return this.token;
    }
    return this.refresh();
  }

  /**
   * Force a refresh. Concurrent callers share the same in-flight promise.
   */
  async refresh(): Promise<string> {
    if (this.inflight) return this.inflight;
    this.inflight = this.doRefresh()
      .catch((err: unknown) => {
        // Reset so a subsequent call can retry from a clean state.
        this.token = null;
        this.expiresAt = 0;
        throw err;
      })
      .finally(() => {
        this.inflight = null;
      }) as Promise<string>;
    return this.inflight;
  }

  /** Invalidate the cached token (e.g. on a 401 from a downstream call). */
  invalidate(): void {
    this.token = null;
    this.expiresAt = 0;
  }

  private async doRefresh(): Promise<string> {
    if (this.config.kaseyaOneToken) {
      return this.refreshSso(this.config.kaseyaOneToken);
    }
    if (!this.config.username || !this.config.password) {
      throw new KaseyaVsaAuthenticationError(
        'No credentials configured for authentication'
      );
    }
    return this.refreshLocal(this.config.username, this.config.password);
  }

  private async refreshLocal(username: string, password: string): Promise<string> {
    const rand = (this.config.randomStringFn ?? randomString)(20);
    const authHeader = buildLegacyAuthHeader(username, password, rand);
    const url = `${this.config.baseUrl}/auth/`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });
    return this.handleAuthResponse(response);
  }

  private async refreshSso(kaseyaOneToken: string): Promise<string> {
    const url = `${this.config.baseUrl}/auth/sso/`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${kaseyaOneToken}`,
        Accept: 'application/json',
      },
    });
    return this.handleAuthResponse(response);
  }

  private async handleAuthResponse(response: Response): Promise<string> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new KaseyaVsaAuthenticationError(
          `Authentication failed: ${response.status} ${response.statusText}`,
          response.status,
          body
        );
      }
      throw new KaseyaVsaError(
        `Authentication request failed: ${response.status} ${response.statusText}`,
        response.status,
        body
      );
    }
    const { token, expiresAt } = parseAuthEnvelope(body as AuthEnvelope, this.now());
    this.token = token;
    this.expiresAt = expiresAt;
    return token;
  }
}
