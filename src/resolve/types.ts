/**
 * Entity Resolution Types
 *
 * Types for the resolution system that maps aliases/variants
 * to canonical entity names across people, projects, and topics.
 */

export interface TimeBasedAlias {
  aliases: string[];
  before: string;  // ISO date — applies to conversations before this date
}

export interface EntityResolution {
  canonical_name: string;
  aliases: string[];
  time_based?: TimeBasedAlias[];  // aliases that only apply before a certain date
  relationship?: string; // for people
  description?: string; // for projects
  notes?: string;
}

export interface ResolutionFile {
  resolutions: EntityResolution[];
}

export interface ResolutionMap {
  /** Maps any alias (lowercased) -> canonical name */
  [alias: string]: string;
}
