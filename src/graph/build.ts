/**
 * Build Graph — load all extraction JSONs into KuzuDB.
 *
 * Usage:
 *   bun run build-graph              # Load all extractions
 *   bun run build-graph --reset      # Reset graph first, then load
 *   bun run build-graph --dry-run    # Count files without loading
 *   bun run build-graph --limit 10   # Load only first N extractions
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getConnection, query, closeDb } from "./db.ts";
import { initSchema } from "./schema.ts";
import { loadExtraction, type LoadResult } from "./loader.ts";
import type { CachedExtraction } from "../extract/schema.ts";

const ROOT = import.meta.dir.replace("/src/graph", "");
const EXTRACTIONS_DIR = join(ROOT, "data", "extractions");
const NORMALIZED_DIR = join(ROOT, "data", "normalized");

// ============================================
// Scan extraction files
// ============================================

interface ExtractionFile {
  path: string;
  normalizedPath: string;
  source: "web" | "code";
  conversationId: string;
}

function scanExtractions(): ExtractionFile[] {
  const files: ExtractionFile[] = [];

  for (const source of ["web", "code"] as const) {
    const dir = join(EXTRACTIONS_DIR, source);
    if (!existsSync(dir)) continue;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      // Skip error files
      if (entry.includes(".error.")) continue;
      if (!entry.endsWith(".json")) continue;

      const convId = entry.replace(".json", "");
      const normalizedPath = join(NORMALIZED_DIR, source, entry);

      // Only load if we have the normalized source
      if (!existsSync(normalizedPath)) {
        // For code extractions, normalized files might be in project subdirs
        if (source === "code") {
          // Skip for now — code conversations have different structure
          continue;
        }
        console.warn(`[build] Missing normalized file for ${source}/${convId}, skipping`);
        continue;
      }

      files.push({
        path: join(dir, entry),
        normalizedPath,
        source,
        conversationId: convId,
      });
    }
  }

  return files;
}

// ============================================
// Main
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

  console.log("\n=== Ontolo GG — Build Graph ===\n");

  // Scan extraction files
  const files = scanExtractions();
  console.log(`[build] Found ${files.length} extraction files`);
  console.log(`[build]   Web: ${files.filter((f) => f.source === "web").length}`);
  console.log(`[build]   Code: ${files.filter((f) => f.source === "code").length}`);

  if (dryRun) {
    console.log("[build] Dry run — exiting without loading");
    return;
  }

  // Initialize DB connection
  getConnection();

  if (reset) {
    console.log("[build] Resetting graph (re-running init)...");
    // Re-run init to ensure schema + taxonomy are fresh
    // We don't drop here — use init-graph:reset for that
  }

  // Ensure schema exists
  initSchema((cypher) => {
    const conn = getConnection();
    conn.querySync(cypher);
  });

  // Load extractions
  const toLoad = files.slice(0, limit);
  console.log(`[build] Loading ${toLoad.length} extractions into graph...\n`);

  let loaded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: { id: string; error: string }[] = [];
  const startTime = Date.now();

  for (let i = 0; i < toLoad.length; i++) {
    const file = toLoad[i];

    // Progress indicator every 50 files
    if (i > 0 && i % 50 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (i / parseFloat(elapsed)).toFixed(1);
      console.log(`[build] Progress: ${i}/${toLoad.length} (${rate} conv/s, ${elapsed}s elapsed)`);
    }

    try {
      // Read extraction JSON
      const extractionFile = Bun.file(file.path);
      const cached: CachedExtraction = await extractionFile.json();

      // Read normalized conversation for metadata
      const normalizedFile = Bun.file(file.normalizedPath);
      const normalized = await normalizedFile.json();

      const convMeta = {
        id: normalized.id ?? file.conversationId,
        title: normalized.title ?? "Untitled",
        source: normalized.source ?? file.source,
        platform_project: normalized.platform_project ?? "default",
        created_at: normalized.created_at ?? "",
      };

      const result = loadExtraction(cached, convMeta);

      if (result.success) {
        loaded++;
      } else {
        failed++;
        errors.push({ id: file.conversationId, error: result.error ?? "unknown" });
      }
    } catch (err) {
      failed++;
      errors.push({
        id: file.conversationId,
        error: (err as Error).message,
      });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print results
  console.log("\n=== Build Results ===");
  console.log(`  Loaded:  ${loaded}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Time:    ${elapsed}s`);
  console.log(`  Rate:    ${(loaded / parseFloat(elapsed)).toFixed(1)} conv/s`);

  if (errors.length > 0) {
    console.log(`\n  Errors (${errors.length}):`);
    for (const e of errors.slice(0, 10)) {
      console.log(`    ${e.id}: ${e.error.slice(0, 100)}`);
    }
    if (errors.length > 10) {
      console.log(`    ... and ${errors.length - 10} more`);
    }
  }

  // Verify graph state
  console.log("\n=== Graph Stats ===");
  const stats = [
    { label: "Conversations", q: "MATCH (c:Conversation) RETURN count(c) AS cnt" },
    { label: "Topics", q: "MATCH (t:Topic) RETURN count(t) AS cnt" },
    { label: "Skills", q: "MATCH (s:Skill) RETURN count(s) AS cnt" },
    { label: "Projects", q: "MATCH (p:Project) RETURN count(p) AS cnt" },
    { label: "People", q: "MATCH (p:Person) RETURN count(p) AS cnt" },
    { label: "Beliefs", q: "MATCH (b:Belief) RETURN count(b) AS cnt" },
    { label: "Questions", q: "MATCH (q:Question) RETURN count(q) AS cnt" },
    { label: "SkillNodes", q: "MATCH (sn:SkillNode) RETURN count(sn) AS cnt" },
    { label: "Eras", q: "MATCH (e:Era) RETURN count(e) AS cnt" },
  ];

  for (const s of stats) {
    try {
      const result = query(s.q);
      console.log(`  ${s.label}: ${(result[0] as any).cnt}`);
    } catch {
      console.log(`  ${s.label}: (query failed)`);
    }
  }

  // Relationship counts
  console.log("\n=== Relationship Stats ===");
  const relStats = [
    { label: "MENTIONED_IN", q: "MATCH ()-[r:MENTIONED_IN]->() RETURN count(r) AS cnt" },
    { label: "SKILL_EVIDENCE", q: "MATCH ()-[r:SKILL_EVIDENCE]->() RETURN count(r) AS cnt" },
    { label: "DEMONSTRATED", q: "MATCH ()-[r:DEMONSTRATED]->() RETURN count(r) AS cnt" },
    { label: "MAPS_TO", q: "MATCH ()-[r:MAPS_TO]->() RETURN count(r) AS cnt" },
    { label: "PROJECT_CONVERSATION", q: "MATCH ()-[r:PROJECT_CONVERSATION]->() RETURN count(r) AS cnt" },
    { label: "HOLDS", q: "MATCH ()-[r:HOLDS]->() RETURN count(r) AS cnt" },
    { label: "ASKED", q: "MATCH ()-[r:ASKED]->() RETURN count(r) AS cnt" },
    { label: "ERA_CONVERSATION", q: "MATCH ()-[r:ERA_CONVERSATION]->() RETURN count(r) AS cnt" },
  ];

  for (const s of relStats) {
    try {
      const result = query(s.q);
      console.log(`  ${s.label}: ${(result[0] as any).cnt}`);
    } catch {
      console.log(`  ${s.label}: (query failed)`);
    }
  }

  console.log("\n=== Build Complete ===\n");
}

main().catch(console.error);
