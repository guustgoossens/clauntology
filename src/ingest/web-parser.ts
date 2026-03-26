/**
 * Claude Web conversation export parser.
 * Reads conversations.json from a Claude web data export
 * and normalizes to NormalizedConversation format.
 */

import type {
  WebConversation,
  WebMessage,
  WebContentBlock,
  NormalizedConversation,
  NormalizedMessage,
} from "./types.ts";

/**
 * Extract clean text from a web message's content blocks.
 * Includes text and voice_note types. Skips tool_use, tool_result, token_budget, flag.
 * Thinking blocks are included but marked.
 */
function extractTextFromContentBlocks(blocks: WebContentBlock[]): string {
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === "text" && block.text) {
      parts.push(block.text.trim());
    } else if (block.type === "voice_note" && block.text) {
      parts.push(`[Voice note] ${block.text.trim()}`);
    } else if (block.type === "thinking" && block.text) {
      // Include thinking — it reveals reasoning patterns
      parts.push(`[Thinking] ${block.text.trim()}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Convert a single web message to normalized format.
 */
function normalizeWebMessage(msg: WebMessage): NormalizedMessage | null {
  const text = msg.content?.length
    ? extractTextFromContentBlocks(msg.content)
    : msg.text?.trim() ?? "";

  if (!text) return null;

  const attachments = (msg.files ?? [])
    .map((f) => f.file_name)
    .filter(Boolean);

  return {
    id: msg.uuid,
    role: msg.sender === "human" ? "user" : "assistant",
    text,
    timestamp: msg.created_at,
    attachments,
  };
}

/**
 * Check what content types are present in a conversation.
 */
function analyzeContentTypes(messages: WebMessage[]) {
  let has_voice = false;
  let has_thinking = false;
  let has_tool_use = false;
  const file_names: string[] = [];

  for (const msg of messages) {
    for (const block of msg.content ?? []) {
      if (block.type === "voice_note") has_voice = true;
      if (block.type === "thinking") has_thinking = true;
      if (block.type === "tool_use") has_tool_use = true;
    }
    for (const file of msg.files ?? []) {
      if (file.file_name) file_names.push(file.file_name);
    }
  }

  return { has_voice, has_thinking, has_tool_use, file_names };
}

/**
 * Parse a single web conversation into normalized format.
 * Returns null if the conversation has no meaningful messages.
 */
export function parseWebConversation(
  conv: WebConversation,
  projectName?: string
): NormalizedConversation | null {
  if (!conv.chat_messages?.length) return null;

  const messages = conv.chat_messages
    .map(normalizeWebMessage)
    .filter((m): m is NormalizedMessage => m !== null);

  if (messages.length === 0) return null;

  const analysis = analyzeContentTypes(conv.chat_messages);

  return {
    id: conv.uuid,
    title: conv.name ?? `Untitled (${conv.created_at.slice(0, 10)})`,
    source: "claude_web",
    platform_project: projectName ?? "default",
    created_at: conv.created_at,
    updated_at: conv.updated_at,
    messages,
    metadata: {
      message_count: messages.length,
      has_files: analysis.file_names.length > 0,
      file_names: analysis.file_names,
      has_voice: analysis.has_voice,
      has_thinking: analysis.has_thinking,
      has_tool_use: analysis.has_tool_use,
    },
  };
}

/**
 * Parse an entire web export conversations.json file.
 * Returns all conversations that have meaningful content.
 */
export async function parseWebExport(
  conversationsJsonPath: string
): Promise<NormalizedConversation[]> {
  const file = Bun.file(conversationsJsonPath);
  const data = (await file.json()) as WebConversation[];

  console.log(`[web-parser] Loaded ${data.length} conversations from export`);

  const normalized: NormalizedConversation[] = [];
  let skipped = 0;

  for (const conv of data) {
    const result = parseWebConversation(conv);
    if (result) {
      normalized.push(result);
    } else {
      skipped++;
    }
  }

  console.log(
    `[web-parser] Parsed ${normalized.length} conversations (${skipped} empty/skipped)`
  );

  return normalized;
}
