/**
 * Common types shared across Kaseya VSA resources.
 */

/** ISO 8601 timestamp string (e.g. "2024-01-01T00:00:00Z"). */
export type IsoTimestamp = string;

/** Numeric Kaseya identifier (often a 64-bit integer expressed as string or number). */
export type KaseyaId = string | number;
