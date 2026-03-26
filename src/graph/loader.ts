/**
 * Graph Loader — loads extraction JSONs into KuzuDB.
 *
 * Reads CachedExtraction files, creates/updates all entity nodes
 * and relationship edges. Uses MERGE (upsert) so it's safe to
 * re-run on the same data.
 *
 * Entity ID strategy:
 *   - Conversation: conversation UUID from extraction metadata
 *   - Topic: slugified "topic_{name}"
 *   - Skill: slugified "skill_{taxonomy_path}" (deduped across conversations)
 *   - Project: slugified "project_{name}"
 *   - Person: slugified "person_{name}"
 *   - Belief: slugified "belief_{hash(statement)}"
 *   - Question: slugified "question_{hash(text)}"
 */

import { exec, query } from "./db.ts";
import { flattenTaxonomy } from "./taxonomy.ts";
import { depthToScore } from "../extract/schema.ts";
import type {
  CachedExtraction,
  ConversationExtraction,
  ExtractedTopic,
  ExtractedSkill,
  ExtractedProject,
  ExtractedPerson,
  ExtractedBelief,
  ExtractedQuestion,
} from "../extract/schema.ts";

// ============================================
// Helpers
// ============================================

/** Escape a string for Cypher string literals. Handles null/undefined. */
function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/** Create a deterministic slug ID from a string. */
function slugify(prefix: string, value: string | null | undefined): string {
  const slug = String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return `${prefix}_${slug}`;
}

