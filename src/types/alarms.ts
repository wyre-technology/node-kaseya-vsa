/**
 * Alarm types.
 */

import type { IsoTimestamp, KaseyaId } from './common.js';

export interface VsaAlarm {
  AlarmId: KaseyaId;
  AgentId?: KaseyaId;
  AlarmType?: string;
  AlarmState?: string;
  AlarmTime?: IsoTimestamp;
  Message?: string;
  [key: string]: unknown;
}
