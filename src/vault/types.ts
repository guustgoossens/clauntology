/**
 * Vault data types.
 * Defines the shape of data flowing from graph queries → templates → disk.
 */

// ============================================
// Page types
// ============================================

export type PageType =
  | "skill" | "topic" | "project" | "person" | "belief"
  | "era" | "conversation" | "pattern" | "domain" | "meta" | "dashboard";

/** A vault page ready to be written to disk. */
export interface VaultPage {
  /** Relative path within vault/, e.g. "skills/technical/ai-ml/llm-engineering.md" */
  path: string;
  /** Full markdown content including frontmatter */
  content: string;
  /** Display name for wikilink registry */
  displayName: string;
  /** Page type */
  type: PageType;
}

// ============================================
// Entity data (from graph queries → templates)
// ============================================

export interface ConvRef {
  convId: string;
  title: string;
  date: string;
  depth?: number;
  relevance?: number;
}

export interface SkillData {
  id: string;
  name: string;
  level: number;
  domain: string;
  family: string;
  taxonomyPath: string;
  evidenceCount: number;
  firstEvidence: string;
  lastEvidence: string;
  evidence: ConvRef[];
  taxonomyNodeId: string | null;
}

export interface TopicData {
  id: string;
  name: string;
  domain: string;
  description: string;
  depth: number;
  evidenceCount: number;
  firstDiscussed: string;
  lastDiscussed: string;
  conversations: ConvRef[];
}

export interface ProjectData {
  id: string;
  name: string;
  description: string;
  status: string;
  techStack: string[];
  domain: string;
  conversations: ConvRef[];
  skillsUsed: string[];
}

export interface PersonData {
  id: string;
  name: string;
  relationship: string;
  context: string;
  mentionCount: number;
  firstMentioned: string;
  lastMentioned: string;
}

export interface BeliefData {
  id: string;
  statement: string;
  domain: string;
  confidence: number;
  evidenceCount: number;
  firstExpressed: string;
  lastExpressed: string;
  evolution: string;
  conversations: ConvRef[];
}

export interface EraData {
  id: string;
  label: string;
  description: string;
  startDate: string;
  endDate: string;
  conversationCount: number;
}

export interface ConversationData {
  id: string;
  title: string;
  source: string;
  platformProject: string;
  summary: string;
  date: string;
  messageCount: number;
  keyTopics: string[];
  emotionalTone: string;
  thinkingPattern: string;
  /** Full messages from normalized JSON */
  messages: Array<{ role: string; text: string; timestamp?: string }>;
  /** Linked entity names for wikilinks */
  linkedTopics: string[];
  linkedSkills: string[];
  linkedProjects: string[];
  linkedPeople: string[];
}

export interface PatternData {
  pattern: string;
  frequency: number;
  conversations: ConvRef[];
}

export interface DomainData {
  id: string;
  name: string;
  description: string;
  skillCount: number;
  avgLevel: number;
  maxLevel: number;
  skills: Array<{ name: string; level: number }>;
  families: Array<{ name: string; skillCount: number }>;
}

export interface QuestionData {
  text: string;
  domain: string;
  depth: string;
  answered: boolean;
}

// ============================================
// All data bundle (passed to generator)
// ============================================

export interface VaultData {
  skills: SkillData[];
  topics: TopicData[];
  projects: ProjectData[];
  people: PersonData[];
  beliefs: BeliefData[];
  eras: EraData[];
  conversations: ConversationData[];
  patterns: PatternData[];
  domains: DomainData[];
  questions: QuestionData[];
  stats: Record<string, number>;
}