/** Simple string hash for generating IDs from long text. */
function hashStr(s: string | null | undefined): string {
  const str = String(s ?? "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return Math.abs(hash).toString(36);
}

/** Safely execute Cypher, log errors but don't crash. */
function safeExec(cypher: string, label: string): boolean {
  try {
    exec(cypher);
    return true;
  } catch (err) {
    const msg = (err as Error).message ?? "";
    // Ignore duplicate key errors (already exists)
    if (msg.includes("already exists") || msg.includes("duplicate")) return true;
    console.error(`[loader] Error in ${label}:`, msg);
    return false;
  }
}

// ============================================
// Taxonomy lookup (built once)
// ============================================

let _taxonomyIndex: Map<string, string> | null = null;

/** Build a map of taxonomy_path → SkillNode id for fast lookup. */
function getTaxonomyIndex(): Map<string, string> {
  if (_taxonomyIndex) return _taxonomyIndex;
  const flat = flattenTaxonomy();
  _taxonomyIndex = new Map();
  for (const node of flat) {
    _taxonomyIndex.set(node.taxonomy_path, node.id);
    // Also index by lowercase for fuzzy matching
    _taxonomyIndex.set(node.taxonomy_path.toLowerCase(), node.id);
  }
  return _taxonomyIndex;
}

/** Find the SkillNode ID for a taxonomy path, with fuzzy fallback. */
function findTaxonomyNodeId(taxonomyPath: string | null | undefined): string | null {
  if (!taxonomyPath) return null;
  const index = getTaxonomyIndex();

  // Exact match
  if (index.has(taxonomyPath)) return index.get(taxonomyPath)!;

  // Case-insensitive match
  const lower = taxonomyPath.toLowerCase();
  if (index.has(lower)) return index.get(lower)!;

  // Try matching just the leaf name (last segment)
  const parts = taxonomyPath.split("/");
  const leaf = parts[parts.length - 1].toLowerCase();
  for (const [path, id] of index) {
    if (path.toLowerCase().endsWith("/" + leaf)) return id;
  }

  return null;
}

// ============================================
// Node insertion functions
// ============================================

interface ConversationMeta {
  id: string;
  title: string;
  source: string;
  platform_project: string;
  created_at: string;
}

export function insertConversation(
  meta: ConversationMeta,
  extraction: ConversationExtraction
): void {
  const topicNames = extraction.topics.map((t) => t.name).slice(0, 10);
  const topicArray = topicNames.map((t) => `'${esc(t)}'`).join(", ");
  const date = meta.created_at?.split("T")[0] ?? "";

  safeExec(
    `MERGE (c:Conversation {id: '${esc(meta.id)}'})
     SET c.title = '${esc(meta.title)}',
         c.source = '${esc(meta.source)}',
         c.platform_project = '${esc(meta.platform_project)}',
         c.summary = '${esc(extraction.conversation_summary)}',
         c.date = '${date}',
         c.message_count = 0,
         c.key_topics = [${topicArray}],
         c.emotional_tone = '${esc(extraction.emotional_tone.primary)}',
         c.thinking_pattern = '${esc(extraction.thinking_patterns[0]?.pattern ?? "")}'`,
    `conversation:${meta.id}`
  );
}

export function insertTopics(
  topics: ExtractedTopic[],
  convId: string,
  convDate: string
): void {
  for (const topic of topics) {
    const id = slugify("topic", topic.name);
    const depth = depthToScore(topic.depth);

    // Upsert topic node
    safeExec(
      `MERGE (t:Topic {id: '${esc(id)}'})
       SET t.name = '${esc(topic.name)}',
           t.domain = '${esc(topic.domain)}',
           t.description = '${esc(topic.description)}',
           t.depth = CASE WHEN t.depth < ${depth} THEN ${depth} ELSE t.depth END,
           t.evidence_count = t.evidence_count + 1,
           t.first_discussed = CASE WHEN t.first_discussed IS NULL OR t.first_discussed > '${convDate}' THEN '${convDate}' ELSE t.first_discussed END,
           t.last_discussed = CASE WHEN t.last_discussed IS NULL OR t.last_discussed < '${convDate}' THEN '${convDate}' ELSE t.last_discussed END`,
      `topic:${id}`
    );

    // Link topic → conversation
    safeExec(
      `MATCH (t:Topic {id: '${esc(id)}'}), (c:Conversation {id: '${esc(convId)}'})
       MERGE (t)-[:MENTIONED_IN {relevance: ${topic.confidence}}]->(c)`,
      `topic_conv:${id}`
    );

    // Link self → topic (DISCUSSED)
    safeExec(
      `MATCH (p:Person {id: 'self'}), (t:Topic {id: '${esc(id)}'})
       MERGE (p)-[:DISCUSSED {depth: ${depth}, frequency: 1, first_date: '${convDate}', last_date: '${convDate}'}]->(t)`,
      `self_topic:${id}`
    );

    // Map topic to taxonomy domain if possible
    const taxonomyId = findTaxonomyNodeId(topic.domain);
    if (taxonomyId) {
      safeExec(
        `MATCH (t:Topic {id: '${esc(id)}'}), (sn:SkillNode {id: '${esc(taxonomyId)}'})
         MERGE (t)-[:BELONGS_TO_DOMAIN {mapping_confidence: ${topic.confidence}}]->(sn)`,
        `topic_domain:${id}`
      );
    }
  }
}

export function insertSkills(
  skills: ExtractedSkill[],
  convId: string,
  convDate: string
): void {
  for (const skill of skills) {
    const id = slugify("skill", skill.taxonomy_path || skill.name);
    const depth = depthToScore(skill.level_demonstrated);

    // Parse taxonomy path for domain/family
    const parts = (skill.taxonomy_path ?? "").split("/");
    const domain = parts[0] ?? "";
    const family = parts[1] ?? "";

    // Upsert skill node
    safeExec(
      `MERGE (s:Skill {id: '${esc(id)}'})
       SET s.name = '${esc(skill.name)}',
           s.family = '${esc(family)}',
           s.domain = '${esc(domain)}',
           s.level = CASE WHEN s.level < ${depth} THEN ${depth} ELSE s.level END,
           s.taxonomy_path = '${esc(skill.taxonomy_path)}',
           s.evidence_count = s.evidence_count + 1,
           s.is_active = true,
           s.first_evidence = CASE WHEN s.first_evidence IS NULL OR s.first_evidence > '${convDate}' THEN '${convDate}' ELSE s.first_evidence END,
           s.last_evidence = CASE WHEN s.last_evidence IS NULL OR s.last_evidence < '${convDate}' THEN '${convDate}' ELSE s.last_evidence END`,
      `skill:${id}`
    );

    // Skill → Conversation evidence
    safeExec(
      `MATCH (s:Skill {id: '${esc(id)}'}), (c:Conversation {id: '${esc(convId)}'})
       MERGE (s)-[:SKILL_EVIDENCE {depth_demonstrated: ${depth}}]->(c)`,
      `skill_conv:${id}`
    );

    // Self → Skill (DEMONSTRATED)
    safeExec(
      `MATCH (p:Person {id: 'self'}), (s:Skill {id: '${esc(id)}'})
       MERGE (p)-[:DEMONSTRATED {context: '${esc((skill.evidence ?? "").slice(0, 200))}', confidence: ${skill.confidence ?? 0.5}, date: '${convDate}'}]->(s)`,
      `self_skill:${id}`
    );

    // Skill → SkillNode taxonomy mapping
    const taxonomyNodeId = findTaxonomyNodeId(skill.taxonomy_path);
    if (taxonomyNodeId) {
      safeExec(
        `MATCH (s:Skill {id: '${esc(id)}'}), (sn:SkillNode {id: '${esc(taxonomyNodeId)}'})
         MERGE (s)-[:MAPS_TO {coverage: 1.0}]->(sn)`,
        `skill_taxonomy:${id}`
      );
    }
  }
}

export function insertProjects(
  projects: ExtractedProject[],
  convId: string,
  convDate: string
): void {
  for (const project of projects) {
    const id = slugify("project", project.name);

    // Upsert project node
    const techArray = (project.tech_stack ?? []).map((t) => `'${esc(t)}'`).join(", ");
    safeExec(
      `MERGE (pr:Project {id: '${esc(id)}'})
       SET pr.name = '${esc(project.name)}',
           pr.description = '${esc(project.description)}',
           pr.status = '${esc(project.status)}',
           pr.tech_stack = [${techArray}],
           pr.domain = ''`,
      `project:${id}`
    );

    // Project → Conversation
    safeExec(
      `MATCH (pr:Project {id: '${esc(id)}'}), (c:Conversation {id: '${esc(convId)}'})
       MERGE (pr)-[:PROJECT_CONVERSATION {relevance: 0.8}]->(c)`,
      `project_conv:${id}`
    );

    // Self → Project (WORKED_ON)
    safeExec(
      `MATCH (p:Person {id: 'self'}), (pr:Project {id: '${esc(id)}'})
       MERGE (p)-[:WORKED_ON {role: 'builder', period: '${convDate}', intensity: 'active'}]->(pr)`,
      `self_project:${id}`
    );

    // Project → Skill (USES_SKILL) for each skills_used
    for (const skillPath of project.skills_used ?? []) {
      const skillId = slugify("skill", skillPath);
      safeExec(
        `MATCH (pr:Project {id: '${esc(id)}'}), (s:Skill {id: '${esc(skillId)}'})
         MERGE (pr)-[:USES_SKILL {how: ''}]->(s)`,
        `project_skill:${id}:${skillId}`
      );
    }
  }
}

export function insertPeople(
  people: ExtractedPerson[],
  convId: string,
  convDate: string
): void {
  for (const person of people) {
    const id = slugify("person", person.name);

    safeExec(
      `MERGE (p:Person {id: '${esc(id)}'})
       SET p.name = '${esc(person.name)}',
           p.relationship = '${esc(person.relationship)}',
           p.context = '${esc((person.context ?? "").slice(0, 500))}',
           p.mention_count = p.mention_count + 1,
           p.first_mentioned = CASE WHEN p.first_mentioned IS NULL OR p.first_mentioned > '${convDate}' THEN '${convDate}' ELSE p.first_mentioned END,
           p.last_mentioned = CASE WHEN p.last_mentioned IS NULL OR p.last_mentioned < '${convDate}' THEN '${convDate}' ELSE p.last_mentioned END`,
      `person:${id}`
    );
  }
}

export function insertBeliefs(
  beliefs: ExtractedBelief[],
  convId: string,
  convDate: string
): void {
  for (const belief of beliefs) {
    const id = slugify("belief", hashStr(belief.statement));

    safeExec(
      `MERGE (b:Belief {id: '${esc(id)}'})
       SET b.statement = '${esc(belief.statement)}',
           b.domain = '${esc(belief.domain)}',
           b.confidence = ${belief.confidence_held},
           b.evidence_count = b.evidence_count + 1,
           b.first_expressed = CASE WHEN b.first_expressed IS NULL OR b.first_expressed > '${convDate}' THEN '${convDate}' ELSE b.first_expressed END,
           b.last_expressed = CASE WHEN b.last_expressed IS NULL OR b.last_expressed < '${convDate}' THEN '${convDate}' ELSE b.last_expressed END`,
      `belief:${id}`
    );

    // Belief → Conversation
    safeExec(
      `MATCH (b:Belief {id: '${esc(id)}'}), (c:Conversation {id: '${esc(convId)}'})
       MERGE (b)-[:BELIEF_EVIDENCE]->(c)`,
      `belief_conv:${id}`
    );

    // Self → Belief
    safeExec(
      `MATCH (p:Person {id: 'self'}), (b:Belief {id: '${esc(id)}'})
       MERGE (p)-[:HOLDS {strength: ${belief.confidence_held}}]->(b)`,
      `self_belief:${id}`
    );
  }
}

export function insertQuestions(
  questions: ExtractedQuestion[],
  convId: string,
  convDate: string
): void {
  for (const q of questions) {
    const id = slugify("question", hashStr(q.text));

    safeExec(
      `MERGE (q:Question {id: '${esc(id)}'})
       SET q.text = '${esc(q.text)}',
           q.domain = '${esc(q.domain)}',
           q.curiosity_depth = '${esc(q.depth ?? "casual")}',
           q.answered = ${q.answered ?? false},
           q.date = '${convDate}'`,
      `question:${id}`
    );

    // Self → Question (ASKED)
    safeExec(
      `MATCH (p:Person {id: 'self'}), (q:Question {id: '${esc(id)}'})
       MERGE (p)-[:ASKED {date: '${convDate}', context: ''}]->(q)`,
      `self_question:${id}`
    );
  }
}

/** Link a conversation to the appropriate era based on date. */
export function linkConversationToEra(convId: string, convDate: string): void {
  if (!convDate) return;

  safeExec(
    `MATCH (e:Era), (c:Conversation {id: '${esc(convId)}'})
     WHERE e.start_date <= '${convDate}'
       AND (e.end_date = '' OR e.end_date >= '${convDate}')
     MERGE (e)-[:ERA_CONVERSATION]->(c)`,
    `era_conv:${convId}`
  );
}

// ============================================
// Main loader function
// ============================================

export interface LoadResult {
  conversationId: string;
  success: boolean;
  error?: string;
}

/**
 * Load a single extraction into the graph.
 * Reads the normalized conversation for metadata, then inserts everything.
 */
export function loadExtraction(
  cached: CachedExtraction,
  convMeta: ConversationMeta
): LoadResult {
  const convId = convMeta.id;
  const convDate = convMeta.created_at?.split("T")[0] ?? "";
  const extraction = cached.extraction;

  try {
    insertConversation(convMeta, extraction);
    insertTopics(extraction.topics, convId, convDate);
    insertSkills(extraction.skills, convId, convDate);
    insertProjects(extraction.projects, convId, convDate);
    insertPeople(extraction.people, convId, convDate);
    insertBeliefs(extraction.beliefs, convId, convDate);
    insertQuestions(extraction.questions_asked, convId, convDate);
    linkConversationToEra(convId, convDate);

    return { conversationId: convId, success: true };
  } catch (err) {
    return {
      conversationId: convId,
      success: false,
      error: (err as Error).message,
    };
  }
}
