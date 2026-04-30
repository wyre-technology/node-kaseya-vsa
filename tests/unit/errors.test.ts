import { describe, it, expect } from 'vitest';
import {
  KaseyaVsaError,
  KaseyaVsaAuthenticationError,
  KaseyaVsaApplicationError,
  KaseyaVsaForbiddenError,
  KaseyaVsaNotFoundError,
  KaseyaVsaRateLimitError,
  KaseyaVsaServerError,
} from '../../src/errors.js';

describe('errors', () => {
  it('all errors extend KaseyaVsaError and Error', () => {
    const cases = [
      new KaseyaVsaError('a'),
      new KaseyaVsaAuthenticationError('a'),
      new KaseyaVsaApplicationError('a', 1001),
      new KaseyaVsaForbiddenError('a'),
      new KaseyaVsaNotFoundError('a'),
      new KaseyaVsaRateLimitError('a'),
      new KaseyaVsaServerError('a'),
    ];
    for (const e of cases) {
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(KaseyaVsaError);
    }
  });

  it('application error preserves the response code', () => {
    const e = new KaseyaVsaApplicationError('boom', 1001);
    expect(e.responseCode).toBe(1001);
    expect(e.statusCode).toBe(200);
  });

  it('rate limit error preserves retryAfter', () => {
    const e = new KaseyaVsaRateLimitError('slow', 7000);
    expect(e.retryAfter).toBe(7000);
    expect(e.statusCode).toBe(429);
  });
});
