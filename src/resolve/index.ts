/**
 * Entity Resolution CLI
 *
 * Usage:
 *   bun run resolve:stats    Show resolution stats and unresolved entities
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadResolutions, resolveSync } from "./resolver.ts";
import type { CachedExtraction } from "../extract/schema.ts";

const ROOT = import.meta.dir.replace("/src/resolve", "");
const EXTRACTIONS_DIR = join(ROOT, "data", "extractions");

// ============================================
// Scan all extraction files for raw entity names
// ============================================

interface RawEntities {
  people: Map<string, number>; // name → mention count
  projects: Map<string, number>;
  topics: Map<string, number>;
}

async function collectRawEntities(): Promise<RawEntities> {
  const entities: RawEntities = {
    people: new Map(),
    projects: new Map(),
    topics: new Map(),
  };

  for (const source of ["web", "code"] as const) {
    const dir = join(EXTRACTIONS_DIR, source);
    if (!existsSync(dir)) continue;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.includes(".error.") || !entry.endsWith(".json")) continue;

      try {
        const file = Bun.file(join(dir, entry));
        const cached: CachedExtraction = await file.json();
        const ext = cached.extraction;

        for (const person of ext.people) {
          if (!person.name) continue;
          const count = entities.people.get(person.name) ?? 0;
          entities.people.set(person.name, count + 1);
        }
        for (const project of ext.projects) {
          if (!project.name) continue;
          const count = entities.projects.get(project.name) ?? 0;
          entities.projects.set(project.name, count + 1);
        }
        for (const topic of ext.topics) {
          if (!topic.name) continue;
          const count = entities.topics.get(topic.name) ?? 0;
          entities.topics.set(topic.name, count + 1);
        }
      } catch {
        // Skip malformed files
      }
    }
  }

  return entities;
}

// ============================================
// Stats command
// ============================================

async function showStats() {
  console.log("\n=== Entity Resolution Stats ===\n");

  // Load resolutions
  const maps = await loadResolutions();

  // Collect raw entities from extractions
  console.log("[resolve] Scanning extraction files...");
  const raw = await collectRawEntities();

  const types = [
    { label: "People", key: "people" as const },
    { label: "Projects", key: "projects" as const },
    { label: "Topics", key: "topics" as const },
  ];

  let totalRaw = 0;
  let totalResolved = 0;
  let totalUnresolved = 0;

  for (const { label, key } of types) {
    const map = maps.get(key) ?? {};
    const rawNames = raw[key];
    const uniqueNames = rawNames.size;

    let resolved = 0;
    let unresolved = 0;
    const unresolvedNames: { name: string; count: number }[] = [];

    for (const [name, count] of rawNames) {
      const lower = name.toLowerCase();
      if (map[lower]) {
        resolved++;
      } else {
        unresolved++;
        unresolvedNames.push({ name, count });
      }
    }

    totalRaw += uniqueNames;
    totalResolved += resolved;
    totalUnresolved += unresolved;

    const canonicals = new Set(Object.values(map)).size;

    console.log(`\n--- ${label} ---`);
    console.log(`  Unique raw names:    ${uniqueNames}`);
    console.log(`  Resolution aliases:  ${Object.keys(map).length}`);
    console.log(`  Canonical entities:  ${canonicals}`);
    console.log(`  Resolved:            ${resolved} (${uniqueNames > 0 ? ((resolved / uniqueNames) * 100).toFixed(1) : 0}%)`);
    console.log(`  Unresolved:          ${unresolved}`);

    // Show top unresolved (by mention count)
    if (unresolvedNames.length > 0) {
      unresolvedNames.sort((a, b) => b.count - a.count);
      const top = unresolvedNames.slice(0, 10);
      console.log(`  Top unresolved:`);
      for (const { name, count } of top) {
        console.log(`    "${name}" (${count} mentions)`);
      }
      if (unresolvedNames.length > 10) {
        console.log(`    ... and ${unresolvedNames.length - 10} more`);
      }
    }
  }

  console.log("\n--- Summary ---");
  console.log(`  Total unique entity names: ${totalRaw}`);
  console.log(`  Total resolved:            ${totalResolved} (${totalRaw > 0 ? ((totalResolved / totalRaw) * 100).toFixed(1) : 0}%)`);
  console.log(`  Total unresolved:          ${totalUnresolved}`);
  console.log("");
}

// ============================================
// Main
// ============================================

const args = process.argv.slice(2);

if (args.includes("--stats")) {
  showStats().catch(console.error);
} else {
  console.log("Usage:");
  console.log("  bun run resolve:stats    Show resolution stats");
}
