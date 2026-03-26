/**
 * KuzuDB schema definitions for the Ontolo GG knowledge graph.
 *
 * Node tables: Person, Topic, Skill, Project, Conversation,
 *              Belief, Question, Era, SkillNode
 * Relationship tables: ~20 edge types connecting everything
 */

// ============================================
// Node table DDL
// ============================================

export const NODE_TABLES = [
  // The user and people mentioned in conversations
  `CREATE NODE TABLE IF NOT EXISTS Person (
    id STRING,
    name STRING,
    relationship STRING,
    context STRING,
    first_mentioned STRING,
    last_mentioned STRING,
    mention_count INT32 DEFAULT 0,
    PRIMARY KEY(id)
  )`,

  // Emergent topics from conversations
  `CREATE NODE TABLE IF NOT EXISTS Topic (
    id STRING,
    name STRING,
    domain STRING,
    description STRING,
    depth FLOAT DEFAULT 0.0,
    evidence_count INT32 DEFAULT 0,
    first_discussed STRING,
    last_discussed STRING,
    trajectory STRING DEFAULT 'new',
    PRIMARY KEY(id)
  )`,

  // Skills with evidence from conversations, mapped to taxonomy
  `CREATE NODE TABLE IF NOT EXISTS Skill (
    id STRING,
    name STRING,
    family STRING,
    domain STRING,
    level FLOAT DEFAULT 0.0,
    taxonomy_path STRING,
    evidence_count INT32 DEFAULT 0,
    is_active BOOLEAN DEFAULT false,
    growth_rate FLOAT DEFAULT 0.0,
    first_evidence STRING,
    last_evidence STRING,
    PRIMARY KEY(id)
  )`,

  // Projects mentioned or worked on
  `CREATE NODE TABLE IF NOT EXISTS Project (
    id STRING,
    name STRING,
    description STRING,
    status STRING,
    tech_stack STRING[],
    domain STRING,
    started STRING,
    ended STRING,
    PRIMARY KEY(id)
  )`,

  // Individual conversations (both web and code)
  `CREATE NODE TABLE IF NOT EXISTS Conversation (
    id STRING,
    title STRING,
    source STRING,
    platform_project STRING,
    summary STRING,
    date STRING,
    message_count INT32 DEFAULT 0,
    key_topics STRING[],
    emotional_tone STRING,
    thinking_pattern STRING,
    PRIMARY KEY(id)
  )`,

  // Beliefs, opinions, values expressed
  `CREATE NODE TABLE IF NOT EXISTS Belief (
    id STRING,
    statement STRING,
    domain STRING,
    confidence FLOAT DEFAULT 0.5,
    evidence_count INT32 DEFAULT 0,
    first_expressed STRING,
    last_expressed STRING,
    evolution STRING,
    PRIMARY KEY(id)
  )`,

  // Questions asked — curiosity map
  `CREATE NODE TABLE IF NOT EXISTS Question (
    id STRING,
    text STRING,
    domain STRING,
    curiosity_depth STRING,
    answered BOOLEAN DEFAULT false,
    date STRING,
    PRIMARY KEY(id)
  )`,

  // Time periods / life eras
  `CREATE NODE TABLE IF NOT EXISTS Era (
    id STRING,
    label STRING,
    description STRING,
    start_date STRING,
    end_date STRING,
    PRIMARY KEY(id)
  )`,

  // Full homo universalis taxonomy (all possible human skills)
  // This table contains EVERY skill, even ones with no evidence
  `CREATE NODE TABLE IF NOT EXISTS SkillNode (
    id STRING,
    name STRING,
    domain STRING,
    family STRING,
    taxonomy_path STRING,
    description STRING,
    node_type STRING,
    is_leaf BOOLEAN DEFAULT true,
    PRIMARY KEY(id)
  )`,
];

// ============================================
// Relationship table DDL
// ============================================

