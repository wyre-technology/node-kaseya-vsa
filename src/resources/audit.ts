/**
 * Audit (software/hardware inventory) operations.
 */

import type { HttpClient } from '../http.js';
import type { VsaSoftwareItem, VsaHardwareInfo } from '../types/audit.js';

/**
 * Operations on agent audit data.
 */
export class AuditResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** List installed software for an agent. */
  async listSoftware(agentId: string | number): Promise<VsaSoftwareItem[]> {
    return this.httpClient.get<VsaSoftwareItem[]>(
      `/assetmgmt/audit/${encodeURIComponent(String(agentId))}/software`
    );
  }

  /** Get hardware audit data for an agent. */
  async getHardware(agentId: string | number): Promise<VsaHardwareInfo> {
    return this.httpClient.get<VsaHardwareInfo>(
      `/assetmgmt/audit/${encodeURIComponent(String(agentId))}/hardware`
    );
  }
}
