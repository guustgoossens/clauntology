/**
 * Common Cypher query library for the Ontolo GG knowledge graph.
 * Provides typed query functions for common operations.
 */

import { query, exec } from "./db.ts";

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// ============================================
// Read queries
// ============================================

/** Get all domains with family/skill counts */
export function getDomainOverview() {
  return query(`
    MATCH (d:SkillNode)
    WHERE d.node_type = 'domain'
    RETURN d.id AS id, d.name AS name, d.description AS description
    ORDER BY d.name
  `);
}

/** Get all families within a domain */
export function getFamiliesInDomain(domainId: string) {
  return query(`
    MATCH (f:SkillNode)-[:CHILD_OF]->(d:SkillNode {id: '${esc(domainId)}'})
    RETURN f.id AS id, f.name AS name, f.description AS description
    ORDER BY f.name
  `);
}

/** Get all skills within a family */
export function getSkillsInFamily(familyId: string) {
  return query(`
    MATCH (s:SkillNode)-[:CHILD_OF]->(f:SkillNode {id: '${esc(familyId)}'})
    RETURN s.id AS id, s.name AS name, s.description AS description,
           s.taxonomy_path AS path
    ORDER BY s.name
  `);
}

/** Get the full taxonomy tree as a flat list */
export function getFullTaxonomy() {
  return query(`
    MATCH (n:SkillNode)
    OPTIONAL MATCH (n)-[:CHILD_OF]->(parent:SkillNode)
    RETURN n.id AS id, n.name AS name, n.domain AS domain,
           n.family AS family, n.taxonomy_path AS path,
           n.node_type AS type, n.is_leaf AS is_leaf,
           parent.id AS parent_id
    ORDER BY n.taxonomy_path
  `);
}

/** Get all skills that have evidence (mapped from actual Skill nodes) */
export function getDevelopedSkills() {
  return query(`
    MATCH (s:Skill)-[:MAPS_TO]->(sn:SkillNode)
    RETURN s.id AS id, s.name AS name, s.level AS level,
           s.domain AS domain, s.taxonomy_path AS path,
           s.evidence_count AS evidence, s.is_active AS active,
           s.growth_rate AS growth, sn.id AS taxonomy_node_id
    ORDER BY s.level DESC
  `);
}

/** Get skill with full evidence trail */
export function getSkillDetail(skillId: string) {
  return query(`
    MATCH (s:Skill {id: '${esc(skillId)}'})
    OPTIONAL MATCH (s)-[e:SKILL_EVIDENCE]->(c:Conversation)
    RETURN s.id AS id, s.name AS name, s.level AS level,
           s.domain AS domain, s.taxonomy_path AS path,
           s.first_evidence AS first, s.last_evidence AS last,
           collect({
             conversation_id: c.id,
             title: c.title,
             date: c.date,
             depth: e.depth_demonstrated
           }) AS evidence
  `);
}

/** Get all conversations, optionally filtered */
export function getConversations(opts?: {
  source?: "claude_web" | "claude_code";
  limit?: number;
  offset?: number;
}) {
  let where = "";
  if (opts?.source) where = `WHERE c.source = '${opts.source}'`;
  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;

  return query(`
    MATCH (c:Conversation)
    ${where}
    RETURN c.id AS id, c.title AS title, c.source AS source,
           c.date AS date, c.message_count AS messages,
           c.key_topics AS topics, c.emotional_tone AS tone,
           c.platform_project AS project
    ORDER BY c.date DESC
    SKIP ${offset} LIMIT ${limit}
  `);
}

/** Get all eras with their time spans */
export function getEras() {
  return query(`
    MATCH (e:Era)
    RETURN e.id AS id, e.label AS label, e.description AS description,
           e.start_date AS start, e.end_date AS end
    ORDER BY e.start_date
  `);
}

/** Get all beliefs */
export function getBeliefs() {
  return query(`
    MATCH (b:Belief)
    RETURN b.id AS id, b.statement AS statement, b.domain AS domain,
           b.confidence AS confidence, b.first_expressed AS first,
           b.last_expressed AS last, b.evolution AS evolution
    ORDER BY b.confidence DESC
  `);
}

/** Get all people mentioned */
export function getPeople() {
  return query(`
    MATCH (p:Person)
    WHERE p.id <> 'self'
    RETURN p.id AS id, p.name AS name, p.relationship AS relationship,
           p.context AS context, p.mention_count AS mentions
    ORDER BY p.mention_count DESC
  `);
}

/** Get all projects */
export function getProjects() {
  return query(`
    MATCH (p:Project)
    RETURN p.id AS id, p.name AS name, p.description AS description,
           p.status AS status, p.tech_stack AS tech,
           p.domain AS domain
    ORDER BY p.started DESC
  `);
}

// ============================================
// Write/Upsert queries
// ============================================

