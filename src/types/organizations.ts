/**
 * Organization (customer/tenant) types.
 */

import type { KaseyaId } from './common.js';

export interface VsaOrganization {
  OrgId: KaseyaId;
  OrgRef?: string;
  OrgName?: string;
  DefaultDepartmentName?: string;
  [key: string]: unknown;
}
