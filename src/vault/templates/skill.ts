import type { SkillData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, skillPath } from "../wikilinks.ts";

const LEVEL_LABELS: Record<number, string> = {
  1: "Awareness", 2: "Exploration", 3: "Application", 4: "Fluency", 5: "Mastery",
};

function levelLabel(level: number): string {
  return LEVEL_LABELS[Math.round(level)] ?? "Unknown";
}

function depthBar(level: number): string {
  const filled = Math.round(level);
  return "█".repeat(filled) + "░".repeat(5 - filled);
}

export function renderSkill(data: SkillData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "skill",
    name: data.name,
    domain: data.domain,
    family: data.family,
    taxonomy_path: data.taxonomyPath,
    level: data.level,
    evidence_count: data.evidenceCount,
    first_evidence: data.firstEvidence,
    last_evidence: data.lastEvidence,
  });

  const evidence = data.evidence
    .filter((e) => e.convId)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((e) => `- ${link.link(e.title || e.convId)} (${e.date ?? "?"}) — depth ${e.depth ?? "?"}`)
    .join("\n");

  const body = `
# ${data.name}

**${depthBar(data.level)} ${data.level.toFixed(1)} / 5.0 — ${levelLabel(data.level)}**

Domain: ${link.link(data.domain)} > ${data.family}

## Evidence Trail

${evidence || "_No evidence conversations linked._"}

## Growth Timeline

| First seen | Latest | Evidence count |
|------------|--------|----------------|
| ${data.firstEvidence || "?"} | ${data.lastEvidence || "?"} | ${data.evidenceCount} |
`.trim();

  return {
    path: skillPath(data.domain, data.family, data.name),
    content: `${fm}\n\n${body}\n`,
    displayName: data.name,
    type: "skill",
  };
}
