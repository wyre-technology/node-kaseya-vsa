/**
 * Service Desk ticket operations.
 *
 * Note: these endpoints require the Service Desk module to be enabled on
 * the tenant. If it isn't, requests will return 404 — the SDK surfaces
 * a {@link KaseyaVsaNotFoundError} with a friendly message wrapped on top.
 */

import type { HttpClient } from '../http.js';
import type { VsaTicket } from '../types/tickets.js';
import {
  PaginatedIterable,
  buildPaginationParams,
  type PaginationParams,
} from '../pagination.js';
import { KaseyaVsaNotFoundError } from '../errors.js';

/**
 * Operations on Service Desk tickets.
 */
export class TicketsResource {
  private readonly httpClient: HttpClient;

  constructor(httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /** List Service Desk tickets (single page). */
  async list(params?: PaginationParams): Promise<VsaTicket[]> {
    try {
      return await this.httpClient.get<VsaTicket[]>(
        '/servicedesk/tickets',
        buildPaginationParams(params)
      );
    } catch (err: unknown) {
      throw wrapServiceDeskError(err);
    }
  }

  /** Iterate every Service Desk ticket. */
  listAll(params?: PaginationParams): PaginatedIterable<VsaTicket> {
    return new PaginatedIterable<VsaTicket>(this.httpClient, '/servicedesk/tickets', params);
  }

  /** Get a single ticket by ID. */
  async get(ticketId: string | number): Promise<VsaTicket> {
    try {
      return await this.httpClient.get<VsaTicket>(
        `/servicedesk/tickets/${encodeURIComponent(String(ticketId))}`
      );
    } catch (err: unknown) {
      throw wrapServiceDeskError(err);
    }
  }
}

/**
 * Re-throw a 404 with a more helpful message if it looks like the
 * Service Desk module isn't enabled on this tenant.
 */
function wrapServiceDeskError(err: unknown): unknown {
  if (err instanceof KaseyaVsaNotFoundError) {
    return new KaseyaVsaNotFoundError(
      'Service Desk endpoint not found — verify that the Service Desk module is enabled on this VSA tenant',
      err.response
    );
  }
  return err;
}
