/**
 * Configuration types and defaults for the Kaseya VSA client.
 */

/**
 * Rate limiting configuration.
 *
 * VSA does not publish hard limits but throttles aggressively. Defensive
 * defaults are 120 req/min with concurrency 4.
 */
export interface RateLimitConfig {
  /** Whether rate limiting is enabled (default: true). */
  enabled: boolean;
  /** Maximum requests per window (default: 120). */
  maxRequests: number;
  /** Window duration in milliseconds (default: 60_000). */
  windowMs: number;
  /** Threshold percentage to start throttling (default: 0.8). */
  throttleThreshold: number;
  /** Default delay between retries on 429 (default: 5_000 ms). */
  retryAfterMs: number;
  /** Maximum retry attempts on rate limit / transient errors (default: 3). */
  maxRetries: number;
}

/**
 * Default rate limit configuration tuned for Kaseya VSA.
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: true,
  maxRequests: 120,
  windowMs: 60_000,
  throttleThreshold: 0.8,
  retryAfterMs: 5_000,
  maxRetries: 3,
};

/**
 * Configuration for the Kaseya VSA client.
 *
 * VSA is per-tenant: each MSP has a private base URL such as
 * `https://vsa.example.com/api/v1.0`. There is no shared default.
 *
 * Two authentication modes are supported:
 *   1. Local user — provide `username` and `password`
 *   2. Kaseya One SSO — provide `kaseyaOneToken`
 */
export interface KaseyaVsaConfig {
  /**
   * Tenant base URL. Either form is accepted and normalized:
   *   - `https://vsa.example.com`
   *   - `https://vsa.example.com/api/v1.0`
   */
  baseUrl: string;
  /** Local user — VSA username. Mutually exclusive with `kaseyaOneToken`. */
  username?: string;
  /** Local user — VSA password. Mutually exclusive with `kaseyaOneToken`. */
  password?: string;
  /** Kaseya One SSO bearer token. Mutually exclusive with `username`/`password`. */
  kaseyaOneToken?: string;
  /** Rate limiting configuration overrides. */
  rateLimit?: Partial<RateLimitConfig>;
  /**
   * Override the random-string generator used in legacy auth (testing only).
   */
  randomStringFn?: (length: number) => string;
  /**
   * Override the clock used to schedule token refresh (testing only).
   */
  now?: () => number;
}

/**
 * Resolved configuration with defaults applied.
 */
export interface ResolvedConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  kaseyaOneToken?: string;
  rateLimit: RateLimitConfig;
  randomStringFn?: (length: number) => string;
  now?: () => number;
}

/**
 * Normalize a tenant base URL by:
 *   - stripping trailing slashes
 *   - appending `/api/v1.0` when not already present
 */
export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (/\/api\/v1\.0$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api/v1.0`;
}

/**
 * Resolve a {@link KaseyaVsaConfig} by validating credentials and applying defaults.
 */
export function resolveConfig(config: KaseyaVsaConfig): ResolvedConfig {
  if (!config.baseUrl) {
    throw new Error('baseUrl is required (e.g. https://vsa.example.com/api/v1.0)');
  }

  const hasLocal = Boolean(config.username) && Boolean(config.password);
  const hasSso = Boolean(config.kaseyaOneToken);

  if (!hasLocal && !hasSso) {
    throw new Error(
      'Either (username + password) or kaseyaOneToken must be provided'
    );
  }
  if (hasLocal && hasSso) {
    throw new Error(
      'Provide either (username + password) OR kaseyaOneToken, not both'
    );
  }

  const resolved: ResolvedConfig = {
    baseUrl: normalizeBaseUrl(config.baseUrl),
    rateLimit: { ...DEFAULT_RATE_LIMIT_CONFIG, ...config.rateLimit },
  };
  if (config.username !== undefined) resolved.username = config.username;
  if (config.password !== undefined) resolved.password = config.password;
  if (config.kaseyaOneToken !== undefined) resolved.kaseyaOneToken = config.kaseyaOneToken;
  if (config.randomStringFn !== undefined) resolved.randomStringFn = config.randomStringFn;
  if (config.now !== undefined) resolved.now = config.now;
  return resolved;
}
