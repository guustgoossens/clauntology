/**
 * Vault Generator — orchestrates the full pipeline.
 * Query → Index → Render → Backlinks → Write
 */

import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { getConnection } from "../graph/db.ts";
import { queryAllData } from "./queries.ts";
import { WikilinkRegistry, skillPath, topicPath, projectPath, personPath, beliefPath, eraPath, conversationPath, patternPath, domainPath } from "./wikilinks.ts";
import { injectBacklinks } from "./backlinks.ts";
import type { VaultPage, VaultData } from "./types.ts";

// Templates
import { renderSkill } from "./templates/skill.ts";
import { renderTopic } from "./templates/topic.ts";
import { renderProject } from "./templates/project.ts";
import { renderPerson } from "./templates/person.ts";
import { renderBelief } from "./templates/belief.ts";
import { renderEra } from "./templates/era.ts";
import { renderConversation } from "./templates/conversation.ts";
import { renderPattern } from "./templates/pattern.ts";
import { renderDomain } from "./templates/domain.ts";
import { renderMetaPages } from "./templates/meta.ts";
import { renderDashboard } from "./templates/dashboard.ts";

const ROOT = import.meta.dir.replace("/src/vault", "");
const NORMALIZED_DIR = join(ROOT, "data", "normalized");

// ============================================
// Phase 1: Data enrichment (load transcripts)
// ============================================

async function enrichConversationsWithTranscripts(data: VaultData): Promise<void> {
  console.log("[vault] Loading conversation transcripts...");
  let loaded = 0;
  let missing = 0;

  for (const conv of data.conversations) {
    // Determine source directory
    const sourceDir = conv.source === "claude_code" ? "code" : "web";
    const normalizedPath = join(NORMALIZED_DIR, sourceDir, `${conv.id}.json`);

    if (!existsSync(normalizedPath)) {
      missing++;
      continue;
    }

    try {
      const file = Bun.file(normalizedPath);
      const normalized = await file.json();

      // Extract messages
      conv.messages = (normalized.messages ?? []).map((m: any) => ({
        role: m.role ?? "unknown",
        text: m.text ?? "",
        timestamp: m.timestamp ?? undefined,
      }));
      conv.messageCount = conv.messages.length;

      // Extract linked entity names from extraction if available
      const extractionDir = join(ROOT, "data", "extractions", sourceDir, `${conv.id}.json`);
      if (existsSync(extractionDir)) {
        const extraction = await Bun.file(extractionDir).json();
        const ext = extraction.extraction;
        if (ext) {
          conv.linkedTopics = (ext.topics ?? []).map((t: any) => t.name).filter(Boolean);
          conv.linkedSkills = (ext.skills ?? []).map((s: any) => s.name).filter(Boolean);
          conv.linkedProjects = (ext.projects ?? []).map((p: any) => p.name).filter(Boolean);
          conv.linkedPeople = (ext.people ?? []).map((p: any) => p.name).filter(Boolean);
        }
      }

      loaded++;
    } catch {
      missing++;
    }
  }

  console.log(`  Loaded ${loaded} transcripts (${missing} missing)`);
}

// ============================================
// Phase 2: Build wikilink registry
// ============================================

function buildRegistry(data: VaultData): WikilinkRegistry {
  console.log("[vault] Building wikilink registry...");
  const reg = new WikilinkRegistry();

  // Register in priority order (skills before topics for disambiguation)
  for (const s of data.skills) {
    reg.register(s.name, skillPath(s.domain, s.family, s.name));
  }
  for (const t of data.topics) {
    reg.register(t.name, topicPath(t.name));
  }
  for (const p of data.projects) {
    reg.register(p.name, projectPath(p.name));
  }
  for (const p of data.people) {
    reg.register(p.name, personPath(p.name));
  }
  for (const b of data.beliefs) {
    reg.register(b.statement.slice(0, 80), beliefPath(b.id, b.statement));
  }
  for (const e of data.eras) {
    reg.register(e.label, eraPath(e.label));
  }
  for (const c of data.conversations) {
    reg.register(c.title, conversationPath(c.source, c.date, c.platformProject, c.title, c.id));
  }
  for (const p of data.patterns) {
    reg.register(p.pattern, patternPath(p.pattern));
  }
  for (const d of data.domains) {
    reg.register(d.name, domainPath(d.name));
  }

  // Meta pages
  reg.register("Growth Trajectory", "meta/growth-trajectory.md");
  reg.register("Curiosity Map", "meta/curiosity-map.md");
  reg.register("Personality Profile", "meta/personality-profile.md");

  console.log(`  Registered ${reg.size} entries`);
  return reg;
}

