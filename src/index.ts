/**
 * @wyre-technology/node-kaseya-vsa
 *
 * Comprehensive, fully-typed Node.js/TypeScript library for the Kaseya VSA
 * REST API.
 */

// Main client
export { KaseyaVsaClient } from './client.js';

// Configuration
export type { KaseyaVsaConfig, RateLimitConfig, ResolvedConfig } from './config.js';
export { DEFAULT_RATE_LIMIT_CONFIG, normalizeBaseUrl } from './config.js';

// Errors
export {
  KaseyaVsaError,
  KaseyaVsaAuthenticationError,
  KaseyaVsaApplicationError,
  KaseyaVsaForbiddenError,
  KaseyaVsaNotFoundError,
  KaseyaVsaRateLimitError,
  KaseyaVsaServerError,
} from './errors.js';

// Auth helpers (exported for advanced users / testing)
export { AuthManager, buildLegacyAuthHeader, randomString } from './auth.js';

// HTTP helpers
export { HttpClient, normalizePath, buildQueryString } from './http.js';
export type { ODataParams, RequestOptions, VsaEnvelope } from './http.js';

// Pagination
export { PaginatedIterable, buildPaginationParams } from './pagination.js';
export type { PaginationParams } from './pagination.js';

// Resource classes (for typing)
export { AgentsResource } from './resources/agents.js';
export { AuditResource } from './resources/audit.js';
export { PatchesResource } from './resources/patches.js';
export { ProceduresResource } from './resources/procedures.js';
export { AlarmsResource } from './resources/alarms.js';
export { TicketsResource } from './resources/tickets.js';
export { OrganizationsResource } from './resources/organizations.js';
export { MachineGroupsResource } from './resources/machine-groups.js';

// Domain types
export * from './types/index.js';
