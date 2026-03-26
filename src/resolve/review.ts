/**
 * Interactive Human-in-the-Loop Review CLI for Entity Resolution
 *
 * Scans extraction files for generic/ambiguous entity references
 * (e.g. "my girlfriend", "my co-founder") and presents an interactive
 * prompt to resolve them to canonical names.
 *
 * Decisions are saved to data/resolutions/review-decisions.json and
 * are used by the resolver as per-conversation overrides.
 *
 * Usage:
 *   bun src/resolve/review.ts
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { loadResolutions } from "./resolver.ts";
import type { CachedExtraction } from "../extract/schema.ts";
import type { ResolutionFile } from "./types.ts";

const ROOT = import.meta.dir.replace("/src/resolve", "");
const EXTRACTIONS_DIR = join(ROOT, "data", "extractions");
const NORMALIZED_DIR = join(ROOT, "data", "normalized");
const RESOLUTIONS_DIR = join(ROOT, "data", "resolutions");
const DECISIONS_PATH = join(RESOLUTIONS_DIR, "review-decisions.json");

// ============================================
// ANSI colors
// ============================================

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
  white: "\x1b[37m",
  bgDim: "\x1b[48;5;236m",
};

// ============================================
// Types
// ============================================

interface ReviewDecision {
  entity_type: "people" | "projects";
  raw_name: string;
  conversation_id: string;
  resolved_to: string;
  reviewed_at: string;
}

interface ReviewDecisionsFile {
  decisions: ReviewDecision[];
}

interface GenericReference {
  entity_type: "people" | "projects";
  raw_name: string;
  conversation_id: string;
  conversation_title: string;
  conversation_date: string;
  relationship?: string;
  context?: string;
}

interface GroupedGeneric {
  entity_type: "people" | "projects";
  raw_name: string;
  mentions: GenericReference[];
}

// ============================================
// Generic name detection patterns
// ============================================

const GENERIC_PEOPLE_PATTERNS = [
  /^my\s/i,
  /^his\s/i,
  /^her\s/i,
  /^the\s/i,
  /^a\s/i,
  /^an\s/i,
  /girlfriend/i,
  /boyfriend/i,
  /partner/i,
  /friend(?!\s+\w+\s+\w+)/i, // "friend" but not "friend John Doe"
  /co-?founder/i,
  /cofounder/i,
  /mother/i,
  /father/i,
  /parent/i,
  /brother/i,
  /sister/i,
  /uncle/i,
  /aunt/i,
  /cousin/i,
  /grandm/i,
  /grandf/i,
  /grandp/i,
  /professor/i,
  /teacher/i,
  /mentor/i,
  /colleague/i,
  /boss/i,
  /manager/i,
  /advisor/i,
  /investor/i,
  /vriendin/i,
  /vriend(?!in)/i,
  /moeder/i,
  /vader/i,
  /mama/i,
  /papa/i,
  /^unnamed/i,
  /^unknown/i,
  /startup\s/i,
  /someone/i,
  /^client/i,
  /^accountant/i,
];

const GENERIC_PROJECT_PATTERNS = [
  /^unnamed/i,
  /^untitled/i,
  /^my\s/i,
  /^the\s(app|platform|project|tool|system|site|website|product|startup|service|thing)/i,
  /^a\s(new\s)?(app|platform|project|tool|system)/i,
];

function isGenericName(name: string, entityType: "people" | "projects"): boolean {
  const patterns = entityType === "people" ? GENERIC_PEOPLE_PATTERNS : GENERIC_PROJECT_PATTERNS;
  return patterns.some((p) => p.test(name));
}

// ============================================
// Load / save decisions
// ============================================

async function loadDecisions(): Promise<ReviewDecisionsFile> {
  const file = Bun.file(DECISIONS_PATH);
  if (await file.exists()) {
    return await file.json();
  }
  return { decisions: [] };
}

async function saveDecisions(data: ReviewDecisionsFile): Promise<void> {
  await Bun.write(DECISIONS_PATH, JSON.stringify(data, null, 2) + "\n");
}

/** Build a set of already-reviewed (entity_type, raw_name, conversation_id) combos. */
function buildReviewedSet(decisions: ReviewDecision[]): Set<string> {
  const set = new Set<string>();
  for (const d of decisions) {
    set.add(`${d.entity_type}|${d.raw_name.toLowerCase()}|${d.conversation_id}`);
  }
  return set;
}

