/**
 * Wikilink registry and path utilities.
 * Maps display names → vault-relative file paths for [[wikilink]] resolution.
 */

// ============================================
// Slug helpers
// ============================================

/** Slugify for directory names. */
export function slugDir(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Slugify for file names. */
export function slugFile(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ============================================
// Path helpers
// ============================================

export function skillPath(domain: string, family: string, name: string): string {
  return `skills/${slugDir(domain)}/${slugDir(family)}/${slugFile(name)}.md`;
}

export function topicPath(name: string): string {
  return `topics/${slugFile(name)}.md`;
}

export function projectPath(name: string): string {
  return `projects/${slugFile(name)}.md`;
}

export function personPath(name: string): string {
  return `people/${slugFile(name)}.md`;
}

export function beliefPath(id: string, statement: string): string {
  const slug = slugFile(statement.slice(0, 60));
  // Append short hash from ID for uniqueness
  const shortHash = id.replace(/^belief_/, "").slice(0, 8);
  return `beliefs/${slug}-${shortHash}.md`;
}

export function eraPath(label: string): string {
  return `eras/${slugFile(label)}.md`;
}

export function conversationPath(
  source: string,
  date: string,
  platformProject: string,
  title: string,
  id: string
): string {
  const slug = slugFile(title || "untitled");
  const shortId = id.slice(0, 8);

  if (source === "claude_code" && platformProject) {
    return `conversations/code/${slugDir(platformProject)}/${slug}-${shortId}.md`;
  }

  const yearMonth = date?.slice(0, 7) ?? "unknown";
  return `conversations/web/${yearMonth}/${slug}-${shortId}.md`;
}

export function patternPath(name: string): string {
  return `patterns/${slugFile(name)}.md`;
}

export function domainPath(name: string): string {
  return `domains/${slugDir(name)}.md`;
}

// ============================================
// Wikilink Registry
// ============================================

export class WikilinkRegistry {
  private nameToPath = new Map<string, string>();
  private pathToName = new Map<string, string>();

  /** Register a display name → vault path mapping. */
  register(displayName: string, filePath: string): void {
    const key = displayName.toLowerCase().trim();
    if (!key) return;

    // If name collision, keep the first registration
    // (skill pages are registered before topic pages, so they take priority)
    if (!this.nameToPath.has(key)) {
      this.nameToPath.set(key, filePath);
    }
    this.pathToName.set(filePath, displayName);
  }

  /** Create a wikilink string for a display name. */
  link(name: string): string {
    if (!name) return "";
    const key = name.toLowerCase().trim();
    const path = this.nameToPath.get(key);
    if (!path) return name; // Plain text if not registered

    // Use path-based link (without .md) with display name
    const pathWithoutMd = path.replace(/\.md$/, "");
    return `[[${pathWithoutMd}|${name}]]`;
  }

  /** Resolve a display name to its vault path. Returns null if not found. */
  resolve(name: string): string | null {
    const key = name.toLowerCase().trim();
    return this.nameToPath.get(key) ?? null;
  }

  /** Resolve a path back to its display name. */
  nameFor(path: string): string | null {
    return this.pathToName.get(path) ?? null;
  }

  /** Get total registered entries. */
  get size(): number {
    return this.nameToPath.size;
  }
}

// ============================================
// YAML frontmatter helper
// ============================================

/** Render a YAML frontmatter block from an object. */
export function frontmatter(obj: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${escYaml(String(item))}"`);
        }
      }
    } else if (typeof value === "string") {
      lines.push(`${key}: "${escYaml(value)}"`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}

function escYaml(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}
