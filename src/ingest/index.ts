/**
 * Main ingestion entry point.
 * Parses both Claude Web exports and Claude Code sessions,
 * normalizes them, and saves to data/normalized/.
 *
 * Usage:
 *   bun run ingest              # Process everything new
 *   bun run ingest --web-only   # Only web exports
 *   bun run ingest --code-only  # Only code sessions
 *   bun run ingest --force      # Re-process everything (ignore manifest)
 */

import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { parseWebExport } from "./web-parser.ts";
import { parseAllCodeSessions, parseCodeSession } from "./code-parser.ts";
import {
  loadManifest,
  saveManifest,
  hashFile,
  isWebExportProcessed,
  recordWebExport,
  isCodeSessionProcessed,
  recordCodeSession,
} from "./manifest.ts";
import type { NormalizedConversation } from "./types.ts";

const ROOT = import.meta.dir.replace("/src/ingest", "");
const DATA_DIR = join(ROOT, "data");
const WEB_EXPORTS_DIR = join(DATA_DIR, "web-exports");
const NORMALIZED_WEB_DIR = join(DATA_DIR, "normalized", "web");
const NORMALIZED_CODE_DIR = join(DATA_DIR, "normalized", "code");
const MANIFEST_PATH = join(ROOT, "manifest.json");

const CLAUDE_PROJECTS_DIR = `${process.env.HOME}/.claude/projects`;

interface IngestOptions {
  webOnly: boolean;
  codeOnly: boolean;
  force: boolean;
}

function parseArgs(): IngestOptions {
  const args = process.argv.slice(2);
  return {
    webOnly: args.includes("--web-only"),
    codeOnly: args.includes("--code-only"),
    force: args.includes("--force"),
  };
}

/**
 * Save normalized conversations to disk as individual JSON files.
 */
async function saveNormalized(
  conversations: NormalizedConversation[],
  outputDir: string
): Promise<void> {
  for (const conv of conversations) {
    const filename = `${conv.id}.json`;
    const path = join(outputDir, filename);
    await Bun.write(path, JSON.stringify(conv, null, 2));
  }
}

/**
 * Process Claude Web exports.
 */
async function ingestWebExports(
  manifest: Awaited<ReturnType<typeof loadManifest>>,
  force: boolean
): Promise<number> {
  let totalNew = 0;

  // Find all extracted export directories
  let entries: string[];
  try {
    entries = await readdir(WEB_EXPORTS_DIR);
  } catch {
    console.log("[ingest] No web exports directory found");
    return 0;
  }

  // Look for conversations.json in each extracted directory
  const exportDirs = entries.filter(
    (e) => !e.endsWith(".zip") && !e.startsWith(".")
  );

  for (const dir of exportDirs) {
    const conversationsPath = join(
      WEB_EXPORTS_DIR,
      dir,
      "conversations.json"
    );
    const file = Bun.file(conversationsPath);
    if (!(await file.exists())) continue;

    // Check if already processed
    const hash = await hashFile(conversationsPath);
    if (!force && isWebExportProcessed(manifest, dir, hash)) {
      console.log(`[ingest] Web export "${dir}" already processed, skipping`);
      continue;
    }

    console.log(`[ingest] Processing web export: ${dir}`);
    const conversations = await parseWebExport(conversationsPath);

    // Save normalized conversations
    await saveNormalized(conversations, NORMALIZED_WEB_DIR);

    // Update manifest
    recordWebExport(manifest, dir, {
      hash,
      processed_at: new Date().toISOString(),
      conversation_count: conversations.length,
      conversation_ids: conversations.map((c) => c.id),
    });

    totalNew += conversations.length;
    console.log(
      `[ingest] Saved ${conversations.length} web conversations`
    );
  }

  return totalNew;
}

/**
 * Process Claude Code sessions incrementally.
 */
async function ingestCodeSessions(
  manifest: Awaited<ReturnType<typeof loadManifest>>,
  force: boolean
): Promise<number> {
  let totalNew = 0;
  let skipped = 0;

  let projects: string[];
  try {
    projects = await readdir(CLAUDE_PROJECTS_DIR);
  } catch {
    console.log("[ingest] No Claude projects directory found");
    return 0;
  }

  console.log(`[ingest] Scanning ${projects.length} Claude Code projects`);

  for (const project of projects) {
    const projectPath = join(CLAUDE_PROJECTS_DIR, project);

    let files: string[];
    try {
      const entries = await readdir(projectPath);
      files = entries.filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      const filePath = join(projectPath, file);

      // Check if already processed
      if (!force) {
        const hash = await hashFile(filePath);
        if (isCodeSessionProcessed(manifest, project, file, hash)) {
          skipped++;
          continue;
        }
      }

      try {
        const hash = await hashFile(filePath);
        const conv = await parseCodeSession(filePath, project);

        if (conv) {
          // Save to project-specific subdirectory
          const projectOutputDir = join(NORMALIZED_CODE_DIR, project);
          await Bun.write(
            join(projectOutputDir, `${conv.id}.json`),
            JSON.stringify(conv, null, 2)
          );

          recordCodeSession(manifest, project, file, {
            hash,
            processed_at: new Date().toISOString(),
            message_count: conv.messages.length,
          });

          totalNew++;
        }
      } catch (err) {
        console.error(`[ingest] Error processing ${filePath}:`, err);
      }
    }
  }

  console.log(
    `[ingest] Processed ${totalNew} new code sessions (${skipped} already in manifest)`
  );

  return totalNew;
}

/**
 * Main ingestion pipeline.
 */
async function main() {
  const opts = parseArgs();
  console.log("\n=== Ontolo GG Ingestion Pipeline ===\n");

  // Load manifest
  const manifest = await loadManifest(MANIFEST_PATH);
  console.log(
    `[ingest] Manifest loaded (last updated: ${manifest.last_updated})`
  );

  // Ensure output directories exist
  await Bun.write(join(NORMALIZED_WEB_DIR, ".gitkeep"), "");
  await Bun.write(join(NORMALIZED_CODE_DIR, ".gitkeep"), "");

  let webCount = 0;
  let codeCount = 0;

  // Process web exports
  if (!opts.codeOnly) {
    webCount = await ingestWebExports(manifest, opts.force);
  }

  // Process code sessions
  if (!opts.webOnly) {
    codeCount = await ingestCodeSessions(manifest, opts.force);
  }

  // Save updated manifest
  await saveManifest(MANIFEST_PATH, manifest);

  console.log("\n=== Ingestion Complete ===");
  console.log(`  Web conversations: ${webCount} new`);
  console.log(`  Code sessions:     ${codeCount} new`);
  console.log(`  Manifest saved to: ${MANIFEST_PATH}`);
  console.log();
}

main().catch(console.error);