// ============================================
// Phase 3: Render all pages
// ============================================

function renderAllPages(data: VaultData, reg: WikilinkRegistry, verbose: boolean): VaultPage[] {
  console.log("[vault] Rendering pages...");
  const pages: VaultPage[] = [];

  // Dashboard
  pages.push(renderDashboard(data, reg));

  // Domains
  for (const d of data.domains) {
    pages.push(renderDomain(d, reg));
  }
  if (verbose) console.log(`  Domains: ${data.domains.length}`);

  // Skills
  for (const s of data.skills) {
    if (!s.name) continue;
    pages.push(renderSkill(s, reg));
  }
  if (verbose) console.log(`  Skills: ${data.skills.length}`);

  // Topics
  for (const t of data.topics) {
    if (!t.name) continue;
    pages.push(renderTopic(t, reg));
  }
  if (verbose) console.log(`  Topics: ${data.topics.length}`);

  // Projects
  for (const p of data.projects) {
    if (!p.name) continue;
    pages.push(renderProject(p, reg));
  }
  if (verbose) console.log(`  Projects: ${data.projects.length}`);

  // People
  for (const p of data.people) {
    if (!p.name) continue;
    pages.push(renderPerson(p, reg));
  }
  if (verbose) console.log(`  People: ${data.people.length}`);

  // Beliefs
  for (const b of data.beliefs) {
    if (!b.statement) continue;
    pages.push(renderBelief(b, reg));
  }
  if (verbose) console.log(`  Beliefs: ${data.beliefs.length}`);

  // Eras
  for (const e of data.eras) {
    pages.push(renderEra(e, reg));
  }
  if (verbose) console.log(`  Eras: ${data.eras.length}`);

  // Conversations
  for (const c of data.conversations) {
    pages.push(renderConversation(c, reg));
  }
  if (verbose) console.log(`  Conversations: ${data.conversations.length}`);

  // Patterns
  for (const p of data.patterns) {
    if (!p.pattern) continue;
    pages.push(renderPattern(p, reg));
  }
  if (verbose) console.log(`  Patterns: ${data.patterns.length}`);

  // Meta pages
  pages.push(...renderMetaPages(data, reg));

  console.log(`  Total pages: ${pages.length}`);
  return pages;
}

// ============================================
// Phase 5: Write to disk
// ============================================

async function writePages(pages: VaultPage[], outputDir: string): Promise<void> {
  console.log(`[vault] Writing ${pages.length} pages to ${outputDir}...`);

  // Track created directories to avoid redundant mkdirSync calls
  const createdDirs = new Set<string>();

  for (const page of pages) {
    const fullPath = join(outputDir, page.path);
    const dir = dirname(fullPath);

    if (!createdDirs.has(dir)) {
      mkdirSync(dir, { recursive: true });
      createdDirs.add(dir);
    }

    await Bun.write(fullPath, page.content);
  }
}

// ============================================
// Main
// ============================================

export async function generateVault(opts?: {
  outputDir?: string;
  verbose?: boolean;
}): Promise<void> {
  const outputDir = opts?.outputDir ?? join(ROOT, "vault");
  const verbose = opts?.verbose ?? false;

  // Phase 0: Clean output
  if (existsSync(outputDir)) {
    rmSync(outputDir, { recursive: true });
  }
  mkdirSync(outputDir, { recursive: true });

  // Initialize DB
  getConnection();

  // Phase 1: Query + enrich
  const data = queryAllData();
  await enrichConversationsWithTranscripts(data);

  // Phase 2: Build registry
  const reg = buildRegistry(data);

  // Phase 3: Render
  const pages = renderAllPages(data, reg, verbose);

  // Phase 4: Backlinks
  injectBacklinks(pages, reg);

  // Phase 5: Write
  await writePages(pages, outputDir);

  console.log(`[vault] Done! ${pages.length} pages in ${outputDir}`);
}
