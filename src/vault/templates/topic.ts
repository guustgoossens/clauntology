import type { TopicData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, topicPath } from "../wikilinks.ts";

const DEPTH_LABELS: Record<number, string> = {
  1: "Awareness", 2: "Exploration", 3: "Application", 4: "Fluency", 5: "Mastery",
};

export function renderTopic(data: TopicData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "topic",
    name: data.name,
    domain: data.domain,
    depth: data.depth,
    evidence_count: data.evidenceCount,
    first_discussed: data.firstDiscussed,
    last_discussed: data.lastDiscussed,
  });

  const convList = data.conversations
    .filter((c) => c.convId)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((c) => `- ${link.link(c.title || c.convId)} (${c.date ?? "?"})`)
    .join("\n");

  const body = `
# ${data.name}

**Domain:** ${link.link(data.domain)}
**Depth:** ${DEPTH_LABELS[Math.round(data.depth)] ?? "Unknown"} (${data.depth.toFixed(1)})

${data.description ? `> ${data.description}` : ""}

## Conversations

${convList || "_No conversations linked._"}

## Timeline

First discussed: ${data.firstDiscussed || "?"} | Latest: ${data.lastDiscussed || "?"} | Mentioned ${data.evidenceCount} time(s)
`.trim();

  return {
    path: topicPath(data.name),
    content: `${fm}\n\n${body}\n`,
    displayName: data.name,
    type: "topic",
  };
}
