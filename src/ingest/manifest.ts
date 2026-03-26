/**
 * Processing manifest for incremental updates.
 * Tracks which files/conversations have been processed
 * so we only process new data on subsequent runs.
 */

import { join } from "node:path";
import type {
  ProcessingManifest,
  WebExportManifestEntry,
  CodeSessionManifestEntry,
} from "./types.ts";

const MANIFEST_VERSION = 1;

function emptyManifest(): ProcessingManifest {
  return {
    last_updated: new Date().toISOString(),
    version: MANIFEST_VERSION,
    web_exports: {},
    code_sessions: {},
  };
}

/**
 * Load manifest from disk, or create a new one if it doesn't exist.
 */
export async function loadManifest(
  manifestPath: string
): Promise<ProcessingManifest> {
  const file = Bun.file(manifestPath);
  if (await file.exists()) {
    try {
      return (await file.json()) as ProcessingManifest;
    } catch {
      console.warn("[manifest] Corrupt manifest, creating new one");
      return emptyManifest();
    }
  }
  return emptyManifest();
}

/**
 * Save manifest to disk.
 */
export async function saveManifest(
  manifestPath: string,
  manifest: ProcessingManifest
): Promise<void> {
  manifest.last_updated = new Date().toISOString();
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Compute SHA-256 hash of a file.
 */
export async function hashFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const buffer = await file.arrayBuffer();
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(buffer);
  return hash.digest("hex");
}

/**
 * Check if a web export has already been processed.
 */
export function isWebExportProcessed(
  manifest: ProcessingManifest,
  filename: string,
  hash: string
): boolean {
  const entry = manifest.web_exports[filename];
  return entry?.hash === hash;
}

/**
 * Record a processed web export in the manifest.
 */
export function recordWebExport(
  manifest: ProcessingManifest,
  filename: string,
  entry: WebExportManifestEntry
): void {
  manifest.web_exports[filename] = entry;
}

/**
 * Check if a code session has already been processed.
 */
export function isCodeSessionProcessed(
  manifest: ProcessingManifest,
  projectName: string,
  sessionFile: string,
  hash: string
): boolean {
  const project = manifest.code_sessions[projectName];
  if (!project) return false;
  const entry = project[sessionFile];
  return entry?.hash === hash;
}

/**
 * Record a processed code session in the manifest.
 */
export function recordCodeSession(
  manifest: ProcessingManifest,
  projectName: string,
  sessionFile: string,
  entry: CodeSessionManifestEntry
): void {
  if (!manifest.code_sessions[projectName]) {
    manifest.code_sessions[projectName] = {};
  }
  manifest.code_sessions[projectName]![sessionFile] = entry;
}

/**
 * Get list of conversation IDs that have already been extracted by the LLM.
 * (Used by the extraction phase, not ingestion.)
 */
export function getProcessedConversationIds(
  manifest: ProcessingManifest
): Set<string> {
  const ids = new Set<string>();
  for (const entry of Object.values(manifest.web_exports)) {
    for (const id of entry.conversation_ids) {
      ids.add(id);
    }
  }
  return ids;
}
