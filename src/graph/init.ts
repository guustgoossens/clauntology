/**
 * Initialize the KuzuDB graph database.
 * Creates the schema and populates the full homo universalis taxonomy.
 *
 * Usage:
 *   bun run init-graph          # Initialize (safe to re-run)
 *   bun run init-graph --reset  # Drop and recreate everything
 */

import { getConnection, exec, execMany, query, closeDb } from "./db.ts";
import { initSchema } from "./schema.ts";
import { flattenTaxonomy, taxonomyStats, type FlatSkillNode } from "./taxonomy.ts";

/**
 * Escape a string for use in Cypher.
 */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Insert all SkillNode entries into the graph.
 */
function insertTaxonomyNodes(nodes: FlatSkillNode[]): void {
  console.log(`[init] Inserting ${nodes.length} taxonomy nodes...`);

  for (const node of nodes) {
    const cypher = `
      MERGE (n:SkillNode {id: '${esc(node.id)}'})
      SET n.name = '${esc(node.name)}',
          n.domain = '${esc(node.domain)}',
          n.family = '${esc(node.family)}',
          n.taxonomy_path = '${esc(node.taxonomy_path)}',
          n.description = '${esc(node.description)}',
          n.node_type = '${esc(node.node_type)}',
          n.is_leaf = ${node.is_leaf}
    `;

    try {
      exec(cypher);
    } catch (err) {
      console.error(`[init] Error inserting ${node.id}:`, (err as Error).message);
    }
  }
}

/**
 * Create CHILD_OF relationships in the taxonomy.
 */
function insertTaxonomyEdges(nodes: FlatSkillNode[]): void {
  const withParent = nodes.filter((n) => n.parent_id);
  console.log(`[init] Creating ${withParent.length} CHILD_OF edges...`);

  for (const node of withParent) {
    const cypher = `
      MATCH (child:SkillNode {id: '${esc(node.id)}'}),
            (parent:SkillNode {id: '${esc(node.parent_id!)}'})
      MERGE (child)-[:CHILD_OF]->(parent)
    `;

    try {
      exec(cypher);
    } catch (err) {
      console.error(
        `[init] Error creating edge ${node.id} -> ${node.parent_id}:`,
        (err as Error).message
      );
    }
  }
}

/**
 * Insert the "self" Person node for Guust.
 */
function insertSelfNode(): void {
  console.log("[init] Creating self node...");
  exec(`
    MERGE (p:Person {id: 'self'})
    SET p.name = 'Guust Goossens',
        p.relationship = 'self',
        p.context = 'The person whose conversations form this knowledge graph',
        p.first_mentioned = '2024-03-22',
        p.mention_count = 0
  `);
}

/**
 * Insert known eras.
 */
function insertKnownEras(): void {
  console.log("[init] Creating known eras...");

  const eras = [
    { id: "era_ku_leuven", label: "KU Leuven BSc", desc: "Bachelor in Business & Information Systems Engineering", start: "2022-09-01", end: "2025-06-30" },
    { id: "era_essec", label: "ESSEC Exchange", desc: "Exchange semester at ESSEC Paris", start: "2024-09-01", end: "2025-01-31" },
    { id: "era_plenti", label: "Plenti", desc: "Co-founded Plenti, gig economy platform", start: "2024-02-01", end: "2025-04-30" },
    { id: "era_x_s1", label: "X S1", desc: "MSc X-HEC Data Science & AI for Business, Semester 1 at École Polytechnique", start: "2025-09-01", end: "2026-01-31" },
    { id: "era_x_s2", label: "X S2", desc: "MSc X-HEC Data Science & AI for Business, Semester 2 at École Polytechnique (current)", start: "2026-02-01", end: "2026-06-30" },
    { id: "era_hec_s1", label: "HEC S1", desc: "MSc X-HEC Data Science & AI for Business, Semester 3 at HEC Paris", start: "2026-09-01", end: "2027-01-31" },
    { id: "era_hec_s2", label: "HEC S2", desc: "MSc X-HEC Data Science & AI for Business, Semester 4 at HEC Paris", start: "2027-02-01", end: "2027-06-30" },
    { id: "era_accaio", label: "Accaio", desc: "Building Accaio, AI assistant for accounting firms", start: "2025-06-01", end: "" },
    { id: "era_consulting", label: "Consulting Agency", desc: "Running a consulting/freelance agency", start: "2025-01-01", end: "" },
    { id: "era_hackathons", label: "Hackathon Era", desc: "IC Hack 26, HackEurope 2026, HackStral", start: "2026-01-01", end: "2026-03-31" },
  ];

  for (const era of eras) {
    exec(`
      MERGE (e:Era {id: '${era.id}'})
      SET e.label = '${esc(era.label)}',
          e.description = '${esc(era.desc)}',
          e.start_date = '${era.start}',
          e.end_date = '${era.end}'
    `);
  }
}

