/**
 * Organization operations.
 */

import type { HttpClient } from '../http.js';
import type { VsaOrganization } from '../types/organizations.js';
import {
  PaginatedIterable,
  buildPaginationParams,
  type PaginationParams,
} from '../pagination.js';

/**
 * Operations on VSA organizations (customers).
 */
export class OrganizationsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** List organizations (single page). */
  async list(params?: PaginationParams): Promise<VsaOrganization[]> {
    return this.httpClient.get<VsaOrganization[]>('/system/orgs', buildPaginationParams(params));
  }

  /** Iterate every organization. */
  listAll(params?: PaginationParams): PaginatedIterable<VsaOrganization> {
    return new PaginatedIterable<VsaOrganization>(this.httpClient, '/system/orgs', params);
  }
}
