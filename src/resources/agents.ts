/**
 * Agent operations.
 */

import type { HttpClient } from '../http.js';
import type { VsaAgent } from '../types/agents.js';
import {
  PaginatedIterable,
  buildPaginationParams,
  type PaginationParams,
} from '../pagination.js';

/**
 * Operations on Kaseya VSA managed agents.
 */
export class AgentsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** List managed agents (single page). */
  async list(params?: PaginationParams): Promise<VsaAgent[]> {
    return this.httpClient.get<VsaAgent[]>('/assetmgmt/agents', buildPaginationParams(params));
  }

  /** Iterate over every agent, fetching pages on demand. */
  listAll(params?: PaginationParams): PaginatedIterable<VsaAgent> {
    return new PaginatedIterable<VsaAgent>(this.httpClient, '/assetmgmt/agents', params);
  }

  /** Get a single agent by `AgentId`. */
  async get(agentId: string | number): Promise<VsaAgent> {
    return this.httpClient.get<VsaAgent>(`/assetmgmt/agents/${encodeURIComponent(String(agentId))}`);
  }
}
