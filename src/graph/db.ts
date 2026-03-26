/**
 * KuzuDB connection helper.
 * Provides a singleton database connection for the ontology graph.
 */

import kuzu from "kuzu";
import { join } from "node:path";

const ROOT = import.meta.dir.replace("/src/graph", "");
const DEFAULT_DB_PATH = join(ROOT, "db", "ontolo.kuzu");

let _db: InstanceType<typeof kuzu.Database> | null = null;
let _conn: InstanceType<typeof kuzu.Connection> | null = null;

/**
 * Get or create the database connection.
 */
export function getConnection(
  dbPath: string = DEFAULT_DB_PATH
): InstanceType<typeof kuzu.Connection> {
  if (_conn) return _conn;

  _db = new kuzu.Database(dbPath);
  _conn = new kuzu.Connection(_db);
  return _conn;
}

/**
 * Execute a Cypher query synchronously and return all rows.
 */
export function query(
  cypher: string,
  params?: Record<string, unknown>
): Record<string, unknown>[] {
  const conn = getConnection();
  const result = conn.querySync(cypher);
  return result.getAllSync();
}

/**
 * Execute a Cypher query synchronously, returning nothing.
 * Used for DDL and insert statements.
 */
export function exec(cypher: string): void {
  const conn = getConnection();
  conn.querySync(cypher);
}

/**
 * Execute multiple Cypher statements in sequence.
 */
export function execMany(statements: string[]): void {
  for (const stmt of statements) {
    const trimmed = stmt.trim();
    if (trimmed) exec(trimmed);
  }
}

/**
 * Close the database connection.
 */
export function closeDb(): void {
  _conn = null;
  if (_db) {
    _db.close();
    _db = null;
  }
}

export { DEFAULT_DB_PATH };
