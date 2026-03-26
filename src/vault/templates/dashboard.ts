import type { VaultData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter } from "../wikilinks.ts";

export function renderDashboard(data: VaultData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "dashboard",
    name: "Ontolo GG — Personal Knowledge Graph",
  });

  // Top skills
  const topSkills = [...data.skills]
    .sort((a, b) => b.level - a.level)
    .slice(0, 15)
    .map((s) => {
      const bar = "█".repeat(Math.round(s.level)) + "░".repeat(5 - Math.round(s.level));
      return `| ${link.link(s.name)} | ${s.domain} | ${bar} ${s.level.toFixed(1)} |`;
    })
    .join("\n");

  // Active projects
  const activeProjects = data.projects
    .filter((p) => p.status === "active")
    .slice(0, 10)
    .map((p) => `- ${link.link(p.name)} — ${p.description?.slice(0, 80) ?? ""}`)
    .join("\n");

  // Domain summary
  const domainSummary = data.domains
    .filter((d) => d.skillCount > 0)
    .sort((a, b) => b.avgLevel - a.avgLevel)
    .map((d) => `| ${link.link(d.name)} | ${d.skillCount} | ${d.avgLevel.toFixed(1)} |`)
    .join("\n");

  // Recent conversations
  const recentConvs = data.conversations
    .filter((c) => c.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10)
    .map((c) => `- ${link.link(c.title)} (${c.date})`)
    .join("\n");

  // Eras
  const eraList = data.eras
    .map((e) => `- ${link.link(e.label)} — ${e.startDate} → ${e.endDate || "ongoing"} (${e.conversationCount} conversations)`)
    .join("\n");

  const body = `
# Ontolo GG

> A living personal knowledge graph mapping ${data.conversations.length} Claude conversations.

## Stats

| Metric | Count |
|--------|-------|
| Conversations | ${data.stats.Conversation ?? 0} |
| Topics | ${data.stats.Topic ?? 0} |
| Skills | ${data.stats.Skill ?? 0} |
| Projects | ${data.stats.Project ?? 0} |
| People | ${(data.stats.Person ?? 0) - 1} |
| Beliefs | ${data.stats.Belief ?? 0} |
| Questions | ${data.stats.Question ?? 0} |

## Top Skills

| Skill | Domain | Level |
|-------|--------|-------|
${topSkills}

## Domains

| Domain | Skills | Avg Depth |
|--------|--------|-----------|
${domainSummary}

## Active Projects

${activeProjects || "_No active projects._"}

## Eras

${eraList}

## Recent Conversations

${recentConvs}

## Meta

- ${link.link("Growth Trajectory")}
- ${link.link("Curiosity Map")}
- ${link.link("Personality Profile")}
`.trim();

  return {
    path: "_index.md",
    content: `${fm}\n\n${body}\n`,
    displayName: "Ontolo GG",
    type: "dashboard",
  };
}
