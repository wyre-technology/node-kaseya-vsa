/**
 * HTTP layer for the Kaseya VSA REST API.
 *
 * Responsibilities:
 *   - Inject the bearer token from {@link AuthManager}.
 *   - Normalize trailing slashes (VSA's 301 redirect strips Authorization).
 *   - Apply OData query params.
 *   - Unwrap the standard `{ Result, ResponseCode, Status, Error }` envelope.
 *   - Map error responses (HTTP and application-level) to typed errors.
 *   - Single-flight re-auth on 401, retry transient 5xx and 429 with backoff.
 */

import type { ResolvedConfig } from './config.js';
import type { RateLimiter } from './rate-limiter.js';
import type { AuthManager } from './auth.js';
import {
  KaseyaVsaError,
  KaseyaVsaAuthenticationError,
  KaseyaVsaApplicationError,
  KaseyaVsaForbiddenError,
  KaseyaVsaNotFoundError,
  KaseyaVsaRateLimitError,
  KaseyaVsaServerError,
} from './errors.js';

/**
 * Standard VSA response envelope.
 */
export interface VsaEnvelope<T> {
  Result?: T;
  TotalRecords?: number;
  ResponseCode?: number;
  Status?: string;
  Error?: string | null;
}

/**
 * OData query parameters supported by VSA list endpoints.
 */
export interface ODataParams {
  /** Page size (max 1000, default 100). */
  $top?: number;
  /** Number of records to skip (default 0). */
  $skip?: number;
  /** OData filter expression. */
  $filter?: string;
  /** OData orderby expression. */
  $orderby?: string;
  /** Include additional arbitrary params. */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Options for an HTTP request.
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  /** Skip envelope unwrapping (for non-standard endpoints). */
  raw?: boolean;
}

/**
 * Normalize a path so that it ends with a `/`.
 *
 * VSA returns a 301 redirect for `/api/v1.0/agents` → `/agents/` which
 * strips the Authorization header. Always send the trailing-slash form.
 *
 * Query strings are preserved; the trailing slash is inserted before `?`.
 */
export function normalizePath(path: string): string {
  if (!path.startsWith('/')) path = `/${path}`;
  const qIndex = path.indexOf('?');
  if (qIndex === -1) {
    return path.endsWith('/') ? path : `${path}/`;
  }
  const head = path.slice(0, qIndex);
  const tail = path.slice(qIndex);
  return head.endsWith('/') ? `${head}${tail}` : `${head}/${tail}`;
}

/**
 * Build a query string from a flat params object, omitting undefined values.
 */
export function buildQueryString(
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return '';
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    entries.push([key, String(value)]);
  }
  if (entries.length === 0) return '';
  const search = new URLSearchParams();
  for (const [key, value] of entries) search.append(key, value);
  return `?${search.toString()}`;
}

/**
 * Authenticated HTTP client for the Kaseya VSA API.
 */
export class HttpClient {
  private readonly config: ResolvedConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly auth: AuthManager;

  constructor(config: ResolvedConfig, rateLimiter: RateLimiter, auth: AuthManager) {
    this.config = config;
    this.rateLimiter = rateLimiter;
    this.auth = auth;
  }

