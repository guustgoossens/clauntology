import type { DomainData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, domainPath } from "../wikilinks.ts";

export function renderDomain(data: DomainData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "domain",
    name: data.name,
    skill_count: data.skillCount,
    avg_level: Math.round(data.avgLevel * 100) / 100,
    max_level: data.maxLevel,
  });

  const skillTable = data.skills
    .sort((a, b) => b.level - a.level)
    .map((s) => {
      const bar = "█".repeat(Math.round(s.level)) + "░".repeat(5 - Math.round(s.level));
      return `| ${link.link(s.name)} | ${bar} ${s.level.toFixed(1)} |`;
    })
    .join("\n");

  const familyList = data.families
    .map((f) => `- **${f.name}** (${f.skillCount} skills in taxonomy)`)
    .join("\n");

  const body = `
# ${data.name}

> ${data.description}

## Overview

- **Skills with evidence:** ${data.skillCount}
- **Average depth:** ${data.avgLevel.toFixed(1)} / 5.0
- **Deepest skill:** ${data.maxLevel.toFixed(1)} / 5.0

## Skills

| Skill | Level |
|-------|-------|
${skillTable || "| _No skills with evidence yet_ | |"}

## Families

${familyList || "_No families._"}
`.trim();

  return {
    path: domainPath(data.name),
    content: `${fm}\n\n${body}\n`,
    displayName: data.name,
    type: "domain",
  };
}