export const REL_TABLES = [
  // Person → Topic: what topics the person discussed
  `CREATE REL TABLE IF NOT EXISTS DISCUSSED (
    FROM Person TO Topic,
    depth FLOAT DEFAULT 0.0,
    frequency INT32 DEFAULT 1,
    first_date STRING,
    last_date STRING
  )`,

  // Person → Skill: skills demonstrated
  `CREATE REL TABLE IF NOT EXISTS DEMONSTRATED (
    FROM Person TO Skill,
    context STRING,
    confidence FLOAT DEFAULT 0.5,
    date STRING
  )`,

  // Person → Project: projects worked on
  `CREATE REL TABLE IF NOT EXISTS WORKED_ON (
    FROM Person TO Project,
    role STRING,
    period STRING,
    intensity STRING
  )`,

  // Person → Question: questions asked
  `CREATE REL TABLE IF NOT EXISTS ASKED (
    FROM Person TO Question,
    date STRING,
    context STRING
  )`,

  // Person → Belief: beliefs held
  `CREATE REL TABLE IF NOT EXISTS HOLDS (
    FROM Person TO Belief,
    strength FLOAT DEFAULT 0.5
  )`,

  // Topic → Conversation: where topics were discussed
  `CREATE REL TABLE IF NOT EXISTS MENTIONED_IN (
    FROM Topic TO Conversation,
    relevance FLOAT DEFAULT 0.5
  )`,

  // Topic → Topic: relationships between topics
  `CREATE REL TABLE IF NOT EXISTS RELATED_TO (
    FROM Topic TO Topic,
    strength FLOAT DEFAULT 0.5,
    relationship_type STRING
  )`,

  // Topic → Topic: how interests evolved
  `CREATE REL TABLE IF NOT EXISTS EVOLVED_INTO (
    FROM Topic TO Topic,
    date STRING,
    context STRING
  )`,

  // Topic → SkillNode: mapping emergent topics to taxonomy
  `CREATE REL TABLE IF NOT EXISTS BELONGS_TO_DOMAIN (
    FROM Topic TO SkillNode,
    mapping_confidence FLOAT DEFAULT 0.5
  )`,

  // Skill → Conversation: evidence trail
  `CREATE REL TABLE IF NOT EXISTS SKILL_EVIDENCE (
    FROM Skill TO Conversation,
    depth_demonstrated FLOAT DEFAULT 0.0
  )`,

  // Skill → Skill: dependencies and synergies
  `CREATE REL TABLE IF NOT EXISTS DEPENDS_ON (
    FROM Skill TO Skill,
    dependency_type STRING
  )`,

  // Skill → SkillNode: mapping actual skills to taxonomy
  `CREATE REL TABLE IF NOT EXISTS MAPS_TO (
    FROM Skill TO SkillNode,
    coverage FLOAT DEFAULT 1.0
  )`,

  // SkillNode → SkillNode: taxonomy hierarchy
  `CREATE REL TABLE IF NOT EXISTS CHILD_OF (
    FROM SkillNode TO SkillNode
  )`,

  // Project → Skill: skills used in projects
  `CREATE REL TABLE IF NOT EXISTS USES_SKILL (
    FROM Project TO Skill,
    how STRING
  )`,

  // Project → Conversation: project-related conversations
  `CREATE REL TABLE IF NOT EXISTS PROJECT_CONVERSATION (
    FROM Project TO Conversation,
    relevance FLOAT DEFAULT 0.5
  )`,

  // Topic → Era: when topics were active
  `CREATE REL TABLE IF NOT EXISTS ACTIVE_DURING (
    FROM Topic TO Era,
    intensity FLOAT DEFAULT 0.5
  )`,

  // Skill → Era: skill levels during eras
  `CREATE REL TABLE IF NOT EXISTS SKILL_DURING (
    FROM Skill TO Era,
    level_at_start FLOAT DEFAULT 0.0,
    level_at_end FLOAT DEFAULT 0.0
  )`,

  // Era → Conversation: conversations during an era
  `CREATE REL TABLE IF NOT EXISTS ERA_CONVERSATION (
    FROM Era TO Conversation
  )`,

  // Belief → Conversation: evidence for beliefs
  `CREATE REL TABLE IF NOT EXISTS BELIEF_EVIDENCE (
    FROM Belief TO Conversation
  )`,

  // Belief → Belief: contradictions
  `CREATE REL TABLE IF NOT EXISTS CONTRADICTS (
    FROM Belief TO Belief,
    date_noticed STRING,
    resolution STRING
  )`,

  // Project → Era: projects during eras
  `CREATE REL TABLE IF NOT EXISTS PROJECT_DURING (
    FROM Project TO Era
  )`,
];

// ============================================
// Schema initialization
// ============================================

/**
 * Create all tables in the database.
 * Safe to call multiple times (IF NOT EXISTS).
 */
export function initSchema(
  execFn: (cypher: string) => void
): void {
  console.log("[schema] Creating node tables...");
  for (const ddl of NODE_TABLES) {
    try {
      execFn(ddl);
    } catch (err) {
      // Ignore "already exists" errors
      const msg = (err as Error).message ?? "";
      if (!msg.includes("already exists")) {
        console.error("[schema] Error creating table:", msg);
      }
    }
  }

  console.log("[schema] Creating relationship tables...");
  for (const ddl of REL_TABLES) {
    try {
      execFn(ddl);
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (!msg.includes("already exists")) {
        console.error("[schema] Error creating rel table:", msg);
      }
    }
  }

  console.log("[schema] Schema initialized.");
}
