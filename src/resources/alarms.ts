/**
 * Alarm operations.
 */

import type { HttpClient } from '../http.js';
import type { VsaAlarm } from '../types/alarms.js';
import {
  PaginatedIterable,
  buildPaginationParams,
  type PaginationParams,
} from '../pagination.js';

/**
 * Operations on alarms.
 */
export class AlarmsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** List alarms (single page). Use `params.filter` to filter by state, e.g. `AlarmState eq 'Open'`. */
  async list(params?: PaginationParams): Promise<VsaAlarm[]> {
    return this.httpClient.get<VsaAlarm[]>('/assetmgmt/alarms', buildPaginationParams(params));
  }

  /** Iterate over every alarm. */
  listAll(params?: PaginationParams): PaginatedIterable<VsaAlarm> {
    return new PaginatedIterable<VsaAlarm>(this.httpClient, '/assetmgmt/alarms', params);
  }
}
