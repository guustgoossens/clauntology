import type { EraData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, eraPath } from "../wikilinks.ts";

export function renderEra(data: EraData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "era",
    name: data.label,
    start_date: data.startDate,
    end_date: data.endDate || "ongoing",
    conversation_count: data.conversationCount,
  });

  const body = `
# ${data.label}

> ${data.description}

## Period

**${data.startDate}** → **${data.endDate || "ongoing"}**

## Stats

- Conversations during this era: **${data.conversationCount}**
`.trim();

  return {
    path: eraPath(data.label),
    content: `${fm}\n\n${body}\n`,
    displayName: data.label,
    type: "era",
  };
}
