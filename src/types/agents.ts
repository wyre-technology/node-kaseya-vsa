/**
 * Agent (managed endpoint) types.
 */

import type { IsoTimestamp, KaseyaId } from './common.js';

/**
 * A Kaseya VSA managed agent.
 *
 * The VSA API may include additional fields not modeled here; the index
 * signature keeps consumers flexible.
 */
export interface VsaAgent {
  AgentId: KaseyaId;
  AgentName?: string;
  ComputerName?: string;
  MachineGroup?: string;
  Organization?: string;
  OperatingSystem?: string;
  OSVersion?: string;
  IPAddress?: string;
  LastCheckin?: IsoTimestamp;
  Online?: boolean;
  [key: string]: unknown;
}
