import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { EXTRACTION_SYSTEM_PROMPT, buildUserPromptFromNormalized } from "./prompts";
import { EXTRACTION_VERSION, type ConversationExtraction, type CachedExtraction } from "./schema";
import type { NormalizedConversation } from "../ingest/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchOptions {
  concurrency: number; // default 3
  delayMs: number; // default 1000
  force: boolean; // re-extract even if cached
  dryRun: boolean; // just log what would be done
  maxTokens: number; // max output tokens, default 8192
  outputDir: string; // where to save extractions
}

const DEFAULT_OPTIONS: BatchOptions = {
  concurrency: 3,
  delayMs: 1000,
  force: false,
  dryRun: false,
  maxTokens: 8192,
  outputDir: "data/extractions",
};

const MODEL = "claude-opus-4-6" as const;
const MAX_CONVERSATION_CHARS = 100_000;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function createClient(): Anthropic {
  // Bun auto-loads .env — ANTHROPIC_API_KEY is read by the SDK automatically
  return new Anthropic();
}

// ---------------------------------------------------------------------------
// Conversation truncation
// ---------------------------------------------------------------------------

/**
 * Truncates a conversation that exceeds the character limit.
 * Keeps the first few and last few messages, inserting a truncation notice.
 */
function truncateConversation(
  conversation: NormalizedConversation
): NormalizedConversation {
  const totalChars = conversation.messages.reduce(
    (sum, m) => sum + m.text.length,
    0
  );

  if (totalChars <= MAX_CONVERSATION_CHARS) {
    return conversation;
  }

  const messages = conversation.messages;
  const keepFirst = Math.min(Math.ceil(messages.length * 0.3), 20);
  const keepLast = Math.min(Math.ceil(messages.length * 0.3), 20);

  // If the conversation is short enough in message count, just keep all
  if (keepFirst + keepLast >= messages.length) {
    return conversation;
  }

  const firstMessages = messages.slice(0, keepFirst);
  const lastMessages = messages.slice(-keepLast);
  const skippedCount = messages.length - keepFirst - keepLast;

  const truncationNotice = {
    id: "truncation-notice",
    role: "user" as const,
    text: `[--- ${skippedCount} messages truncated (conversation too long: ${totalChars.toLocaleString()} chars). Showing first ${keepFirst} and last ${keepLast} messages. ---]`,
    timestamp: firstMessages[firstMessages.length - 1].timestamp,
    attachments: [],
  };

  return {
    ...conversation,
    messages: [...firstMessages, truncationNotice, ...lastMessages],
    metadata: {
      ...conversation.metadata,
      message_count: firstMessages.length + 1 + lastMessages.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Single conversation extraction
// ---------------------------------------------------------------------------

/**
 * Sends a single conversation to Claude API and returns the structured extraction.
 * Handles JSON parsing errors with a single retry asking the model to fix the output.
 */
export async function extractConversation(
  conversation: NormalizedConversation,
  options?: { maxTokens?: number }
): Promise<ConversationExtraction> {
  const client = createClient();
  const maxTokens = options?.maxTokens ?? DEFAULT_OPTIONS.maxTokens;

  // Truncate if needed
  const prepared = truncateConversation(conversation);
  const userPrompt = buildUserPromptFromNormalized(prepared);

  // First attempt
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawText = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Attempt to parse JSON
  const parsed = tryParseJSON(rawText);
  if (parsed !== null) {
    return parsed as ConversationExtraction;
  }

  // Retry: ask the model to fix the malformed JSON
  console.warn(
    `  [retry] Malformed JSON for conversation ${conversation.id}, asking for fix...`
  );

  const retryResponse = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: userPrompt },
      { role: "assistant", content: rawText },
      {
        role: "user",
        content:
          "Your previous response contained malformed JSON. Please return ONLY valid JSON matching the extraction schema. No markdown fences, no commentary — just the raw JSON object.",
      },
    ],
  });

  const retryText = retryResponse.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const retryParsed = tryParseJSON(retryText);
  if (retryParsed !== null) {
    return retryParsed as ConversationExtraction;
  }

  throw new Error(
    `Failed to parse extraction JSON for conversation ${conversation.id} after retry.\n` +
      `Raw output (first 500 chars): ${retryText.slice(0, 500)}`
  );
}

/**
 * Tries to parse JSON from a string, handling common issues like
 * markdown code fences wrapping the JSON.
 */
