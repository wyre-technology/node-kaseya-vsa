/**
 * Machine group types.
 */

import type { KaseyaId } from './common.js';

export interface VsaMachineGroup {
  MachineGroupId: KaseyaId;
  MachineGroupName?: string;
  OrgId?: KaseyaId;
  OrgName?: string;
  [key: string]: unknown;
}
