/**
 * Service Desk ticket types.
 */

import type { IsoTimestamp, KaseyaId } from './common.js';

export interface VsaTicket {
  TicketId: KaseyaId;
  Summary?: string;
  Status?: string;
  Priority?: string;
  AssigneeName?: string;
  Organization?: string;
  CreateDate?: IsoTimestamp;
  LastModifiedDate?: IsoTimestamp;
  [key: string]: unknown;
}
