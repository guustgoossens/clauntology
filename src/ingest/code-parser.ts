/**
 * Claude Code session parser.
 * Reads .jsonl session files from ~/.claude/projects/
 * and normalizes to NormalizedConversation format.
 *
 * Filters out noise: progress, file-history-snapshot, queue-operation,
 * system, last-prompt messages. Extracts only user prompts and
 * assistant text responses.
 */

import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import type {
  CodeSessionLine,
  CodeContentBlock,
  NormalizedConversation,
  NormalizedMessage,
} from "./types.ts";

/** Message types we care about */
const RELEVANT_TYPES = new Set(["user", "assistant"]);

/**
 * Extract clean text from a Code session assistant message content.
 * Content can be a string (user messages) or array of content blocks (assistant).
 */
function extractTextFromCodeContent(
  content: string | CodeContentBlock[]
): { text: string; has_thinking: boolean; has_tool_use: boolean } {
  if (typeof content === "string") {
    return { text: content.trim(), has_thinking: false, has_tool_use: false };
  }

  if (!Array.isArray(content)) {
    return { text: "", has_thinking: false, has_tool_use: false };
  }

  const parts: string[] = [];
  let has_thinking = false;
  let has_tool_use = false;

  for (const block of content) {
    if (block.type === "text" && block.text) {
      parts.push(block.text.trim());
    } else if (block.type === "thinking" && block.thinking) {
      has_thinking = true;
      // Include thinking — reveals reasoning patterns
      parts.push(`[Thinking] ${block.thinking.trim()}`);
    } else if (block.type === "tool_use") {
      has_tool_use = true;
      // Don't include tool call details — too noisy
      // But note the tool name for context
      if (block.name) {
        parts.push(`[Used tool: ${block.name}]`);
      }
    }
    // Skip tool_result entirely — it's output, not the person's content
  }

  return { text: parts.join("\n\n"), has_thinking, has_tool_use };
}

/**
 * Parse a single JSONL line into a normalized message, or null if irrelevant.
 */
function parseCodeLine(line: CodeSessionLine): NormalizedMessage | null {
  if (!RELEVANT_TYPES.has(line.type)) return null;
  if (!line.message) return null;

  // Skip sidechain messages (alternative branches)
  if (line.isSidechain) return null;

  const { text, has_thinking: _ht, has_tool_use: _htu } =
    extractTextFromCodeContent(line.message.content);

  if (!text) return null;

  return {
    id: line.uuid ?? crypto.randomUUID(),
    role: line.message.role === "user" ? "user" : "assistant",
    text,
    timestamp: line.timestamp ?? "",
    attachments: [],
  };
}

/**
 * Derive a title from the first user message in a session.
 */
function deriveTitleFromMessages(messages: NormalizedMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "Untitled Session";
  // Take first 100 chars of first user message
  const text = firstUser.text.replace(/\[Thinking\].*?\n\n/gs, "").trim();
  if (text.length <= 100) return text;
  return text.slice(0, 97) + "...";
}

/**
 * Parse a single Claude Code session .jsonl file.
 */
export async function parseCodeSession(
  filePath: string,
  projectName: string
): Promise<NormalizedConversation | null> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.split("\n").filter((l) => l.trim());

  const messages: NormalizedMessage[] = [];
  let has_thinking = false;
  let has_tool_use = false;
  let firstTimestamp = "";
  let lastTimestamp = "";
  let customTitle = "";

  for (const line of lines) {
    let parsed: CodeSessionLine;
    try {
      parsed = JSON.parse(line) as CodeSessionLine;
    } catch {
      continue; // Skip malformed lines
    }

    // Capture custom title if present
    if (parsed.type === "custom-title" && (parsed as any).title) {
      customTitle = (parsed as any).title;
      continue;
    }

    // Track timestamps
    if (parsed.timestamp) {
      if (!firstTimestamp) firstTimestamp = parsed.timestamp;
      lastTimestamp = parsed.timestamp;
    }

    const msg = parseCodeLine(parsed);
    if (msg) {
      messages.push(msg);

      // Check content for metadata
      if (parsed.message) {
        const analysis = extractTextFromCodeContent(parsed.message.content);
        if (analysis.has_thinking) has_thinking = true;
        if (analysis.has_tool_use) has_tool_use = true;
      }
    }
  }

  if (messages.length === 0) return null;

  // Deduplicate messages — Code sessions can have duplicate assistant messages
  // (partial streaming updates). Keep the last message per uuid.
  const deduped = deduplicateMessages(messages);

  const sessionId = basename(filePath, ".jsonl");

  return {
    id: sessionId,
    title: customTitle || deriveTitleFromMessages(deduped),
    source: "claude_code",
    platform_project: projectName,
    created_at: firstTimestamp || new Date().toISOString(),
    updated_at: lastTimestamp || new Date().toISOString(),
    messages: deduped,
    metadata: {
      message_count: deduped.length,
      has_files: false,
      file_names: [],
      has_voice: false,
      has_thinking,
      has_tool_use,
    },
  };
}

/**
 * Deduplicate messages by ID, keeping the last occurrence (most complete).
 */
function deduplicateMessages(messages: NormalizedMessage[]): NormalizedMessage[] {
  const seen = new Map<string, NormalizedMessage>();
  for (const msg of messages) {
    seen.set(msg.id, msg);
  }
  return Array.from(seen.values());
}

/**
 * Parse all Claude Code sessions from the projects directory.
 * Returns all sessions that have meaningful content.
 */
export async function parseAllCodeSessions(
  projectsDir: string = `${process.env.HOME}/.claude/projects`
): Promise<NormalizedConversation[]> {
  const normalized: NormalizedConversation[] = [];
  let totalSessions = 0;
  let skipped = 0;

  let projects: string[];
  try {
    projects = await readdir(projectsDir);
  } catch {
    console.error(`[code-parser] Cannot read projects dir: ${projectsDir}`);
    return [];
  }

  console.log(`[code-parser] Found ${projects.length} projects`);

  for (const project of projects) {
    const projectPath = join(projectsDir, project);

    // Find all .jsonl files directly in the project directory (not in subdirs)
    let files: string[];
    try {
      const entries = await readdir(projectPath);
      files = entries.filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      totalSessions++;
      const filePath = join(projectPath, file);

      try {
        const result = await parseCodeSession(filePath, project);
        if (result) {
          normalized.push(result);
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[code-parser] Error parsing ${filePath}:`, err);
        skipped++;
      }
    }
  }

  console.log(
    `[code-parser] Parsed ${normalized.length} sessions from ${totalSessions} total (${skipped} empty/skipped)`
  );

  return normalized;
}
