/**
 * Audit (software / hardware inventory) types.
 */

export interface VsaSoftwareItem {
  ProductName?: string;
  Version?: string;
  Publisher?: string;
  InstallDate?: string;
  [key: string]: unknown;
}

export interface VsaHardwareInfo {
  Manufacturer?: string;
  Model?: string;
  SerialNumber?: string;
  CpuDescription?: string;
  RamMBytes?: number;
  [key: string]: unknown;
}
