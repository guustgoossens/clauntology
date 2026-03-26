import type { ConversationData, VaultPage } from "../types.ts";
import { WikilinkRegistry, frontmatter, conversationPath } from "../wikilinks.ts";

export function renderConversation(data: ConversationData, link: WikilinkRegistry): VaultPage {
  const fm = frontmatter({
    type: "conversation",
    title: data.title,
    source: data.source,
    date: data.date,
    platform_project: data.platformProject,
    emotional_tone: data.emotionalTone,
    thinking_pattern: data.thinkingPattern,
    key_topics: data.keyTopics,
  });

  // Linked entities
  const topicLinks = data.linkedTopics.length > 0
    ? data.linkedTopics.map((t) => link.link(t)).join(", ")
    : "_none_";
  const skillLinks = data.linkedSkills.length > 0
    ? data.linkedSkills.map((s) => link.link(s)).join(", ")
    : "_none_";
  const projectLinks = data.linkedProjects.length > 0
    ? data.linkedProjects.map((p) => link.link(p)).join(", ")
    : "_none_";
  const peopleLinks = data.linkedPeople.length > 0
    ? data.linkedPeople.map((p) => link.link(p)).join(", ")
    : "_none_";

  // Full transcript
  const transcript = data.messages
    .map((m) => {
      const label = m.role === "user" ? "**You:**" : "**Claude:**";
      const text = m.text ?? "";
      // Truncate extremely long messages (e.g., code dumps)
      const truncated = text.length > 5000 ? text.slice(0, 5000) + "\n\n_[message truncated]_" : text;
      return `${label}\n\n${truncated}`;
    })
    .join("\n\n---\n\n");

  const body = `
# ${data.title}

**Date:** ${data.date}
**Source:** ${data.source === "claude_code" ? "Claude Code" : "Claude Web"}
${data.emotionalTone ? `**Tone:** ${data.emotionalTone}` : ""}
${data.thinkingPattern ? `**Thinking pattern:** ${data.thinkingPattern}` : ""}

## Summary

${data.summary || "_No summary available._"}

## Entities

- **Topics:** ${topicLinks}
- **Skills:** ${skillLinks}
- **Projects:** ${projectLinks}
- **People:** ${peopleLinks}

## Transcript

${transcript || "_No messages available._"}
`.trim();

  return {
    path: conversationPath(data.source, data.date, data.platformProject, data.title, data.id),
    content: `${fm}\n\n${body}\n`,
    displayName: data.title,
    type: "conversation",
  };
}