/** Upsert a conversation into the graph */
export function upsertConversation(conv: {
  id: string;
  title: string;
  source: string;
  platform_project: string;
  summary: string;
  date: string;
  message_count: number;
  key_topics: string[];
  emotional_tone: string;
  thinking_pattern: string;
}) {
  exec(`
    MERGE (c:Conversation {id: '${esc(conv.id)}'})
    SET c.title = '${esc(conv.title)}',
        c.source = '${esc(conv.source)}',
        c.platform_project = '${esc(conv.platform_project)}',
        c.summary = '${esc(conv.summary)}',
        c.date = '${esc(conv.date)}',
        c.message_count = ${conv.message_count},
        c.key_topics = ${JSON.stringify(conv.key_topics)},
        c.emotional_tone = '${esc(conv.emotional_tone)}',
        c.thinking_pattern = '${esc(conv.thinking_pattern)}'
  `);
}

/** Upsert a topic */
export function upsertTopic(topic: {
  id: string;
  name: string;
  domain: string;
  description: string;
  depth: number;
  first_discussed: string;
  last_discussed: string;
}) {
  exec(`
    MERGE (t:Topic {id: '${esc(topic.id)}'})
    SET t.name = '${esc(topic.name)}',
        t.domain = '${esc(topic.domain)}',
        t.description = '${esc(topic.description)}',
        t.depth = ${topic.depth},
        t.first_discussed = '${esc(topic.first_discussed)}',
        t.last_discussed = '${esc(topic.last_discussed)}',
        t.evidence_count = coalesce(t.evidence_count, 0) + 1
  `);
}

/** Upsert a skill with evidence */
export function upsertSkill(skill: {
  id: string;
  name: string;
  family: string;
  domain: string;
  level: number;
  taxonomy_path: string;
  first_evidence: string;
  last_evidence: string;
}) {
  exec(`
    MERGE (s:Skill {id: '${esc(skill.id)}'})
    SET s.name = '${esc(skill.name)}',
        s.family = '${esc(skill.family)}',
        s.domain = '${esc(skill.domain)}',
        s.level = ${skill.level},
        s.taxonomy_path = '${esc(skill.taxonomy_path)}',
        s.first_evidence = '${esc(skill.first_evidence)}',
        s.last_evidence = '${esc(skill.last_evidence)}',
        s.evidence_count = coalesce(s.evidence_count, 0) + 1,
        s.is_active = true
  `);
}

/** Upsert a project */
export function upsertProject(project: {
  id: string;
  name: string;
  description: string;
  status: string;
  tech_stack: string[];
  domain: string;
}) {
  exec(`
    MERGE (p:Project {id: '${esc(project.id)}'})
    SET p.name = '${esc(project.name)}',
        p.description = '${esc(project.description)}',
        p.status = '${esc(project.status)}',
        p.tech_stack = ${JSON.stringify(project.tech_stack)},
        p.domain = '${esc(project.domain)}'
  `);
}

/** Upsert a belief */
export function upsertBelief(belief: {
  id: string;
  statement: string;
  domain: string;
  confidence: number;
  first_expressed: string;
  last_expressed: string;
}) {
  exec(`
    MERGE (b:Belief {id: '${esc(belief.id)}'})
    SET b.statement = '${esc(belief.statement)}',
        b.domain = '${esc(belief.domain)}',
        b.confidence = ${belief.confidence},
        b.first_expressed = '${esc(belief.first_expressed)}',
        b.last_expressed = '${esc(belief.last_expressed)}',
        b.evidence_count = coalesce(b.evidence_count, 0) + 1
  `);
}

/** Upsert a person */
export function upsertPerson(person: {
  id: string;
  name: string;
  relationship: string;
  context: string;
  date: string;
}) {
  exec(`
    MERGE (p:Person {id: '${esc(person.id)}'})
    SET p.name = '${esc(person.name)}',
        p.relationship = '${esc(person.relationship)}',
        p.context = '${esc(person.context)}',
        p.last_mentioned = '${esc(person.date)}',
        p.mention_count = coalesce(p.mention_count, 0) + 1
    ON CREATE SET p.first_mentioned = '${esc(person.date)}'
  `);
}

/** Create a relationship between two nodes (generic) */
export function createEdge(
  fromTable: string,
  fromId: string,
  toTable: string,
  toId: string,
  relType: string,
  props?: Record<string, string | number | boolean>
) {
  let propsStr = "";
  if (props) {
    const parts = Object.entries(props).map(([k, v]) => {
      if (typeof v === "string") return `${k}: '${esc(v)}'`;
      return `${k}: ${v}`;
    });
    propsStr = ` {${parts.join(", ")}}`;
  }

  exec(`
    MATCH (a:${fromTable} {id: '${esc(fromId)}'}),
          (b:${toTable} {id: '${esc(toId)}'})
    MERGE (a)-[:${relType}${propsStr}]->(b)
  `);
}

// ============================================
// Aggregate queries (for dashboard / stats)
// ============================================

/** Get overall graph statistics */
export function getGraphStats() {
  const tables = [
    "Person", "Topic", "Skill", "Project", "Conversation",
    "Belief", "Question", "Era", "SkillNode",
  ];

  const counts: Record<string, number> = {};
  for (const table of tables) {
    try {
      const result = query(`MATCH (n:${table}) RETURN count(n) AS cnt`);
      counts[table] = (result[0] as any)?.cnt ?? 0;
    } catch {
      counts[table] = 0;
    }
  }

  return counts;
}
