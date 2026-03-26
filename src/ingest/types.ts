// ============================================
// Normalized conversation format (common output)
// ============================================

export interface NormalizedConversation {
  id: string;
  title: string;
  source: "claude_web" | "claude_code";
  platform_project: string;
  created_at: string;
  updated_at: string;
  messages: NormalizedMessage[];
  metadata: {
    message_count: number;
    has_files: boolean;
    file_names: string[];
    has_voice: boolean;
    has_thinking: boolean;
    has_tool_use: boolean;
  };
}

export interface NormalizedMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  attachments: string[];
}

// ============================================
// Claude Web export types
// ============================================

export interface WebExportData {
  conversations: WebConversation[];
  projects: WebProject[];
  memories: WebMemory[];
  users: WebUser[];
}

export interface WebConversation {
  uuid: string;
  name: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
  account: { uuid: string };
  chat_messages: WebMessage[];
}

export interface WebMessage {
  uuid: string;
  text: string;
  content: WebContentBlock[];
  sender: "human" | "assistant";
  created_at: string;
  updated_at: string;
  attachments: unknown[];
  files: Array<{ file_name: string }>;
}

export interface WebContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result" | "voice_note" | "token_budget" | "flag";
  text?: string;
  start_timestamp?: string;
  stop_timestamp?: string;
  flags?: unknown;
  citations?: unknown[];
}

export interface WebProject {
  uuid: string;
  name: string;
  description: string;
  is_private: boolean;
  prompt_template: string;
  created_at: string;
  updated_at: string;
  creator: { uuid: string; full_name: string };
  docs: unknown[];
}

export interface WebMemory {
  conversations_memory: string;
  project_memories: Record<string, string>;
  account_uuid: string;
}

export interface WebUser {
  uuid: string;
  full_name: string;
  email_address: string;
}

// ============================================
// Claude Code session types
// ============================================

export interface CodeSessionLine {
  type: "user" | "assistant" | "progress" | "file-history-snapshot" | "system" | "queue-operation" | "last-prompt" | "custom-title" | "agent-name";
  parentUuid?: string;
  isSidechain?: boolean;
  sessionId?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  timestamp?: string;
  uuid?: string;
  message?: CodeMessage;
  // progress-specific
  data?: unknown;
}

export interface CodeMessage {
  role: "user" | "assistant";
  content: string | CodeContentBlock[];
  model?: string;
  id?: string;
  stop_reason?: string | null;
  usage?: Record<string, unknown>;
}

export interface CodeContentBlock {
  type: "text" | "thinking" | "tool_use" | "tool_result";
  text?: string;
  thinking?: string;
  name?: string;          // tool name for tool_use
  input?: unknown;        // tool input for tool_use
  id?: string;            // tool_use_id
  content?: string;       // tool_result content
  tool_use_id?: string;   // for tool_result
  is_error?: boolean;     // for tool_result
}

// ============================================
// Processing manifest
// ============================================

export interface ProcessingManifest {
  last_updated: string;
  version: number;
  web_exports: Record<string, WebExportManifestEntry>;
  code_sessions: Record<string, Record<string, CodeSessionManifestEntry>>;
}

export interface WebExportManifestEntry {
  hash: string;
  processed_at: string;
  conversation_count: number;
  conversation_ids: string[];
}

export interface CodeSessionManifestEntry {
  hash: string;
  processed_at: string;
  message_count: number;
}
