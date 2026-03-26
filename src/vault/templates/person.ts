import type { PersonData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, personPath } from "../wikilinks.ts";

export function renderPerson(data: PersonData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "person",
    name: data.name,
    relationship: data.relationship,
    mention_count: data.mentionCount,
    first_mentioned: data.firstMentioned,
    last_mentioned: data.lastMentioned,
  });

  const body = `
# ${data.name}

**Relationship:** ${data.relationship || "unknown"}
**Mentions:** ${data.mentionCount}

${data.context ? `> ${data.context.slice(0, 500)}` : ""}

## Timeline

First mentioned: ${data.firstMentioned || "?"} | Latest: ${data.lastMentioned || "?"}
`.trim();

  return {
    path: personPath(data.name),
    content: `${fm}\n\n${body}\n`,
    displayName: data.name,
    type: "person",
  };
}
