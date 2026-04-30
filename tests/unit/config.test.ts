import { describe, it, expect } from 'vitest';
import { resolveConfig, normalizeBaseUrl, DEFAULT_RATE_LIMIT_CONFIG } from '../../src/config.js';

describe('normalizeBaseUrl', () => {
  it('appends /api/v1.0 when missing', () => {
    expect(normalizeBaseUrl('https://vsa.example.com')).toBe('https://vsa.example.com/api/v1.0');
  });

  it('preserves /api/v1.0 if already present', () => {
    expect(normalizeBaseUrl('https://vsa.example.com/api/v1.0')).toBe(
      'https://vsa.example.com/api/v1.0'
    );
  });

  it('strips trailing slashes', () => {
    expect(normalizeBaseUrl('https://vsa.example.com/api/v1.0/')).toBe(
      'https://vsa.example.com/api/v1.0'
    );
    expect(normalizeBaseUrl('https://vsa.example.com//')).toBe('https://vsa.example.com/api/v1.0');
  });
});

describe('resolveConfig', () => {
  it('requires baseUrl', () => {
    expect(() =>
      resolveConfig({ baseUrl: '', username: 'u', password: 'p' })
    ).toThrow(/baseUrl/);
  });

  it('requires either local creds or SSO token', () => {
    expect(() => resolveConfig({ baseUrl: 'https://vsa.example.com' })).toThrow();
  });

  it('rejects providing both local creds and SSO token', () => {
    expect(() =>
      resolveConfig({
        baseUrl: 'https://vsa.example.com',
        username: 'u',
        password: 'p',
        kaseyaOneToken: 'tok',
      })
    ).toThrow(/not both/i);
  });

  it('merges rate limit overrides with defaults', () => {
    const c = resolveConfig({
      baseUrl: 'https://vsa.example.com',
      username: 'u',
      password: 'p',
      rateLimit: { maxRequests: 60 },
    });
    expect(c.rateLimit.maxRequests).toBe(60);
    expect(c.rateLimit.windowMs).toBe(DEFAULT_RATE_LIMIT_CONFIG.windowMs);
  });
});