  /**
   * Make an authenticated request, returning the unwrapped `Result` field.
   *
   * @param path - API path beginning with "/", relative to the configured
   *               base URL (e.g. "/assetmgmt/agents").
   */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params, raw = false } = options;
    const queryString = buildQueryString(params);
    const normalized = normalizePath(`${path}${queryString}`);
    const url = `${this.config.baseUrl}${normalized}`;
    const bodyString = body === undefined ? '' : JSON.stringify(body);
    return this.executeRequest<T>(url, method, bodyString, raw, 0, false);
  }

  /** Convenience: GET an endpoint and return the unwrapped result. */
  async get<T>(path: string, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>(path, { method: 'GET', params });
  }

  /** Convenience: POST a body and return the unwrapped result. */
  async post<T>(
    path: string,
    body?: unknown,
    params?: RequestOptions['params']
  ): Promise<T> {
    return this.request<T>(path, { method: 'POST', body, params });
  }

  private async executeRequest<T>(
    url: string,
    method: string,
    bodyString: string,
    raw: boolean,
    retryCount: number,
    isRetryAfterReauth: boolean
  ): Promise<T> {
    await this.rateLimiter.waitForSlot();

    const token = await this.auth.getToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (bodyString) headers['Content-Type'] = 'application/json';

    this.rateLimiter.recordRequest();

    const response = await fetch(url, {
      method,
      headers,
      body: bodyString || undefined,
    });

    return this.handleResponse<T>(response, url, method, bodyString, raw, retryCount, isRetryAfterReauth);
  }

  private async handleResponse<T>(
    response: Response,
    url: string,
    method: string,
    bodyString: string,
    raw: boolean,
    retryCount: number,
    isRetryAfterReauth: boolean
  ): Promise<T> {
    if (response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        return (text === '' ? ({} as T) : (text as unknown as T));
      }
      const json = (await response.json()) as VsaEnvelope<T> | T;
      if (raw) return json as T;
      return this.unwrapEnvelope<T>(json as VsaEnvelope<T>);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.clone().json();
    } catch {
      try {
        responseBody = await response.text();
      } catch {
        responseBody = undefined;
      }
    }

    switch (response.status) {
      case 401: {
        // Single-flight re-auth, then retry once.
        if (!isRetryAfterReauth) {
          this.auth.invalidate();
          await this.auth.refresh();
          return this.executeRequest<T>(url, method, bodyString, raw, retryCount, true);
        }
        throw new KaseyaVsaAuthenticationError(
          'Authentication failed after token refresh',
          401,
          responseBody
        );
      }
      case 403:
        throw new KaseyaVsaForbiddenError('Access forbidden', responseBody);
      case 404:
        throw new KaseyaVsaNotFoundError('Resource not found', responseBody);
      case 429: {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        if (this.rateLimiter.shouldRetry(retryCount)) {
          const delay = this.rateLimiter.calculateRetryDelay(retryCount, retryAfterSeconds);
          await this.sleep(delay);
          return this.executeRequest<T>(url, method, bodyString, raw, retryCount + 1, isRetryAfterReauth);
        }
        throw new KaseyaVsaRateLimitError(
          'Rate limit exceeded and max retries reached',
          (retryAfterSeconds ?? 5) * 1000,
          responseBody
        );
      }
      case 503: {
        // Transient: retry once with backoff.
        if (this.rateLimiter.shouldRetry(retryCount)) {
          await this.sleep(this.rateLimiter.calculateRetryDelay(retryCount));
          return this.executeRequest<T>(url, method, bodyString, raw, retryCount + 1, isRetryAfterReauth);
        }
        throw new KaseyaVsaServerError('Service unavailable', 503, responseBody);
      }
      default:
        if (response.status >= 500) {
          if (retryCount === 0) {
            await this.sleep(1000);
            return this.executeRequest<T>(url, method, bodyString, raw, 1, isRetryAfterReauth);
          }
          throw new KaseyaVsaServerError(
            `Server error: ${response.status} ${response.statusText}`,
            response.status,
            responseBody
          );
        }
        throw new KaseyaVsaError(
          `Request failed: ${response.status} ${response.statusText}`,
          response.status,
          responseBody
        );
    }
  }

  /**
   * Unwrap the standard VSA envelope. A non-zero `ResponseCode` or non-null
   * `Error` is treated as failure even on HTTP 200.
   */
  private unwrapEnvelope<T>(envelope: VsaEnvelope<T>): T {
    if (
      envelope &&
      typeof envelope === 'object' &&
      ('ResponseCode' in envelope || 'Result' in envelope || 'Error' in envelope)
    ) {
      const code = envelope.ResponseCode;
      if ((code !== undefined && code !== 0) || (envelope.Error !== undefined && envelope.Error !== null)) {
        throw new KaseyaVsaApplicationError(
          `VSA application error: ${envelope.Error ?? `ResponseCode=${String(code)}`}`,
          code ?? -1,
          envelope
        );
      }
      return envelope.Result as T;
    }
    return envelope as unknown as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
