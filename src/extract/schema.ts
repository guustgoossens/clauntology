/**
 * Extraction Output Schema
 *
 * Defines all TypeScript types for the LLM extraction pipeline output.
 * The extraction pipeline analyzes Claude conversations (web + code) and
 * produces structured data about the user: skills, topics, projects,
 * people, beliefs, questions, thinking patterns, emotional tone, and
 * growth signals.
 *
 * Each extraction requires evidence (quotes) for every claim and a
 * confidence score (0-1). Skills reference the homo universalis taxonomy
 * via taxonomy_path strings (e.g. "Technical & Engineering/AI & Machine Learning/LLM Engineering").
 *
 * @see PLAN.md — EXTRACTION_OUTPUT_SCHEMA section
 * @see ../graph/taxonomy.ts — the full skill taxonomy tree
 */

// ============================================
// Constants
// ============================================

/**
 * The 8 homo universalis domains.
 * These are the root categories of the skill taxonomy, covering the
 * complete map of human capability.
 */
export const DOMAINS = [
  "Cognitive & Intellectual",
  "Technical & Engineering",
  "Business & Entrepreneurship",
  "Social & Interpersonal",
  "Creative & Artistic",
  "Physical & Embodied",
  "Self & Inner Development",
  "Knowledge Domains",
] as const;

/** Union type of the 8 domain names. */
export type Domain = (typeof DOMAINS)[number];

/**
 * Depth levels for skill/topic assessment.
 * Maps verbal descriptions to numeric scores (0-5 scale).
 *
 * - awareness (1): mentioned or asked about
 * - exploration (2): actively learning, asking questions
 * - application (3): using in projects, making decisions with it
 * - fluency (4): teaching others, deep understanding, creative application
 * - mastery (5): pushing boundaries, novel contributions, integrated into identity
 */
export const DEPTH_LEVELS = {
  awareness: 1,
  exploration: 2,
  application: 3,
  fluency: 4,
  mastery: 5,
} as const;

/** Union type of depth level strings. */
export type DepthLevel = keyof typeof DEPTH_LEVELS;

/** Numeric depth score (1-5). */
export type DepthScore = (typeof DEPTH_LEVELS)[DepthLevel];

/**
 * Energy/engagement levels used in emotional tone assessment.
 */
export const ENERGY_LEVELS = ["low", "medium", "high"] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

/**
 * Project status values.
 */
