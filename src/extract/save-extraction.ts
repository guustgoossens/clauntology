/**
 * Saves an extraction result to disk.
 * Called by Claude Code after it has analyzed a conversation.
 *
 * Usage:
 *   bun run save-extraction <conversation_id> <source> <json_file>
 *
 * Example:
 *   bun run save-extraction abc123 web /tmp/extraction.json
 */

import { join } from "node:path";
import { EXTRACTION_VERSION } from "./schema.ts";
import type { CachedExtraction, ConversationExtraction } from "./schema.ts";

const ROOT = import.meta.dir.replace("/src/extract", "");
const EXTRACTION_WEB = join(ROOT, "data", "extractions", "web");
const EXTRACTION_CODE = join(ROOT, "data", "extractions", "code");

async function main() {
  const [convId, source, jsonPath] = process.argv.slice(2);

  if (!convId || !source || !jsonPath) {
    console.error("Usage: bun run save-extraction <conversation_id> <source> <json_file>");
    process.exit(1);
  }

  // Read the extraction JSON
  const extraction = await Bun.file(jsonPath).json() as ConversationExtraction;

  // Wrap in CachedExtraction
  const cached: CachedExtraction = {
    extraction,
    metadata: {
      conversation_id: convId,
      extracted_at: new Date().toISOString(),
      model_used: "claude-opus-4-6-via-claude-code",
      extraction_version: EXTRACTION_VERSION,
      duration_ms: 0,
      token_usage: { input_tokens: 0, output_tokens: 0 },
    },
  };

  // Save to appropriate directory
  const outputDir = source === "web" ? EXTRACTION_WEB : EXTRACTION_CODE;
  const outputPath = join(outputDir, `${convId}.json`);
  await Bun.write(outputPath, JSON.stringify(cached, null, 2));

  console.log(`Saved extraction for ${convId} to ${outputPath}`);
}

main().catch(console.error);