// ============================================
// Load conversation metadata
// ============================================

interface ConversationMeta {
  id: string;
  title: string;
  created_at: string;
}

async function loadConversationMeta(convId: string): Promise<ConversationMeta | null> {
  for (const source of ["web", "code"]) {
    const path = join(NORMALIZED_DIR, source, `${convId}.json`);
    const file = Bun.file(path);
    if (await file.exists()) {
      const data = await file.json();
      return {
        id: data.id,
        title: data.title ?? "(untitled)",
        created_at: data.created_at ?? "",
      };
    }
  }
  return null;
}

// ============================================
// Scan extractions for generic references
// ============================================

async function scanForGenerics(): Promise<GenericReference[]> {
  const refs: GenericReference[] = [];
  const metaCache = new Map<string, ConversationMeta | null>();

  for (const source of ["web", "code"] as const) {
    const dir = join(EXTRACTIONS_DIR, source);
    if (!existsSync(dir)) continue;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.includes(".error.") || !entry.endsWith(".json")) continue;

      try {
        const file = Bun.file(join(dir, entry));
        const cached: CachedExtraction = await file.json();
        const ext = cached.extraction;
        const convId = cached.metadata.conversation_id;

        // Cache conversation metadata
        if (!metaCache.has(convId)) {
          metaCache.set(convId, await loadConversationMeta(convId));
        }
        const meta = metaCache.get(convId);
        const title = meta?.title ?? "(unknown)";
        const date = meta?.created_at?.split("T")[0] ?? "";

        // Check people
        for (const person of ext.people) {
          if (!person.name) continue;
          if (isGenericName(person.name, "people")) {
            refs.push({
              entity_type: "people",
              raw_name: person.name,
              conversation_id: convId,
              conversation_title: title,
              conversation_date: date,
              relationship: person.relationship,
              context: person.context,
            });
          }
        }

        // Check projects
        for (const project of ext.projects) {
          if (!project.name) continue;
          if (isGenericName(project.name, "projects")) {
            refs.push({
              entity_type: "projects",
              raw_name: project.name,
              conversation_id: convId,
              conversation_title: title,
              conversation_date: date,
              context: project.description,
            });
          }
        }
      } catch {
        // Skip malformed files
      }
    }
  }

  return refs;
}

// ============================================
// Load canonical candidates from resolution files
// ============================================

async function loadCandidates(entityType: "people" | "projects"): Promise<string[]> {
  const path = join(RESOLUTIONS_DIR, `${entityType}.json`);
  const file = Bun.file(path);
  if (!(await file.exists())) return [];

  const data: ResolutionFile = await file.json();
  return data.resolutions.map((r) => r.canonical_name);
}

