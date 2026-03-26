/**
 * Backlink computation.
 * Scans all rendered pages for [[wikilinks]], builds a reverse index,
 * and injects a ## Backlinks section into each page.
 */

import type { VaultPage } from "./types.ts";
import { WikilinkRegistry } from "./wikilinks.ts";

/** Extract all wikilink targets from markdown content. */
function extractWikilinks(content: string): string[] {
  // Match [[path|display]] or [[path]]
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const results: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/** Inject backlinks into all pages. Mutates page.content in place. */
export function injectBacklinks(pages: VaultPage[], registry: WikilinkRegistry): void {
  // Build reverse index: targetPath → source pages
  const incoming = new Map<string, Set<string>>();

  for (const page of pages) {
    const links = extractWikilinks(page.content);
    for (const targetPathRaw of links) {
      // Wikilinks use path without .md
      const targetPath = targetPathRaw.endsWith(".md") ? targetPathRaw : targetPathRaw + ".md";

      if (!incoming.has(targetPath)) incoming.set(targetPath, new Set());
      incoming.get(targetPath)!.add(page.path);
    }
  }

  // Build path→page lookup
  const pageByPath = new Map<string, VaultPage>();
  for (const page of pages) {
    pageByPath.set(page.path, page);
  }

  // Inject backlinks section
  let injected = 0;
  for (const page of pages) {
    const sourcePaths = incoming.get(page.path);
    if (!sourcePaths || sourcePaths.size === 0) continue;

    // Deduplicate and sort
    const backlinks = [...sourcePaths]
      .filter((p) => p !== page.path) // Don't self-link
      .sort()
      .map((sourcePath) => {
        const sourcePage = pageByPath.get(sourcePath);
        const name = sourcePage?.displayName ?? sourcePath.replace(/\.md$/, "");
        const pathWithoutMd = sourcePath.replace(/\.md$/, "");
        return `- [[${pathWithoutMd}|${name}]]`;
      });

    if (backlinks.length === 0) continue;

    page.content += `\n\n## Backlinks\n\n${backlinks.join("\n")}\n`;
    injected++;
  }

  console.log(`[vault] Injected backlinks into ${injected} pages`);
}
