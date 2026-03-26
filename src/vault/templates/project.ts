import type { ProjectData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, projectPath } from "../wikilinks.ts";

export function renderProject(data: ProjectData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "project",
    name: data.name,
    status: data.status,
    tech_stack: data.techStack,
    domain: data.domain,
  });

  const techList = data.techStack.length > 0
    ? data.techStack.map((t) => `\`${t}\``).join(", ")
    : "_None listed_";

  const convList = data.conversations
    .filter((c) => c.convId)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((c) => `- ${link.link(c.title || c.convId)} (${c.date ?? "?"})`)
    .join("\n");

  const body = `
# ${data.name}

**Status:** ${data.status || "unknown"}
**Tech Stack:** ${techList}

${data.description ? `> ${data.description}` : ""}

## Conversations

${convList || "_No conversations linked._"}
`.trim();

  return {
    path: projectPath(data.name),
    content: `${fm}\n\n${body}\n`,
    displayName: data.name,
    type: "project",
  };
}