export const PROJECT_STATUSES = ["active", "completed", "abandoned", "idea"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/**
 * Curiosity depth levels for questions.
 * - casual: passing interest, asked offhand
 * - serious: genuine curiosity, spent time exploring
 * - obsessive: deep, recurring preoccupation
 */
export const CURIOSITY_DEPTHS = ["casual", "serious", "obsessive"] as const;
export type CuriosityDepth = (typeof CURIOSITY_DEPTHS)[number];

// ============================================
// Extracted Entity Types
// ============================================

/**
 * A topic discussed in the conversation.
 *
 * Topics are subjects of discussion — they may or may not map directly
 * to a skill in the taxonomy. Topics capture what was talked about,
 * while skills capture demonstrated capability.
 */
export interface ExtractedTopic {
  /** The name/label of the topic (e.g. "RAG architecture", "Belgian tax law"). */
  name: string;

  /** Which of the 8 homo universalis domains this topic falls under. */
  domain: Domain;

  /**
   * How deeply the topic was engaged with in this conversation.
   * awareness = just mentioned; mastery = pushing boundaries.
   */
  depth: DepthLevel;

  /** Brief description of what was discussed about this topic. */
  description: string;

  /**
   * Exact quotes from the conversation that evidence this topic being discussed.
   * At least one quote is required.
   */
  quotes: string[];

  /** Confidence in the extraction (0.0 = uncertain, 1.0 = certain). */
  confidence: number;
}

/**
 * A skill demonstrated or practiced in the conversation.
 *
 * Skills map to the homo universalis taxonomy. The taxonomy_path
 * references the tree structure: "Domain/Family/Skill".
 *
 * @example
 * {
 *   name: "LLM Engineering",
 *   taxonomy_path: "Technical & Engineering/AI & Machine Learning/LLM Engineering",
 *   level_demonstrated: "application",
 *   evidence: "Designed a multi-stage RAG pipeline with custom retrieval strategies",
 *   quotes: ["I want to build a RAG system that doesn't just retrieve but actually reasons..."],
 *   confidence: 0.85
 * }
 */
export interface ExtractedSkill {
  /** The skill name, should match or closely relate to a taxonomy leaf node. */
  name: string;

  /**
   * Path in the homo universalis taxonomy tree.
   * Format: "Domain/Family/Skill"
   * e.g. "Technical & Engineering/AI & Machine Learning/LLM Engineering"
   *
   * Must reference a valid path from the taxonomy defined in
   * src/graph/taxonomy.ts. The resolver step will fuzzy-match
   * if the path is slightly off.
   */
  taxonomy_path: string;

  /**
   * The depth level demonstrated in this conversation.
   * awareness = mentioned; mastery = novel contributions.
   */
  level_demonstrated: DepthLevel;

  /** Description of what specifically demonstrates this skill. */
  evidence: string;

  /** Exact quotes from the conversation as evidence. */
  quotes: string[];

  /** Confidence in the extraction (0.0-1.0). */
  confidence: number;
}

/**
 * A project mentioned or worked on in the conversation.
 *
 * Projects are things being built, created, or planned.
 * They connect to skills (via taxonomy paths) and tech stack items.
 */
export interface ExtractedProject {
  /** Project name (e.g. "Accaio", "HackStral", "Ontolo GG"). */
  name: string;

  /** Brief description of what the project is/does. */
  description: string;

  /** Current status of the project as evidenced in this conversation. */
  status: ProjectStatus;

  /** Technologies, frameworks, and tools used in the project. */
  tech_stack: string[];

  /**
   * Taxonomy paths of skills used in this project.
   * Each entry should be a valid taxonomy_path string.
   * e.g. ["Technical & Engineering/Software Engineering/Frontend Development",
   *        "Technical & Engineering/AI & Machine Learning/RAG Systems"]
   */
  skills_used: string[];
}

/**
 * A person mentioned in the conversation.
 *
 * People can be named or referenced by role (e.g. "my girlfriend",
 * "the CTO"). The entity resolver will later merge references
 * to the same person across conversations.
 */
export interface ExtractedPerson {
  /**
   * Name if mentioned, otherwise a descriptive role.
   * e.g. "Arthur", "my girlfriend", "the professor", "co-founder"
   */
  name: string;

  /**
   * Relationship to the user.
   * e.g. "girlfriend", "friend", "co-founder", "professor", "mentor", "colleague"
   */
  relationship: string;

  /** Context in which this person was mentioned. */
  context: string;

  /** Quotes referencing this person. */
  quotes: string[];
}

/**
 * A belief, opinion, value, or worldview element expressed by the user.
 *
 * Beliefs are things the user holds to be true or important.
 * They reveal values, assumptions, and the user's mental models.
 */
export interface ExtractedBelief {
  /**
   * The belief statement.
   * Should be phrased as a clear, self-contained assertion.
   * e.g. "The best code is code that doesn't need comments"
   * e.g. "AI will fundamentally change how accounting works"
   */
  statement: string;

  /** Which domain this belief relates to. */
  domain: Domain;

  /**
   * How strongly the user appears to hold this belief (0.0-1.0).
   * 0.0 = tentative, exploring; 1.0 = deeply held conviction.
   */
  confidence_held: number;

  /** Quotes evidencing this belief. */
  quotes: string[];

  /**
   * Whether this appears to be a newly formed belief (first time expressed)
   * vs. a reinforcement of something previously established.
   * The LLM judges this from context within the single conversation;
   * cross-conversation tracking happens in the resolver.
   */
  is_new: boolean;
}

/**
 * A question the user asked or expressed curiosity about.
 *
 * Questions reveal what the user doesn't know (yet), what they're
 * curious about, and how deeply they care about finding answers.
 */
export interface ExtractedQuestion {
  /** The question text, paraphrased as a clear question. */
  text: string;

  /** Which domain this question relates to. */
  domain: Domain;

  /**
   * How deep the curiosity goes.
   * casual = passing interest; serious = genuine exploration;
   * obsessive = deep, recurring preoccupation.
   */
  depth: CuriosityDepth;

  /** Whether the question was answered within this conversation. */
  answered: boolean;
}

/**
 * A thinking pattern observed in the conversation.
 *
 * Thinking patterns capture HOW the user thinks, not WHAT they think about.
 * These reveal cognitive style: first-principles, analogy-based,
 * systems-level, exploratory, perfectionist, etc.
 */
export interface ExtractedThinkingPattern {
  /**
   * Name of the thinking pattern.
   * e.g. "First-principles reasoning", "Analogy-based thinking",
   *      "Rapid prototyping mindset", "Perfectionist iteration"
   */
  pattern: string;

  /** Description of how this pattern manifested in the conversation. */
  evidence: string;

  /** Exact quotes demonstrating this thinking pattern. */
  quotes: string[];
}

/**
 * The emotional character of the conversation.
 *
 * Captures the mood, energy, and engagement level — useful for
 * understanding the user's emotional relationship to different topics.
 */
export interface EmotionalTone {
  /**
   * Primary emotional tone.
   * e.g. "excited", "frustrated", "curious", "focused", "playful",
   *      "anxious", "determined", "reflective", "overwhelmed"
   */
  primary: string;

  /**
   * Secondary/underlying emotional tone, if present.
   * e.g. "impatient" underneath "excited", "insecure" underneath "determined"
   */
  secondary: string | null;

  /** Energy level of the conversation. */
  energy_level: EnergyLevel;

  /**
   * How engaged/invested the user was.
   * low = going through the motions; high = deeply absorbed.
   */
  engagement_level: EnergyLevel;
}

/**
 * A signal of growth, learning, or development.
 *
 * Growth signals capture moments where the user is changing —
 * learning something new, shifting a belief, developing a skill,
 * or having an insight.
 */
export interface GrowthSignal {
  /** The area of growth (skill name, topic, domain, or personal quality). */
  area: string;

  /** Description of what changed or developed. */
  signal: string;

  /** Evidence from the conversation supporting this growth signal. */
  evidence: string;
}

// ============================================
// Top-Level Extraction Result
// ============================================

/**
 * The complete extraction output for a single conversation.
 *
 * This is the top-level type returned by the LLM for each conversation.
 * It contains all extracted entities plus summary and insight fields.
 * Every entity includes evidence (quotes) and confidence scores.
 *
 * @see PLAN.md — EXTRACTION_OUTPUT_SCHEMA
 */
export interface ConversationExtraction {
  /** Topics discussed in the conversation. */
  topics: ExtractedTopic[];

  /** Skills demonstrated or practiced. */
  skills: ExtractedSkill[];

  /** Projects mentioned or worked on. */
  projects: ExtractedProject[];

  /** People mentioned or referenced. */
  people: ExtractedPerson[];

  /** Beliefs, opinions, and values expressed. */
  beliefs: ExtractedBelief[];

  /** Questions the user asked or expressed curiosity about. */
  questions_asked: ExtractedQuestion[];

  /** Observed thinking/cognitive patterns. */
  thinking_patterns: ExtractedThinkingPattern[];

  /** Emotional character of the conversation. */
  emotional_tone: EmotionalTone;

  /** Signals of growth, learning, or development. */
  growth_signals: GrowthSignal[];

  /**
   * 2-3 sentence summary of the conversation.
   * Should capture the main purpose, key decisions, and outcome.
   */
  conversation_summary: string;

  /**
   * The single most important thing this conversation reveals about the person.
   * Should be a focused, insightful observation — not a generic summary.
   */
  key_insight: string;
}

// ============================================
// Cache & Metadata Types
// ============================================

/**
 * Current version of the extraction schema/prompt.
 * Bump this whenever the extraction prompt or expected output format changes.
 * This allows the pipeline to detect stale extractions and re-process them.
 */
export const EXTRACTION_VERSION = 1;

/**
 * Metadata about a single extraction run.
 * Stored alongside the extraction result for cache invalidation
 * and provenance tracking.
 */
export interface ExtractionMetadata {
  /** ID of the conversation that was extracted. */
  conversation_id: string;

  /** ISO 8601 timestamp of when extraction was performed. */
  extracted_at: string;

  /**
   * Which model was used for extraction.
   * e.g. "claude-opus-4-20250514", "claude-sonnet-4-20250514"
   */
  model_used: string;

  /**
   * Version of the extraction prompt/schema used.
   * If this doesn't match EXTRACTION_VERSION, the extraction is stale
   * and should be re-run.
   */
  extraction_version: number;

  /** How long the extraction took in milliseconds. */
  duration_ms: number;

  /**
   * Token usage for this extraction call.
   * Useful for cost tracking and optimization.
   */
  token_usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * A cached extraction result — the extraction output plus metadata.
 * This is the format stored on disk in data/extractions/{web,code}/.
 *
 * Files are named by conversation ID: `{conversation_id}.json`
 */
export interface CachedExtraction {
  /** The extraction result itself. */
  extraction: ConversationExtraction;

  /** Metadata about the extraction run. */
  metadata: ExtractionMetadata;
}

/**
 * The extraction cache index — a lightweight manifest of all cached extractions.
 * Used for quick lookups without reading individual extraction files.
 *
 * This maps to the `extraction_cache` field in the processing manifest
 * defined in PLAN.md.
 */
export interface ExtractionCacheIndex {
  [conversation_id: string]: {
    /** ISO 8601 timestamp of when extraction was performed. */
    extracted_at: string;

    /** Model used for extraction. */
    model_used: string;

    /** Extraction schema version (compare against EXTRACTION_VERSION). */
    extraction_version: number;
  };
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Check if a string is a valid domain name.
 */
export function isValidDomain(value: string): value is Domain {
  return (DOMAINS as readonly string[]).includes(value);
}

/**
 * Check if a string is a valid depth level.
 */
export function isValidDepthLevel(value: string): value is DepthLevel {
  return value in DEPTH_LEVELS;
}

/**
 * Check if a string is a valid project status.
 */
export function isValidProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

/**
 * Check if a string is a valid curiosity depth.
 */
export function isValidCuriosityDepth(value: string): value is CuriosityDepth {
  return (CURIOSITY_DEPTHS as readonly string[]).includes(value);
}

/**
 * Check if a string is a valid energy/engagement level.
 */
export function isValidEnergyLevel(value: string): value is EnergyLevel {
  return (ENERGY_LEVELS as readonly string[]).includes(value);
}

/**
 * Convert a depth level string to its numeric score.
 * Returns 0 if the level is not recognized.
 */
export function depthToScore(level: string): number {
  if (isValidDepthLevel(level)) {
    return DEPTH_LEVELS[level];
  }
  return 0;
}

/**
 * Convert a numeric depth score to its string label.
 * Rounds to the nearest integer level.
 * Returns null for scores outside the 1-5 range.
 */
export function scoreToDepth(score: number): DepthLevel | null {
  const rounded = Math.round(score);
  const entries = Object.entries(DEPTH_LEVELS) as [DepthLevel, number][];
  const match = entries.find(([, value]) => value === rounded);
  return match ? match[0] : null;
}

/**
 * Create an empty ConversationExtraction with all arrays/fields initialized.
 * Useful as a starting point or fallback for failed extractions.
 */
export function emptyExtraction(): ConversationExtraction {
  return {
    topics: [],
    skills: [],
    projects: [],
    people: [],
    beliefs: [],
    questions_asked: [],
    thinking_patterns: [],
    emotional_tone: {
      primary: "neutral",
      secondary: null,
      energy_level: "medium",
      engagement_level: "medium",
    },
    growth_signals: [],
    conversation_summary: "",
    key_insight: "",
  };
}
