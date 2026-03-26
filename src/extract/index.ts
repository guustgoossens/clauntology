/**
 * Extraction pipeline CLI entry point.
 * Reads normalized conversations and sends them through LLM extraction.
 *
 * Usage:
 *   bun run extract                    # Extract all unprocessed conversations
 *   bun run extract --source web       # Only web conversations
 *   bun run extract --source code      # Only code sessions
 *   bun run extract --batch 50         # Process only N conversations
 *   bun run extract --force            # Re-extract even if cached
 *   bun run extract --dry-run          # Show what would be extracted
 *   bun run extract --concurrency 5    # Parallel requests (default 3)
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { NormalizedConversation } from "../ingest/types.ts";
import { extractBatch } from "./extractor.ts";

const ROOT = import.meta.dir.replace("/src/extract", "");
const NORMALIZED_WEB_DIR = join(ROOT, "data", "normalized", "web");
const NORMALIZED_CODE_DIR = join(ROOT, "data", "normalized", "code");
const EXTRACTION_WEB_DIR = join(ROOT, "data", "extractions", "web");
const EXTRACTION_CODE_DIR = join(ROOT, "data", "extractions", "code");

type Source = "web" | "code";

interface ExtractOptions {
  source: Source | null;
  batch: number | null;
  force: boolean;
  dryRun: boolean;
  concurrency: number;
}

function parseArgs(): ExtractOptions {
  const args = process.argv.slice(2);

  let source: Source | null = null;
  let batch: number | null = null;
  let concurrency = 3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--source" && args[i + 1]) {
      const val = args[i + 1];
      if (val !== "web" && val !== "code") {
        console.error(`[extract] Invalid source "${val}". Must be "web" or "code".`);
        process.exit(1);
      }
      source = val;
      i++;
    } else if (args[i] === "--batch" && args[i + 1]) {
      const val = parseInt(args[i + 1], 10);
      if (isNaN(val) || val <= 0) {
        console.error(`[extract] Invalid batch size "${args[i + 1]}". Must be a positive integer.`);
        process.exit(1);
      }
      batch = val;
      i++;
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      const val = parseInt(args[i + 1], 10);
      if (isNaN(val) || val <= 0) {
        console.error(`[extract] Invalid concurrency "${args[i + 1]}". Must be a positive integer.`);
        process.exit(1);
      }
      concurrency = val;
      i++;
    }
  }

  return {
    source,
    batch,
    force: args.includes("--force"),
    dryRun: args.includes("--dry-run"),
    concurrency,
  };
}

/**
 * Collect all .json conversation files from a flat directory.
 */
async function scanFlatDir(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  return entries
    .filter((f) => f.endsWith(".json") && f !== ".gitkeep")
    .map((f) => join(dir, f));
}

/**
 * Recursively collect all .json conversation files from a directory
 * that has project subdirectories (code sessions).
 */
async function scanRecursiveDir(dir: string): Promise<string[]> {
  let projects: string[];
  try {
    projects = await readdir(dir);
  } catch {
    return [];
  }

  const paths: string[] = [];

  for (const project of projects) {
    if (project.startsWith(".")) continue;
    const projectDir = join(dir, project);

    let files: string[];
    try {
      files = await readdir(projectDir);
    } catch {
      continue;
    }

    for (const file of files) {
      if (file.endsWith(".json") && file !== ".gitkeep") {
        paths.push(join(projectDir, file));
      }
    }
  }

  return paths;
}

/**
 * Check whether an extraction result already exists for a conversation.
 */
async function isAlreadyExtracted(conv: NormalizedConversation): Promise<boolean> {
  const outputDir = conv.source === "claude_web" ? EXTRACTION_WEB_DIR : EXTRACTION_CODE_DIR;
  const outputPath = join(outputDir, `${conv.id}.json`);
  const file = Bun.file(outputPath);
  return file.exists();
}

/**
 * Read and parse a normalized conversation JSON file.
 */
