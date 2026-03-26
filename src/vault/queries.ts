/**
 * Vault-specific graph queries.
 * Uses two-step approach: fetch nodes, then batch-fetch relationships.
 * KuzuDB doesn't support collect(DISTINCT {...}) so we avoid that.
 */

import { query } from "../graph/db.ts";
import type {
  SkillData, TopicData, ProjectData, PersonData,
  BeliefData, EraData, ConversationData, PatternData,
  DomainData, QuestionData, ConvRef, VaultData,
} from "./types.ts";
import { getGraphStats } from "../graph/queries.ts";

function esc(s: string): string {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ============================================
// Skills
// ============================================

export function getAllSkillsFull(): SkillData[] {
  // Step 1: Get all skills
  const skills = query(`
    MATCH (s:Skill)
    OPTIONAL MATCH (s)-[:MAPS_TO]->(sn:SkillNode)
    RETURN s.id AS id, s.name AS name, s.level AS level,
           s.domain AS domain, s.family AS family,
           s.taxonomy_path AS taxonomyPath,
           s.evidence_count AS evidenceCount,
           s.first_evidence AS firstEvidence,
           s.last_evidence AS lastEvidence,
           sn.id AS taxonomyNodeId
    ORDER BY s.level DESC
  `);

  // Step 2: Get all skill→conversation evidence edges
  const evidenceRows = query(`
    MATCH (s:Skill)-[e:SKILL_EVIDENCE]->(c:Conversation)
    RETURN s.id AS skillId, c.id AS convId, c.title AS title, c.date AS date, e.depth_demonstrated AS depth
  `);

  // Group evidence by skill
  const evidenceMap = new Map<string, ConvRef[]>();
  for (const r of evidenceRows as any[]) {
    const key = r.skillId;
    if (!evidenceMap.has(key)) evidenceMap.set(key, []);
    evidenceMap.get(key)!.push({ convId: r.convId, title: r.title, date: r.date, depth: r.depth });
  }

  return skills.map((r: any) => ({
    id: r.id ?? "",
    name: r.name ?? "",
    level: r.level ?? 0,
    domain: r.domain ?? "",
    family: r.family ?? "",
    taxonomyPath: r.taxonomyPath ?? "",
    evidenceCount: r.evidenceCount ?? 0,
    firstEvidence: r.firstEvidence ?? "",
    lastEvidence: r.lastEvidence ?? "",
    taxonomyNodeId: r.taxonomyNodeId ?? null,
    evidence: evidenceMap.get(r.id) ?? [],
  }));
}

// ============================================
// Topics
// ============================================

export function getAllTopicsFull(): TopicData[] {
  const topics = query(`
    MATCH (t:Topic)
    RETURN t.id AS id, t.name AS name, t.domain AS domain,
           t.description AS description, t.depth AS depth,
           t.evidence_count AS evidenceCount,
           t.first_discussed AS firstDiscussed,
           t.last_discussed AS lastDiscussed
    ORDER BY t.evidence_count DESC
  `);

  const mentionRows = query(`
    MATCH (t:Topic)-[m:MENTIONED_IN]->(c:Conversation)
    RETURN t.id AS topicId, c.id AS convId, c.title AS title, c.date AS date, m.relevance AS relevance
  `);

  const mentionMap = new Map<string, ConvRef[]>();
  for (const r of mentionRows as any[]) {
    const key = r.topicId;
    if (!mentionMap.has(key)) mentionMap.set(key, []);
    mentionMap.get(key)!.push({ convId: r.convId, title: r.title, date: r.date, relevance: r.relevance });
  }

  return topics.map((r: any) => ({
    id: r.id ?? "",
    name: r.name ?? "",
    domain: r.domain ?? "",
    description: r.description ?? "",
    depth: r.depth ?? 0,
    evidenceCount: r.evidenceCount ?? 0,
    firstDiscussed: r.firstDiscussed ?? "",
    lastDiscussed: r.lastDiscussed ?? "",
    conversations: mentionMap.get(r.id) ?? [],
  }));
}

// ============================================
// Projects
// ============================================

export function getAllProjectsFull(): ProjectData[] {
  const projects = query(`
    MATCH (p:Project)
    RETURN p.id AS id, p.name AS name, p.description AS description,
           p.status AS status, p.tech_stack AS techStack, p.domain AS domain
    ORDER BY p.name
  `);

  const convRows = query(`
    MATCH (p:Project)-[:PROJECT_CONVERSATION]->(c:Conversation)
    RETURN p.id AS projectId, c.id AS convId, c.title AS title, c.date AS date
  `);

  const convMap = new Map<string, ConvRef[]>();
  for (const r of convRows as any[]) {
    const key = r.projectId;
    if (!convMap.has(key)) convMap.set(key, []);
    convMap.get(key)!.push({ convId: r.convId, title: r.title, date: r.date });
  }

  return projects.map((r: any) => ({
    id: r.id ?? "",
    name: r.name ?? "",
    description: r.description ?? "",
    status: r.status ?? "",
    techStack: r.techStack ?? [],
    domain: r.domain ?? "",
    conversations: convMap.get(r.id) ?? [],
    skillsUsed: [],
  }));
}

// ============================================
// People
// ============================================

export function getAllPeople(): PersonData[] {
  const rows = query(`
    MATCH (p:Person)
    WHERE p.id <> 'self'
    RETURN p.id AS id, p.name AS name, p.relationship AS relationship,
           p.context AS context, p.mention_count AS mentionCount,
           p.first_mentioned AS firstMentioned,
           p.last_mentioned AS lastMentioned
    ORDER BY p.mention_count DESC
  `);

  return rows.map((r: any) => ({
    id: r.id ?? "",
    name: r.name ?? "",
    relationship: r.relationship ?? "",
    context: r.context ?? "",
    mentionCount: r.mentionCount ?? 0,
    firstMentioned: r.firstMentioned ?? "",
    lastMentioned: r.lastMentioned ?? "",
  }));
}

// ============================================
// Beliefs
// ============================================

export function getAllBeliefsFull(): BeliefData[] {
  const beliefs = query(`
    MATCH (b:Belief)
    RETURN b.id AS id, b.statement AS statement, b.domain AS domain,
           b.confidence AS confidence, b.evidence_count AS evidenceCount,
           b.first_expressed AS firstExpressed,
           b.last_expressed AS lastExpressed,
           b.evolution AS evolution
    ORDER BY b.confidence DESC
  `);

  const evidenceRows = query(`
    MATCH (b:Belief)-[:BELIEF_EVIDENCE]->(c:Conversation)
    RETURN b.id AS beliefId, c.id AS convId, c.title AS title, c.date AS date
  `);

  const evidenceMap = new Map<string, ConvRef[]>();
  for (const r of evidenceRows as any[]) {
    const key = r.beliefId;
    if (!evidenceMap.has(key)) evidenceMap.set(key, []);
    evidenceMap.get(key)!.push({ convId: r.convId, title: r.title, date: r.date });
  }

  return beliefs.map((r: any) => ({
    id: r.id ?? "",
    statement: r.statement ?? "",
    domain: r.domain ?? "",
    confidence: r.confidence ?? 0,
    evidenceCount: r.evidenceCount ?? 0,
    firstExpressed: r.firstExpressed ?? "",
    lastExpressed: r.lastExpressed ?? "",
    evolution: r.evolution ?? "",
    conversations: evidenceMap.get(r.id) ?? [],
  }));
}

// ============================================
// Eras
// ============================================

export function getAllEras(): EraData[] {
  const rows = query(`
    MATCH (e:Era)
    OPTIONAL MATCH (e)-[:ERA_CONVERSATION]->(c:Conversation)
    WITH e, count(c) AS convCount
    RETURN e.id AS id, e.label AS label, e.description AS description,
           e.start_date AS startDate, e.end_date AS endDate,
           convCount AS conversationCount
    ORDER BY e.start_date
  `);

  return rows.map((r: any) => ({
    id: r.id ?? "",
    label: r.label ?? "",
    description: r.description ?? "",
    startDate: r.startDate ?? "",
    endDate: r.endDate ?? "",
    conversationCount: r.conversationCount ?? 0,
  }));
}

// ============================================
// Conversations
// ============================================

export function getAllConversations(): ConversationData[] {
  const rows = query(`
    MATCH (c:Conversation)
    RETURN c.id AS id, c.title AS title, c.source AS source,
           c.platform_project AS platformProject,
           c.summary AS summary, c.date AS date,
           c.message_count AS messageCount,
           c.key_topics AS keyTopics,
           c.emotional_tone AS emotionalTone,
           c.thinking_pattern AS thinkingPattern
    ORDER BY c.date DESC
  `);

  return rows.map((r: any) => ({
    id: r.id ?? "",
    title: r.title ?? "Untitled",
    source: r.source ?? "",
    platformProject: r.platformProject ?? "default",
    summary: r.summary ?? "",
    date: r.date ?? "",
    messageCount: r.messageCount ?? 0,
    keyTopics: r.keyTopics ?? [],
    emotionalTone: r.emotionalTone ?? "",
    thinkingPattern: r.thinkingPattern ?? "",
    messages: [],
    linkedTopics: [],
    linkedSkills: [],
    linkedProjects: [],
    linkedPeople: [],
  }));
}

// ============================================
// Patterns
// ============================================

export function getThinkingPatterns(): PatternData[] {
  const rows = query(`
    MATCH (c:Conversation)
    WHERE c.thinking_pattern IS NOT NULL AND c.thinking_pattern <> ''
    RETURN c.thinking_pattern AS pattern,
           collect({convId: c.id, title: c.title, date: c.date}) AS conversations,
           count(c) AS frequency
    ORDER BY frequency DESC
  `);

  return rows.map((r: any) => ({
    pattern: r.pattern ?? "",
    frequency: r.frequency ?? 0,
    conversations: (r.conversations ?? []) as ConvRef[],
  }));
}

// ============================================
// Questions
// ============================================

export function getAllQuestions(): QuestionData[] {
  const rows = query(`
    MATCH (q:Question)
    RETURN q.text AS text, q.domain AS domain,
           q.curiosity_depth AS depth, q.answered AS answered
    ORDER BY q.domain, q.curiosity_depth DESC
  `);

  return rows.map((r: any) => ({
    text: r.text ?? "",
    domain: r.domain ?? "",
    depth: r.depth ?? "casual",
    answered: r.answered ?? false,
  }));
}

// ============================================
// Domain stats
// ============================================

export function getDomainStats(): DomainData[] {
  const domains = query(`
    MATCH (d:SkillNode)
    WHERE d.node_type = 'domain'
    RETURN d.id AS id, d.name AS name, d.description AS description
    ORDER BY d.name
  `);

  return domains.map((d: any) => {
    const skills = query(`
      MATCH (s:Skill)
      WHERE s.domain = '${esc(d.name)}'
      RETURN s.name AS name, s.level AS level
      ORDER BY s.level DESC
    `);

    const families = query(`
      MATCH (f:SkillNode)-[:CHILD_OF]->(dom:SkillNode {id: '${esc(d.id)}'})
      OPTIONAL MATCH (sk:SkillNode)-[:CHILD_OF]->(f)
      WITH f, count(sk) AS cnt
      RETURN f.name AS name, cnt AS skillCount
      ORDER BY f.name
    `);

    const levels = skills.map((s: any) => s.level ?? 0);
    const avgLevel = levels.length > 0
      ? levels.reduce((a: number, b: number) => a + b, 0) / levels.length
      : 0;
    const maxLevel = levels.length > 0 ? Math.max(...levels) : 0;

    return {
      id: d.id ?? "",
      name: d.name ?? "",
      description: d.description ?? "",
      skillCount: skills.length,
      avgLevel,
      maxLevel,
      skills: skills.map((s: any) => ({ name: s.name ?? "", level: s.level ?? 0 })),
      families: families.map((f: any) => ({ name: f.name ?? "", skillCount: f.skillCount ?? 0 })),
    };
  });
}

// ============================================
// Fetch all data
// ============================================

export function queryAllData(): VaultData {
  console.log("[vault] Querying graph data...");

  const skills = getAllSkillsFull();
  console.log(`  Skills: ${skills.length}`);

  const topics = getAllTopicsFull();
  console.log(`  Topics: ${topics.length}`);

  const projects = getAllProjectsFull();
  console.log(`  Projects: ${projects.length}`);

  const people = getAllPeople();
  console.log(`  People: ${people.length}`);

  const beliefs = getAllBeliefsFull();
  console.log(`  Beliefs: ${beliefs.length}`);

  const eras = getAllEras();
  console.log(`  Eras: ${eras.length}`);

  const conversations = getAllConversations();
  console.log(`  Conversations: ${conversations.length}`);

  const patterns = getThinkingPatterns();
  console.log(`  Patterns: ${patterns.length}`);

  const domains = getDomainStats();
  console.log(`  Domains: ${domains.length}`);

  const questions = getAllQuestions();
  console.log(`  Questions: ${questions.length}`);

  const stats = getGraphStats();

  return { skills, topics, projects, people, beliefs, eras, conversations, patterns, domains, questions, stats };
}