/**
 * Main initialization.
 */
async function main() {
  const reset = process.argv.includes("--reset");

  console.log("\n=== Ontolo GG Graph Initialization ===\n");

  // Initialize connection (creates DB directory if needed)
  getConnection();

  if (reset) {
    console.log("[init] WARNING: --reset flag detected");
    console.log("[init] Dropping all data...");
    // Drop all relationships first, then nodes
    try {
      const rels = query("CALL show_tables() RETURN * WHERE type = 'REL'") as any[];
      for (const rel of rels) {
        try { exec(`DROP TABLE ${rel.name}`); } catch {}
      }
      const nodes = query("CALL show_tables() RETURN * WHERE type = 'NODE'") as any[];
      for (const node of nodes) {
        try { exec(`DROP TABLE ${node.name}`); } catch {}
      }
    } catch {
      console.log("[init] No existing tables to drop");
    }
  }

  // Create schema
  initSchema(exec);

  // Print taxonomy stats
  const stats = taxonomyStats();
  console.log(`[init] Taxonomy: ${stats.domains} domains, ${stats.families} families, ${stats.skills} skills (${stats.total} total nodes)`);

  // Flatten and insert taxonomy
  const flat = flattenTaxonomy();
  insertTaxonomyNodes(flat);
  insertTaxonomyEdges(flat);

  // Insert self node
  insertSelfNode();

  // Insert known eras
  insertKnownEras();

  // Verify
  const nodeCount = query("MATCH (n:SkillNode) RETURN count(n) AS cnt");
  const edgeCount = query("MATCH ()-[r:CHILD_OF]->() RETURN count(r) AS cnt");
  const personCount = query("MATCH (p:Person) RETURN count(p) AS cnt");
  const eraCount = query("MATCH (e:Era) RETURN count(e) AS cnt");

  console.log("\n=== Verification ===");
  console.log(`  SkillNode nodes: ${(nodeCount[0] as any).cnt}`);
  console.log(`  CHILD_OF edges:  ${(edgeCount[0] as any).cnt}`);
  console.log(`  Person nodes:    ${(personCount[0] as any).cnt}`);
  console.log(`  Era nodes:       ${(eraCount[0] as any).cnt}`);

  // Sample queries to verify structure
  console.log("\n=== Sample Queries ===");

  const domains = query(`
    MATCH (d:SkillNode)
    WHERE d.node_type = 'domain'
    RETURN d.name AS domain, d.id AS id
    ORDER BY d.name
  `);
  console.log("\nDomains:");
  for (const d of domains) {
    const families = query(`
      MATCH (f:SkillNode)-[:CHILD_OF]->(d:SkillNode {id: '${(d as any).id}'})
      RETURN count(f) AS cnt
    `);
    const skills = query(`
      MATCH (s:SkillNode)-[:CHILD_OF]->(f:SkillNode)-[:CHILD_OF]->(d:SkillNode {id: '${(d as any).id}'})
      RETURN count(s) AS cnt
    `);
    console.log(`  ${(d as any).domain}: ${(families[0] as any).cnt} families, ${(skills[0] as any).cnt} skills`);
  }

  console.log("\n=== Graph Initialization Complete ===\n");
}

main().catch(console.error);
