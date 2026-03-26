/**
 * Finds the next unprocessed conversation for extraction.
 * Claude Code reads the output, does the extraction itself,
 * and writes the result — no API calls needed.
 *
 * Usage:
 *   bun run next-job                 # Show next unprocessed conversation
 *   bun run next-job --source web    # Only web conversations
 *   bun run next-job --source code   # Only code sessions
 *   bun run next-job --stats         # Show extraction progress stats
 */

import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import type { NormalizedConversation } from "../ingest/types.ts";

const ROOT = import.meta.dir.replace("/src/extract", "");
const NORMALIZED_WEB = join(ROOT, "data", "normalized", "web");
const NORMALIZED_CODE = join(ROOT, "data", "normalized", "code");
const EXTRACTION_WEB = join(ROOT, "data", "extractions", "web");
const EXTRACTION_CODE = join(ROOT, "data", "extractions", "code");

async function scanDir(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter(f => f.endsWith(".json") && f !== ".gitkeep").map(f => join(dir, f));
  } catch { return []; }
}

async function scanRecursive(dir: string): Promise<string[]> {
  const paths: string[] = [];
  try {
    const projects = await readdir(dir);
    for (const project of projects) {
      if (project.startsWith(".")) continue;
      try {
        const files = await readdir(join(dir, project));
        for (const f of files) {
          if (f.endsWith(".json") && f !== ".gitkeep") paths.push(join(dir, project, f));
        }
      } catch {}
    }
  } catch {}
  return paths;
}

async function getExtractedIds(dir: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const files = await readdir(dir);
    for (const f of files) {
      if (f.endsWith(".json") && !f.endsWith(".error.json") && f !== ".gitkeep") {
        ids.add(basename(f, ".json"));
      }
    }
  } catch {}
  return ids;
}

async function main() {
  const args = process.argv.slice(2);
  const showStats = args.includes("--stats");
  const sourceFilter = args.includes("--source") ? args[args.indexOf("--source") + 1] : null;

  // Collect all normalized conversations
  const webPaths = sourceFilter === "code" ? [] : await scanDir(NORMALIZED_WEB);
  const codePaths = sourceFilter === "web" ? [] : await scanRecursive(NORMALIZED_CODE);

  // Get already-extracted IDs
  const extractedWeb = await getExtractedIds(EXTRACTION_WEB);
  const extractedCode = await getExtractedIds(EXTRACTION_CODE);

  if (showStats) {
    console.log("\n=== Extraction Progress ===");
    console.log(`  Web:  ${extractedWeb.size} / ${webPaths.length} extracted`);
    console.log(`  Code: ${extractedCode.size} / ${codePaths.length} extracted`);
    console.log(`  Total: ${extractedWeb.size + extractedCode.size} / ${webPaths.length + codePaths.length}`);
    const pct = ((extractedWeb.size + extractedCode.size) / (webPaths.length + codePaths.length) * 100).toFixed(1);
    console.log(`  Progress: ${pct}%\n`);
    return;
  }

  // Find unprocessed conversations, sorted oldest first
  const unprocessed: Array<{ path: string; date: string; source: string }> = [];

  for (const p of webPaths) {
    const id = basename(p, ".json");
    if (!extractedWeb.has(id)) {
      try {
        const conv = await Bun.file(p).json() as NormalizedConversation;
        unprocessed.push({ path: p, date: conv.created_at, source: "web" });
      } catch {}
    }
  }

  for (const p of codePaths) {
    const id = basename(p, ".json");
    if (!extractedCode.has(id)) {
      try {
        const conv = await Bun.file(p).json() as NormalizedConversation;
        unprocessed.push({ path: p, date: conv.created_at, source: "code" });
      } catch {}
    }
  }

  unprocessed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (unprocessed.length === 0) {
    console.log("All conversations have been extracted!");
    return;
  }

  // Output the next job
  const next = unprocessed[0]!;
  console.log(`NEXT_JOB_PATH=${next.path}`);
  console.log(`NEXT_JOB_SOURCE=${next.source}`);
  console.log(`REMAINING=${unprocessed.length}`);
}

main().catch(console.error);
