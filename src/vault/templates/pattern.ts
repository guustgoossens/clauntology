import type { PatternData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, patternPath } from "../wikilinks.ts";

export function renderPattern(data: PatternData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "pattern",
    name: data.pattern,
    frequency: data.frequency,
  });

  const convList = data.conversations
    .filter((c) => c.convId)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .slice(0, 30) // Limit to 30 most relevant
    .map((c) => `- ${link.link(c.title || c.convId)} (${c.date ?? "?"})`)
    .join("\n");

  const body = `
# ${data.pattern}

**Frequency:** Observed in ${data.frequency} conversation(s)

## Conversations

${convList || "_No conversations linked._"}
`.trim();

  return {
    path: patternPath(data.pattern),
    content: `${fm}\n\n${body}\n`,
    displayName: data.pattern,
    type: "pattern",
  };
}
