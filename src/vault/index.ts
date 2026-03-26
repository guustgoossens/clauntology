/**
 * Vault Generator CLI.
 *
 * Usage:
 *   bun run generate-vault              # Generate full vault
 *   bun run generate-vault --verbose    # Log each page type count
 */

import { generateVault } from "./generator.ts";
import { closeDb } from "../graph/db.ts";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");

console.log("\n=== Ontolo GG — Vault Generator ===\n");

const start = Date.now();

try {
  await generateVault({ verbose });
} finally {
  closeDb();
}

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\n  Completed in ${elapsed}s\n`);
