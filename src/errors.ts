/**
 * Custom error classes for the Kaseya VSA client.
 */

/**
 * Base error class for all Kaseya VSA errors.
 */
export class KaseyaVsaError extends Error {
  /** HTTP status code (0 for non-HTTP failures). */
  readonly statusCode: number;
  /** Raw response body, if available. */
  readonly response: unknown;

  constructor(message: string, statusCode: number = 0, response?: unknown) {
    super(message);
    this.name = 'KaseyaVsaError';
    this.statusCode = statusCode;
    this.response = response;
    Object.setPrototypeOf(this, KaseyaVsaError.prototype);
  }
}

/**
 * Authentication error (401 / expired token / bad credentials).
 */
export class KaseyaVsaAuthenticationError extends KaseyaVsaError {
  constructor(message: string, statusCode: number = 401, response?: unknown) {
    super(message, statusCode, response);
    this.name = 'KaseyaVsaAuthenticationError';
    Object.setPrototypeOf(this, KaseyaVsaAuthenticationError.prototype);
  }
}

/**
 * Application-level error returned alongside HTTP 200.
 *
 * VSA's standard envelope includes `ResponseCode` and `Error` fields.
 * A non-zero `ResponseCode` or non-null `Error` indicates a business-logic
 * failure even when the HTTP status is 200 OK.
 */
export class KaseyaVsaApplicationError extends KaseyaVsaError {
  /** The VSA `ResponseCode` returned in the response envelope. */
  readonly responseCode: number;

  constructor(message: string, responseCode: number, response?: unknown) {
    super(message, 200, response);
    this.name = 'KaseyaVsaApplicationError';
    this.responseCode = responseCode;
    Object.setPrototypeOf(this, KaseyaVsaApplicationError.prototype);
  }
}

/**
 * Forbidden (403) — credentials valid but lack permission.
 */
export class KaseyaVsaForbiddenError extends KaseyaVsaError {
  constructor(message: string, response?: unknown) {
    super(message, 403, response);
    this.name = 'KaseyaVsaForbiddenError';
    Object.setPrototypeOf(this, KaseyaVsaForbiddenError.prototype);
  }
}

/**
 * Resource not found (404).
 */
export class KaseyaVsaNotFoundError extends KaseyaVsaError {
  constructor(message: string, response?: unknown) {
    super(message, 404, response);
    this.name = 'KaseyaVsaNotFoundError';
    Object.setPrototypeOf(this, KaseyaVsaNotFoundError.prototype);
  }
}

/**
 * Rate limit exceeded (429).
 */
export class KaseyaVsaRateLimitError extends KaseyaVsaError {
  /** Suggested retry delay in milliseconds (parsed from Retry-After). */
  readonly retryAfter: number;

  constructor(message: string, retryAfter: number = 5000, response?: unknown) {
    super(message, 429, response);
    this.name = 'KaseyaVsaRateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, KaseyaVsaRateLimitError.prototype);
  }
}

/**
 * Server error (500-503).
 */
export class KaseyaVsaServerError extends KaseyaVsaError {
  constructor(message: string, statusCode: number = 500, response?: unknown) {
    super(message, statusCode, response);
    this.name = 'KaseyaVsaServerError';
    Object.setPrototypeOf(this, KaseyaVsaServerError.prototype);
  }
}
