import type { BeliefData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, beliefPath } from "../wikilinks.ts";

export function renderBelief(data: BeliefData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "belief",
    domain: data.domain,
    confidence: data.confidence,
    evidence_count: data.evidenceCount,
    first_expressed: data.firstExpressed,
    last_expressed: data.lastExpressed,
  });

  const convList = data.conversations
    .filter((c) => c.convId)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((c) => `- ${link.link(c.title || c.convId)} (${c.date ?? "?"})`)
    .join("\n");

  const confidenceBar = "█".repeat(Math.round(data.confidence * 10)) +
    "░".repeat(10 - Math.round(data.confidence * 10));

  const body = `
# ${data.statement}

**Domain:** ${link.link(data.domain)}
**Confidence:** ${confidenceBar} ${(data.confidence * 100).toFixed(0)}%
${data.evolution ? `**Evolution:** ${data.evolution}` : ""}

## Evidence

${convList || "_No evidence conversations linked._"}

## Timeline

First expressed: ${data.firstExpressed || "?"} | Latest: ${data.lastExpressed || "?"} | Evidence count: ${data.evidenceCount}
`.trim();

  return {
    path: beliefPath(data.id, data.statement),
    content: `${fm}\n\n${body}\n`,
    displayName: data.statement.slice(0, 80),
    type: "belief",
  };
}
