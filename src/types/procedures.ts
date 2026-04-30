/**
 * Agent procedure (automation) types.
 */

import type { KaseyaId } from './common.js';

export interface VsaAgentProcedure {
  AgentProcedureId: KaseyaId;
  AgentProcedureName?: string;
  Folder?: string;
  [key: string]: unknown;
}
