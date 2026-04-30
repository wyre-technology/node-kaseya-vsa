/**
 * Patch management types.
 */

import type { IsoTimestamp, KaseyaId } from './common.js';

export interface VsaPatchStatus {
  AgentId?: KaseyaId;
  PatchPolicy?: string;
  MissingPatches?: number;
  InstalledPatches?: number;
  LastScan?: IsoTimestamp;
  [key: string]: unknown;
}