async function readConversation(path: string): Promise<NormalizedConversation | null> {
  try {
    const file = Bun.file(path);
    const data = await file.json();
    return data as NormalizedConversation;
  } catch (err) {
    console.error(`[extract] Failed to read ${path}:`, err);
    return null;
  }
}

/**
 * Main extraction pipeline.
 */
async function main() {
  const opts = parseArgs();
  const startTime = performance.now();

  console.log("\n=== Ontolo GG Extraction Pipeline ===\n");

  if (opts.source) {
    console.log(`[extract] Source filter: ${opts.source}`);
  }
  if (opts.batch) {
    console.log(`[extract] Batch size: ${opts.batch}`);
  }
  if (opts.force) {
    console.log(`[extract] Force mode: re-extracting cached results`);
  }
  if (opts.dryRun) {
    console.log(`[extract] Dry run: no extractions will be performed`);
  }
  console.log(`[extract] Concurrency: ${opts.concurrency}`);

  // Collect file paths
  const filePaths: string[] = [];

  if (opts.source !== "code") {
    const webPaths = await scanFlatDir(NORMALIZED_WEB_DIR);
    filePaths.push(...webPaths);
    console.log(`[extract] Found ${webPaths.length} web conversation files`);
  }

  if (opts.source !== "web") {
    const codePaths = await scanRecursiveDir(NORMALIZED_CODE_DIR);
    filePaths.push(...codePaths);
    console.log(`[extract] Found ${codePaths.length} code session files`);
  }

  if (filePaths.length === 0) {
    console.log("[extract] No conversation files found. Run ingestion first.");
    return;
  }

  // Read all conversations
  console.log(`[extract] Reading ${filePaths.length} conversation files...`);
  const readResults = await Promise.all(filePaths.map(readConversation));
  const allConversations = readResults.filter(
    (c): c is NormalizedConversation => c !== null
  );

  if (allConversations.length === 0) {
    console.log("[extract] No valid conversations found.");
    return;
  }

  // Sort by date (oldest first — build timeline chronologically)
  allConversations.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Filter out already-extracted unless --force
  let conversations: NormalizedConversation[];
  if (opts.force) {
    conversations = allConversations;
  } else {
    const checks = await Promise.all(
      allConversations.map(async (conv) => ({
        conv,
        extracted: await isAlreadyExtracted(conv),
      }))
    );
    conversations = checks.filter((c) => !c.extracted).map((c) => c.conv);
    const skipped = allConversations.length - conversations.length;
    if (skipped > 0) {
      console.log(`[extract] Skipping ${skipped} already-extracted conversations`);
    }
  }

  // Apply batch limit
  if (opts.batch && conversations.length > opts.batch) {
    console.log(
      `[extract] Limiting to batch of ${opts.batch} (${conversations.length} available)`
    );
    conversations = conversations.slice(0, opts.batch);
  }

  if (conversations.length === 0) {
    console.log("[extract] All conversations already extracted. Use --force to re-extract.");
    return;
  }

  console.log(`[extract] ${conversations.length} conversations to extract\n`);

  // Dry run — just list what would be extracted
  if (opts.dryRun) {
    console.log("--- Dry Run: Would extract the following conversations ---\n");
    for (const conv of conversations) {
      const date = conv.created_at.slice(0, 10);
      const source = conv.source === "claude_web" ? "web" : "code";
      const msgCount = conv.metadata.message_count;
      console.log(`  [${date}] [${source}] ${conv.title || "(untitled)"} (${msgCount} messages)`);
    }
    console.log(`\n  Total: ${conversations.length} conversations`);
    return;
  }

  // Ensure output directories exist
  await Bun.write(join(EXTRACTION_WEB_DIR, ".gitkeep"), "");
  await Bun.write(join(EXTRACTION_CODE_DIR, ".gitkeep"), "");

  // Run extraction
  await extractBatch(conversations, {
    concurrency: opts.concurrency,
    force: opts.force,
    dryRun: false,
    outputDir: join(ROOT, "data", "extractions"),
  });

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[extract] Total pipeline time: ${elapsed}s\n`);
}

main().catch((err) => {
  console.error("[extract] Fatal error:", err);
  process.exit(1);
});