function tryParseJSON(text: string): unknown | null {
  // Strip markdown code fences if present
  let cleaned = text.trim();

  // Handle ```json ... ``` wrapping
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try direct parse
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find a JSON object in the text
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Semaphore for concurrency control
// ---------------------------------------------------------------------------

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly limit: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// ---------------------------------------------------------------------------
// Batch extraction
// ---------------------------------------------------------------------------

/**
 * Processes a batch of conversations with concurrency control, rate limiting,
 * progress logging, caching, and graceful shutdown.
 */
export async function extractBatch(
  conversations: NormalizedConversation[],
  options: Partial<BatchOptions> = {}
): Promise<void> {
  const opts: BatchOptions = { ...DEFAULT_OPTIONS, ...options };

  // Graceful shutdown state
  let shutdownRequested = false;
  const onSigint = () => {
    if (shutdownRequested) {
      console.log("\nForce quit.");
      process.exit(1);
    }
    shutdownRequested = true;
    console.log(
      "\nGraceful shutdown requested. Finishing current extractions..."
    );
  };
  process.on("SIGINT", onSigint);

  // Ensure output directories exist
  const webDir = join(opts.outputDir, "web");
  const codeDir = join(opts.outputDir, "code");
  if (!opts.dryRun) {
    mkdirSync(webDir, { recursive: true });
    mkdirSync(codeDir, { recursive: true });
  }

  // Determine which conversations need processing
  const toProcess: NormalizedConversation[] = [];
  const skipped: string[] = [];

  for (const conv of conversations) {
    const outPath = getOutputPath(conv, opts.outputDir);
    if (!opts.force && existsSync(outPath)) {
      skipped.push(conv.id);
    } else {
      toProcess.push(conv);
    }
  }

  console.log(`\n--- Batch Extraction ---`);
  console.log(`Total conversations: ${conversations.length}`);
  console.log(`Already extracted (skipping): ${skipped.length}`);
  console.log(`To extract: ${toProcess.length}`);
  console.log(`Concurrency: ${opts.concurrency}`);
  console.log(`Delay between requests: ${opts.delayMs}ms`);
  console.log(`Output directory: ${opts.outputDir}`);
  if (opts.force) console.log(`Force mode: re-extracting all`);
  if (opts.dryRun) {
    console.log(`\nDry run — no extractions will be performed.`);
    for (const conv of toProcess) {
      console.log(
        `  Would extract: [${conv.source}] ${conv.title} (${conv.id})`
      );
    }
    process.removeListener("SIGINT", onSigint);
    return;
  }

  if (toProcess.length === 0) {
    console.log("\nNothing to extract.");
    process.removeListener("SIGINT", onSigint);
    return;
  }

  // Processing state
  const semaphore = new Semaphore(opts.concurrency);
  let completed = 0;
  let errors = 0;
  const startTime = Date.now();
  const processingTimes: number[] = [];

  // Process all conversations
  const promises = toProcess.map(async (conv) => {
    // Check for shutdown before acquiring semaphore
    if (shutdownRequested) return;

    await semaphore.acquire();

    // Check again after acquiring (may have been waiting)
    if (shutdownRequested) {
      semaphore.release();
      return;
    }

    const taskStart = Date.now();

    try {
      console.log(
        `\n  [${completed + 1}/${toProcess.length}] Extracting: ${conv.title || conv.id}`
      );
      console.log(
        `    Source: ${conv.source} | Messages: ${conv.metadata.message_count} | ID: ${conv.id}`
      );

      const extraction = await extractConversation(conv, {
        maxTokens: opts.maxTokens,
      });

      // Wrap in CachedExtraction
      const elapsed = Date.now() - taskStart;
      const cached: CachedExtraction = {
        extraction,
        metadata: {
          conversation_id: conv.id,
          extracted_at: new Date().toISOString(),
          model_used: MODEL,
          extraction_version: EXTRACTION_VERSION,
          duration_ms: elapsed,
          token_usage: { input_tokens: 0, output_tokens: 0 }, // TODO: capture from response
        },
      };

      // Save to disk
      const outPath = getOutputPath(conv, opts.outputDir);
      await Bun.write(outPath, JSON.stringify(cached, null, 2));

      processingTimes.push(elapsed);
      completed++;

      // Progress logging
      const avgTime =
        processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const remaining = toProcess.length - completed - errors;
      const etaMs = remaining * avgTime;
      const etaStr = formatDuration(etaMs);

      console.log(
        `    Done in ${formatDuration(elapsed)} | ${completed}/${toProcess.length} complete | ETA: ${etaStr}`
      );
    } catch (err) {
      errors++;
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      console.error(`    ERROR extracting ${conv.id}: ${errorMessage}`);

      // Save error info to disk so we can retry later
      try {
        const errorInfo = {
          conversation_id: conv.id,
          conversation_title: conv.title,
          source: conv.source,
          error: errorMessage,
          failed_at: new Date().toISOString(),
          model: MODEL,
          extraction_version: EXTRACTION_VERSION,
        };
        const errorPath = getOutputPath(conv, opts.outputDir).replace(
          ".json",
          ".error.json"
        );
        await Bun.write(errorPath, JSON.stringify(errorInfo, null, 2));
      } catch {
        // If we can't even save the error, just log it
        console.error(`    Could not save error info for ${conv.id}`);
      }
    } finally {
      semaphore.release();

      // Rate limiting delay
      if (!shutdownRequested) {
        await sleep(opts.delayMs);
      }
    }
  });

  await Promise.all(promises);

  // Final summary
  const totalTime = Date.now() - startTime;
  console.log(`\n--- Extraction Complete ---`);
  console.log(`Completed: ${completed}/${toProcess.length}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total time: ${formatDuration(totalTime)}`);
  if (completed > 0) {
    const avg =
      processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    console.log(`Average per conversation: ${formatDuration(avg)}`);
  }
  if (shutdownRequested) {
    console.log(`Shutdown was requested — some conversations may be skipped.`);
  }

  process.removeListener("SIGINT", onSigint);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOutputPath(conv: NormalizedConversation, outputDir: string): string {
  const subDir = conv.source === "claude_web" ? "web" : "code";
  return join(outputDir, subDir, `${conv.id}.json`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
