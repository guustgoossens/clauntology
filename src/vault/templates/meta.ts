import type { VaultData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter } from "../wikilinks.ts";

export function renderMetaPages(data: VaultData, link: WikilinkRegistry): VaultPage[] {
  return [
    renderGrowthTrajectory(data, link),
    renderCuriosityMap(data, link),
    renderPersonalityProfile(data, link),
  ];
}

function renderGrowthTrajectory(data: VaultData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({ type: "meta", name: "Growth Trajectory" });

  // Find fastest growing skills (most recent evidence + high evidence count)
  const recentSkills = [...data.skills]
    .filter((s) => s.lastEvidence)
    .sort((a, b) => b.lastEvidence.localeCompare(a.lastEvidence))
    .slice(0, 20);

  const mostEvidenced = [...data.skills]
    .sort((a, b) => b.evidenceCount - a.evidenceCount)
    .slice(0, 15);

  // Domain depth summary
  const domainSummary = data.domains
    .filter((d) => d.skillCount > 0)
    .sort((a, b) => b.avgLevel - a.avgLevel)
    .map((d) => `| ${link.link(d.name)} | ${d.skillCount} | ${d.avgLevel.toFixed(1)} | ${d.maxLevel.toFixed(1)} |`)
    .join("\n");

  const recentList = recentSkills
    .map((s) => `- ${link.link(s.name)} — level ${s.level.toFixed(1)}, last seen ${s.lastEvidence}`)
    .join("\n");

  const deepList = mostEvidenced
    .map((s) => `- ${link.link(s.name)} — ${s.evidenceCount} conversations, level ${s.level.toFixed(1)}`)
    .join("\n");

  const body = `
# Growth Trajectory

## Domain Depth

| Domain | Skills | Avg Depth | Max Depth |
|--------|--------|-----------|-----------|
${domainSummary}

## Most Recently Active Skills

${recentList}

## Most Evidenced Skills

${deepList}

## Stats

- Total skills with evidence: **${data.skills.length}**
- Total conversations analyzed: **${data.conversations.length}**
- Total topics discussed: **${data.topics.length}**
`.trim();

  return {
    path: "meta/growth-trajectory.md",
    content: `${fm}\n\n${body}\n`,
    displayName: "Growth Trajectory",
    type: "meta",
  };
}

function renderCuriosityMap(data: VaultData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({ type: "meta", name: "Curiosity Map" });

  // Group questions by domain
  const byDomain = new Map<string, typeof data.questions>();
  for (const q of data.questions) {
    const domain = q.domain || "Other";
    if (!byDomain.has(domain)) byDomain.set(domain, []);
    byDomain.get(domain)!.push(q);
  }

  const sections = [...byDomain.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([domain, questions]) => {
      const obsessive = questions.filter((q) => q.depth === "obsessive");
      const serious = questions.filter((q) => q.depth === "serious");
      const casual = questions.filter((q) => q.depth === "casual");

      let section = `### ${link.link(domain)} (${questions.length} questions)\n\n`;

      if (obsessive.length > 0) {
        section += `**Deep curiosities:**\n`;
        section += obsessive.map((q) => `- ${q.text} ${q.answered ? "✓" : "?"}`).join("\n");
        section += "\n\n";
      }
      if (serious.length > 0) {
        section += `**Serious explorations:**\n`;
        section += serious.slice(0, 10).map((q) => `- ${q.text} ${q.answered ? "✓" : "?"}`).join("\n");
        if (serious.length > 10) section += `\n- _...and ${serious.length - 10} more_`;
        section += "\n\n";
      }
      if (casual.length > 0) {
        section += `**Casual questions:** ${casual.length} total\n\n`;
      }

      return section;
    })
    .join("\n");

  const body = `
# Curiosity Map

**Total questions asked:** ${data.questions.length}
**Answered:** ${data.questions.filter((q) => q.answered).length}
**Unanswered:** ${data.questions.filter((q) => !q.answered).length}

## By Domain

${sections}
`.trim();

  return {
    path: "meta/curiosity-map.md",
    content: `${fm}\n\n${body}\n`,
    displayName: "Curiosity Map",
    type: "meta",
  };
}

function renderPersonalityProfile(data: VaultData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({ type: "meta", name: "Personality Profile" });

  // Top beliefs by confidence
  const topBeliefs = [...data.beliefs]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20)
    .map((b) => `- ${link.link(b.statement.slice(0, 80))} (${(b.confidence * 100).toFixed(0)}% confidence)`)
    .join("\n");

  // Top thinking patterns
  const topPatterns = data.patterns
    .slice(0, 10)
    .map((p) => `- ${link.link(p.pattern)} — observed ${p.frequency} times`)
    .join("\n");

  // Emotional tone distribution
  const toneMap = new Map<string, number>();
  for (const c of data.conversations) {
    if (c.emotionalTone) {
      toneMap.set(c.emotionalTone, (toneMap.get(c.emotionalTone) ?? 0) + 1);
    }
  }
  const topTones = [...toneMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tone, count]) => `| ${tone} | ${count} | ${"█".repeat(Math.round(count / data.conversations.length * 20))} |`)
    .join("\n");

  const body = `
# Personality Profile

## Core Beliefs

${topBeliefs}

## Thinking Patterns

${topPatterns}

## Emotional Tone Distribution

| Tone | Count | Distribution |
|------|-------|-------------|
${topTones}

## Identity

- **Domains covered:** ${data.domains.filter((d) => d.skillCount > 0).length} / 8
- **Total skills demonstrated:** ${data.skills.length}
- **People in graph:** ${data.people.length}
- **Projects:** ${data.projects.length}
- **Beliefs held:** ${data.beliefs.length}
`.trim();

  return {
    path: "meta/personality-profile.md",
    content: `${fm}\n\n${body}\n`,
    displayName: "Personality Profile",
    type: "meta",
  };
}
