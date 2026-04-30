/**
 * Agent procedure (automation) operations.
 */

import type { HttpClient } from '../http.js';
import type { VsaAgentProcedure } from '../types/procedures.js';

/**
 * Operations on agent procedures.
 */
export class ProceduresResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** List agent procedures available for the given agent. */
  async list(agentId: string | number): Promise<VsaAgentProcedure[]> {
    return this.httpClient.get<VsaAgentProcedure[]>(
      `/automation/agentprocs/${encodeURIComponent(String(agentId))}`
    );
  }

  /** Run an agent procedure against an agent now. */
  async runNow(agentId: string | number, procId: string | number): Promise<unknown> {
    return this.httpClient.post(
      `/automation/agentprocs/${encodeURIComponent(String(agentId))}/${encodeURIComponent(String(procId))}/runnow`
    );
  }
}
