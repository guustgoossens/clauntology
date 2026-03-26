/**
 * Entity Resolver — maps aliases to canonical entity names.
 *
 * Loads resolution JSON files from data/resolutions/ and builds
 * a fast lookup map. Any alias (case-insensitive) resolves to
 * the canonical name. If no resolution exists, returns the original.
 *
 * Usage:
 *   resolve("people", "my girlfriend")  → "Hanais"
 *   resolve("projects", "ClearTax AI Platform")  → "ClearTax"
 *   resolve("topics", "Some Unknown Topic")  → "Some Unknown Topic"
 */

import type { ResolutionFile, ResolutionMap } from "./types.ts";

const ROOT = import.meta.dir.replace("/src/resolve", "");
const RESOLUTIONS_DIR = `${ROOT}/data/resolutions`;
const DECISIONS_PATH = `${RESOLUTIONS_DIR}/review-decisions.json`;

// Entity types that have resolution files
const ENTITY_TYPES = ["people", "projects", "topics"] as const;
type EntityType = (typeof ENTITY_TYPES)[number];

// Time-based alias entry: alias → canonical, but only before a date
interface TimeBoundAlias {
  canonical: string;
  before: string; // ISO date
}

// Review decision from human-in-the-loop review
interface ReviewDecision {
  entity_type: string;
  raw_name: string;
  conversation_id: string;
  resolved_to: string;
  reviewed_at: string;
}

interface ReviewDecisionsFile {
  decisions: ReviewDecision[];
}

// Cached resolution maps per entity type
let _maps: Map<string, ResolutionMap> | null = null;
let _timeMaps: Map<string, Map<string, TimeBoundAlias>> | null = null;
// Review decisions: keyed by "entity_type|raw_name_lower|conversation_id"
let _reviewDecisions: Map<string, string> | null = null;

/**
 * Build a ResolutionMap from a ResolutionFile.
 * Maps every alias (lowercased) and the canonical name itself
 * to the canonical name. Time-based aliases go into a separate map.
 */
function buildMap(file: ResolutionFile): { map: ResolutionMap; timeMap: Map<string, TimeBoundAlias> } {
  const map: ResolutionMap = {};
  const timeMap = new Map<string, TimeBoundAlias>();

  for (const resolution of file.resolutions) {
    const canonical = resolution.canonical_name;

    // Map the canonical name itself (lowercased)
    map[canonical.toLowerCase()] = canonical;

    // Map every alias (lowercased)
    for (const alias of resolution.aliases) {
      map[alias.toLowerCase()] = canonical;
    }

    // Time-based aliases: these override the main map when a date is provided
    if (resolution.time_based) {
      for (const tb of resolution.time_based) {
        for (const alias of tb.aliases) {
          timeMap.set(alias.toLowerCase(), { canonical, before: tb.before });
        }
      }
    }
  }

  return { map, timeMap };
}

/**
 * Load review decisions from data/resolutions/review-decisions.json.
 * These are per-conversation overrides set via the interactive review CLI.
 */
async function loadReviewDecisions(): Promise<void> {
  if (_reviewDecisions) return;

  _reviewDecisions = new Map();
  const file = Bun.file(DECISIONS_PATH);

  if (await file.exists()) {
    const data: ReviewDecisionsFile = await file.json();
    for (const d of data.decisions) {
      const key = `${d.entity_type}|${d.raw_name.toLowerCase()}|${d.conversation_id}`;
      _reviewDecisions.set(key, d.resolved_to);
    }
  }
}

/**
 * Load all resolution files and build lookup maps.
 * Also loads review decisions. Results are cached after first call.
 */
export async function loadResolutions(): Promise<Map<string, ResolutionMap>> {
  if (_maps) return _maps;

  _maps = new Map();
  _timeMaps = new Map();

  for (const type of ENTITY_TYPES) {
    const path = `${RESOLUTIONS_DIR}/${type}.json`;
    const file = Bun.file(path);

    if (await file.exists()) {
      const data: ResolutionFile = await file.json();
      const { map, timeMap } = buildMap(data);
      _maps.set(type, map);
      _timeMaps.set(type, timeMap);
    } else {
      _maps.set(type, {});
      _timeMaps.set(type, new Map());
    }
  }

  // Also load review decisions
  await loadReviewDecisions();

  return _maps;
}

/**
 * Resolve an entity name to its canonical form.
 *
 * @param entityType - "people", "projects", or "topics"
 * @param name - The raw entity name from extraction
 * @param date - Optional ISO date string for time-based resolution
 * @param conversationId - Optional conversation ID for per-conversation overrides
 * @returns The canonical name if a resolution exists, otherwise the original name
 */
export async function resolve(
  entityType: string,
  name: string,
  date?: string,
  conversationId?: string
): Promise<string> {
  const maps = await loadResolutions();
  return resolveSync(entityType, name, date, conversationId);
}

/**
 * Synchronous resolve — requires loadResolutions() to have been called first.
 *
 * Resolution priority:
 * 1. Per-conversation review decisions (if conversationId provided)
 * 2. Time-based aliases (if date provided)
 * 3. Global alias map
 * 4. Original name (no match)
 */
export function resolveSync(
  entityType: string,
  name: string,
  date?: string,
  conversationId?: string
): string {
  if (!_maps) {
    throw new Error(
      "Resolutions not loaded. Call loadResolutions() first."
    );
  }

  if (!name) return name;

  const key = name.toLowerCase();

  // Check per-conversation review decisions first
  if (conversationId && _reviewDecisions) {
    const decisionKey = `${entityType}|${key}|${conversationId}`;
    const decision = _reviewDecisions.get(decisionKey);
    if (decision) return decision;
  }

  // Check time-based aliases (if date provided)
  if (date && _timeMaps) {
    const timeMap = _timeMaps.get(entityType);
    if (timeMap) {
      const tb = timeMap.get(key);
      if (tb && date < tb.before) {
        return tb.canonical;
      }
    }
  }

  // Fall back to default map
  const map = _maps.get(entityType);
  if (!map) return name;

  return map[key] ?? name;
}

/**
 * Get resolution stats: how many aliases are mapped per entity type.
 */
export async function getResolutionStats(): Promise<
  { type: string; aliasCount: number; canonicalCount: number }[]
> {
  const maps = await loadResolutions();
  const stats: { type: string; aliasCount: number; canonicalCount: number }[] =
    [];

  for (const [type, map] of maps) {
    const aliases = Object.keys(map).length;
    const canonicals = new Set(Object.values(map)).size;
    stats.push({ type, aliasCount: aliases, canonicalCount: canonicals });
  }

  return stats;
}
