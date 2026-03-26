/**
 * Extract loop helper for Claude Code.
 *
 * This script finds the next unprocessed conversation and prints
 * its content + the extraction prompt so that Claude Code (the model
 * running in the terminal) can analyze it directly.
 *
 * Workflow:
 *   1. Run: bun src/extract/extract-loop.ts
 *   2. It prints the conversation + extraction instructions
 *   3. Claude Code reads it, produces the extraction JSON
 *   4. Claude Code writes the result via Write tool to the output path
 *   5. Repeat
 *
 * This uses YOUR Claude Code subscription — no API key needed.
 *
 * Flags:
 *   --source web|code    Filter by source
 *   --batch N            Process N conversations (default: 5)
 */

import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import type { NormalizedConversation } from "../ingest/types.ts";
import { EXTRACTION_SYSTEM_PROMPT, buildUserPromptFromNormalized } from "./prompts.ts";

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
  const sourceFilter = args.includes("--source") ? args[args.indexOf("--source") + 1] : null;
  const batchArg = args.includes("--batch") ? parseInt(args[args.indexOf("--batch") + 1]!) : 5;
  const batchSize = isNaN(batchArg) ? 5 : batchArg;

  // Collect all paths
  const webPaths = sourceFilter === "code" ? [] : await scanDir(NORMALIZED_WEB);
  const codePaths = sourceFilter === "web" ? [] : await scanRecursive(NORMALIZED_CODE);

  // Get already-extracted
  const extractedWeb = await getExtractedIds(EXTRACTION_WEB);
  const extractedCode = await getExtractedIds(EXTRACTION_CODE);

  const totalExtracted = extractedWeb.size + extractedCode.size;
  const totalConversations = webPaths.length + codePaths.length;

  // Find unprocessed
  const unprocessed: Array<{ path: string; conv: NormalizedConversation }> = [];

  for (const p of webPaths) {
    const id = basename(p, ".json");
    if (!extractedWeb.has(id)) {
      try {
        const conv = await Bun.file(p).json() as NormalizedConversation;
        unprocessed.push({ path: p, conv });
      } catch {}
    }
  }

  for (const p of codePaths) {
    const id = basename(p, ".json");
    if (!extractedCode.has(id)) {
      try {
        const conv = await Bun.file(p).json() as NormalizedConversation;
        unprocessed.push({ path: p, conv });
      } catch {}
    }
  }

  // Sort oldest first
  unprocessed.sort((a, b) =>
    new Date(a.conv.created_at).getTime() - new Date(b.conv.created_at).getTime()
  );

  console.log(`\n=== Extraction Progress: ${totalExtracted}/${totalConversations} (${((totalExtracted/totalConversations)*100).toFixed(1)}%) ===`);
  console.log(`Remaining: ${unprocessed.length} | This batch: ${Math.min(batchSize, unprocessed.length)}\n`);

  if (unprocessed.length === 0) {
    console.log("All conversations extracted!");
    return;
  }

  // Output batch info for Claude Code to process
  const batch = unprocessed.slice(0, batchSize);

  for (let i = 0; i < batch.length; i++) {
    const { conv } = batch[i]!;
    const outputDir = conv.source === "claude_web" ? EXTRACTION_WEB : EXTRACTION_CODE;
    const outputPath = join(outputDir, `${conv.id}.json`);

    console.log(`--- CONVERSATION ${i + 1}/${batch.length} ---`);
    console.log(`ID: ${conv.id}`);
    console.log(`TITLE: ${conv.title}`);
    console.log(`SOURCE: ${conv.source}`);
    console.log(`DATE: ${conv.created_at}`);
    console.log(`MESSAGES: ${conv.metadata.message_count}`);
    console.log(`OUTPUT_PATH: ${outputPath}`);
    console.log();
  }
}

main().catch(console.error);