/** Rank candidates by relevance to a generic reference. */
function rankCandidates(
  candidates: string[],
  ref: GenericReference
): string[] {
  const name = ref.raw_name.toLowerCase();
  const relationship = (ref.relationship ?? "").toLowerCase();
  const context = (ref.context ?? "").toLowerCase();
  const combined = `${name} ${relationship} ${context}`;

  // Score each candidate
  const scored = candidates.map((c) => {
    let score = 0;
    const cLower = c.toLowerCase();

    // Direct relationship matching
    if (combined.includes("girlfriend") || combined.includes("vriendin") || combined.includes("copine")) {
      if (cLower.includes("sofia") || cLower.includes("hana")) score += 10;
    }
    if (combined.includes("co-founder") || combined.includes("cofounder")) {
      if (cLower.includes("andres") || cLower.includes("ben") || cLower.includes("sophie")) score += 10;
    }
    if (combined.includes("mother") || combined.includes("moeder") || combined.includes("mama")) {
      if (cLower.includes("mother")) score += 10;
    }
    if (combined.includes("father") || combined.includes("vader") || combined.includes("papa")) {
      if (cLower.includes("father")) score += 10;
    }
    if (combined.includes("sister") || combined.includes("soeur")) {
      if (cLower.includes("sister")) score += 10;
    }
    if (combined.includes("parent")) {
      if (cLower.includes("parent")) score += 10;
    }
    if (combined.includes("accountant") || combined.includes("boekhouder")) {
      if (cLower.includes("accountant") || cLower.includes("robbe") || cLower.includes("thomas")) score += 10;
    }
    if (combined.includes("friend") || combined.includes("vriend")) {
      if (cLower.includes("ben") || cLower.includes("felix") || cLower.includes("vic")) score += 5;
    }
    if (combined.includes("investor")) {
      if (cLower.includes("investor")) score += 5;
    }

    // Check if any word from the context appears in the candidate name
    const words = combined.split(/\s+/).filter((w) => w.length > 3);
    for (const word of words) {
      if (cLower.includes(word)) score += 2;
    }

    return { name: c, score };
  });

  // Sort by score descending, then alphabetically
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return scored.map((s) => s.name);
}

// ============================================
// Group and sort references
// ============================================

function groupReferences(
  refs: GenericReference[],
  reviewedSet: Set<string>
): GroupedGeneric[] {
  const groups = new Map<string, GroupedGeneric>();

  for (const ref of refs) {
    const key = `${ref.entity_type}|${ref.raw_name.toLowerCase()}`;
    const reviewKey = `${ref.entity_type}|${ref.raw_name.toLowerCase()}|${ref.conversation_id}`;

    // Skip already reviewed
    if (reviewedSet.has(reviewKey)) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        entity_type: ref.entity_type,
        raw_name: ref.raw_name,
        mentions: [],
      });
    }
    groups.get(key)!.mentions.push(ref);
  }

  // Sort by mention count (most frequent first)
  const result = Array.from(groups.values());
  result.sort((a, b) => b.mentions.length - a.mentions.length);

  return result;
}

