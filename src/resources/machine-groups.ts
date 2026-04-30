/**
 * Machine group operations.
 */

import type { HttpClient } from '../http.js';
import type { VsaMachineGroup } from '../types/machine-groups.js';
import {
  PaginatedIterable,
  buildPaginationParams,
  type PaginationParams,
} from '../pagination.js';

/**
 * Operations on machine groups.
 */
export class MachineGroupsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** List machine groups (single page). */
  async list(params?: PaginationParams): Promise<VsaMachineGroup[]> {
    return this.httpClient.get<VsaMachineGroup[]>(
      '/system/machinegroups',
      buildPaginationParams(params)
    );
  }

  /** Iterate every machine group. */
  listAll(params?: PaginationParams): PaginatedIterable<VsaMachineGroup> {
    return new PaginatedIterable<VsaMachineGroup>(
      this.httpClient,
      '/system/machinegroups',
      params
    );
  }
}
