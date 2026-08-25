/**
 * Main Kaseya VSA Client.
 */

import type { KaseyaVsaConfig, ResolvedConfig } from './config.js';
import { resolveConfig } from './config.js';
import { AuthManager } from './auth.js';
import { HttpClient } from './http.js';
import { RateLimiter } from './rate-limiter.js';
import { AgentsResource } from './resources/agents.js';
import { AuditResource } from './resources/audit.js';
import { PatchesResource } from './resources/patches.js';
import { ProceduresResource } from './resources/procedures.js';
import { AlarmsResource } from './resources/alarms.js';
import { TicketsResource } from './resources/tickets.js';
import { OrganizationsResource } from './resources/organizations.js';
import { MachineGroupsResource } from './resources/machine-groups.js';

/**
 * Kaseya VSA REST API Client.
 *
 * @example
 * ```typescript
 * import { KaseyaVsaClient } from '@wyre-ai/node-kaseya-vsa';
 *
 * const client = new KaseyaVsaClient({
 *   baseUrl: 'https://vsa.example.com/api/v1.0',
 *   username: process.env.VSA_USER!,
 *   password: process.env.VSA_PASS!,
 * });
 *
 * for await (const agent of client.agents.listAll({ top: 500 })) {
 *   console.log(agent.AgentId, agent.ComputerName);
 * }
 * ```
 */
export class KaseyaVsaClient {
  private readonly config: ResolvedConfig;
  private readonly rateLimiter: RateLimiter;
  private readonly auth: AuthManager;
  private readonly httpClient: HttpClient;

  /** Managed agent operations. */
  readonly agents: AgentsResource;
  /** Audit (software / hardware) operations. */
  readonly audit: AuditResource;
  /** Patch management operations. */
  readonly patches: PatchesResource;
  /** Agent procedure (automation) operations. */
  readonly procedures: ProceduresResource;
  /** Alarm operations. */
  readonly alarms: AlarmsResource;
  /** Service Desk ticket operations. */
  readonly tickets: TicketsResource;
  /** Organization operations. */
  readonly organizations: OrganizationsResource;
  /** Machine group operations. */
  readonly machineGroups: MachineGroupsResource;

  constructor(config: KaseyaVsaConfig) {
    this.config = resolveConfig(config);
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
    this.auth = new AuthManager(this.config);
    this.httpClient = new HttpClient(this.config, this.rateLimiter, this.auth);

    this.agents = new AgentsResource(this.httpClient);
    this.audit = new AuditResource(this.httpClient);
    this.patches = new PatchesResource(this.httpClient);
    this.procedures = new ProceduresResource(this.httpClient);
    this.alarms = new AlarmsResource(this.httpClient);
    this.tickets = new TicketsResource(this.httpClient);
    this.organizations = new OrganizationsResource(this.httpClient);
    this.machineGroups = new MachineGroupsResource(this.httpClient);
  }

  /** Get the resolved configuration (without re-exposing secrets unnecessarily). */
  getConfig(): Readonly<ResolvedConfig> {
    return this.config;
  }
}