// ============================================
// Interactive prompt
// ============================================

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function runReview(): Promise<void> {
  console.log(`\n${C.bold}${C.cyan}=== Entity Resolution Review CLI ===${C.reset}\n`);
  console.log(`${C.dim}Scanning extraction files for generic references...${C.reset}`);

  // Load resolutions (needed for the resolver)
  await loadResolutions();

  // Scan all extractions
  const allRefs = await scanForGenerics();
  console.log(`${C.dim}Found ${allRefs.length} total generic references across all extractions.${C.reset}`);

  // Load existing decisions
  const decisionsFile = await loadDecisions();
  const reviewedSet = buildReviewedSet(decisionsFile.decisions);
  console.log(`${C.dim}Already reviewed: ${decisionsFile.decisions.length} decisions on file.${C.reset}`);

  // Load candidates
  const peopleCandidates = await loadCandidates("people");
  const projectsCandidates = await loadCandidates("projects");

  // Group and filter
  const peopleGroups = groupReferences(
    allRefs.filter((r) => r.entity_type === "people"),
    reviewedSet
  );
  const projectGroups = groupReferences(
    allRefs.filter((r) => r.entity_type === "projects"),
    reviewedSet
  );

  const allGroups = [...peopleGroups, ...projectGroups];
  const totalItems = allGroups.reduce((sum, g) => sum + g.mentions.length, 0);

  if (totalItems === 0) {
    console.log(`\n${C.green}Nothing to review! All generic references have been resolved.${C.reset}\n`);
    return;
  }

  console.log(`\n${C.yellow}${totalItems} unreviewed references in ${allGroups.length} groups.${C.reset}`);
  console.log(`${C.dim}Groups are sorted by frequency (most common first).${C.reset}`);
  console.log(`${C.dim}Within each group, you'll review per-conversation occurrences.${C.reset}\n`);

  // Setup readline
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  let reviewed = 0;
  let quit = false;

  // Process people first, then projects
  for (const entityLabel of ["People", "Projects"] as const) {
    const entityType = entityLabel.toLowerCase() as "people" | "projects";
    const groups = entityType === "people" ? peopleGroups : projectGroups;
    const candidates = entityType === "people" ? peopleCandidates : projectsCandidates;

    if (groups.length === 0) continue;

    console.log(`\n${C.bold}${C.magenta}--- ${entityLabel} ---${C.reset}\n`);

    for (const group of groups) {
      if (quit) break;

      // Show group header
      console.log(
        `${C.bold}${C.yellow}"${group.raw_name}"${C.reset} ${C.dim}(${group.mentions.length} occurrence${group.mentions.length > 1 ? "s" : ""})${C.reset}`
      );

      // Rank candidates for this group
      const ranked = rankCandidates(candidates, group.mentions[0]);
      const topCandidates = ranked.slice(0, 15);

      // Show candidates
      console.log(`${C.dim}  Candidates:${C.reset}`);
      topCandidates.forEach((c, i) => {
        console.log(`    ${C.cyan}${i + 1}.${C.reset} ${c}`);
      });
      console.log("");

      for (const mention of group.mentions) {
        if (quit) break;

        reviewed++;
        const counter = `${C.dim}[${reviewed}/${totalItems}]${C.reset}`;
        const date = mention.conversation_date || "(no date)";

        console.log(
          `  ${counter} ${C.blue}${mention.conversation_title}${C.reset} ${C.dim}(${date})${C.reset}`
        );
        if (mention.relationship) {
          console.log(`    ${C.dim}Relationship:${C.reset} ${mention.relationship}`);
        }
        if (mention.context) {
          console.log(`    ${C.dim}Context:${C.reset} ${mention.context.slice(0, 120)}`);
        }

        const answer = await ask(
          rl,
          `    ${C.green}>${C.reset} ${C.dim}number / custom name / Enter=skip / q=quit:${C.reset} `
        );

        const trimmed = answer.trim();

        if (trimmed.toLowerCase() === "q") {
          quit = true;
          console.log(`\n${C.yellow}Saving and quitting...${C.reset}`);
          break;
        }

        if (trimmed === "") {
          // Skip
          console.log(`    ${C.dim}Skipped.${C.reset}`);
          continue;
        }

        let resolvedTo: string;

        // Check if it's a number referencing a candidate
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= topCandidates.length) {
          resolvedTo = topCandidates[num - 1];
        } else {
          // Custom name
          resolvedTo = trimmed;
        }

        // Save decision
        const decision: ReviewDecision = {
          entity_type: entityType,
          raw_name: mention.raw_name,
          conversation_id: mention.conversation_id,
          resolved_to: resolvedTo,
          reviewed_at: new Date().toISOString(),
        };
        decisionsFile.decisions.push(decision);
        await saveDecisions(decisionsFile);

        console.log(`    ${C.green}Resolved to: ${resolvedTo}${C.reset}`);
      }

      console.log(""); // blank line between groups
    }
  }

  rl.close();

  console.log(`\n${C.bold}${C.green}Done!${C.reset}`);
  console.log(
    `${C.dim}Total decisions on file: ${decisionsFile.decisions.length}${C.reset}`
  );
  console.log(`${C.dim}Saved to: ${DECISIONS_PATH}${C.reset}\n`);
}

// ============================================
// Main
// ============================================

runReview().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
