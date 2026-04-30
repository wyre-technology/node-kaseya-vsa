/**
 * Patch management operations.
 */

import type { HttpClient } from '../http.js';
import type { VsaPatchStatus } from '../types/patches.js';

/**
 * Operations on patch status / deployment.
 */
export class PatchesResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** Get patch status for an agent. */
  async getStatus(agentId: string | number): Promise<VsaPatchStatus> {
    return this.httpClient.get<VsaPatchStatus>(
      `/assetmgmt/patch/status/${encodeURIComponent(String(agentId))}`
    );
  }

  /** Trigger an immediate patch deployment for an agent. */
  async deployNow(agentId: string | number): Promise<unknown> {
    return this.httpClient.post(
      `/assetmgmt/patch/${encodeURIComponent(String(agentId))}/deploypatchnow`
    );
  }
}
