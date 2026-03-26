# Ontolo

**A living personal knowledge graph built from your Claude conversations.**

Ontolo indexes every Claude conversation you have, both web chat exports and Claude Code sessions, and maps them onto a structured taxonomy of ~200 skills across 8 domains. It extracts skills, topics, projects, people, beliefs, questions, thinking patterns, and growth signals from each conversation, loads them into an embedded graph database, and generates a fully cross-referenced Obsidian vault with thousands of interconnected pages.

The result is a navigable map of everything you know, everything you're learning, and how your thinking evolves over time.

---

## Architecture

Ontolo runs as a four-stage pipeline. Each stage is independent and idempotent — you can re-run any stage without losing data.

```mermaid
graph LR
    A[Claude Exports] --> B[Ingest]
    B --> C[Extract]
    C --> D[Graph]
    D --> E[Vault]

    B -- "Normalized JSON" --> C
    C -- "Extraction JSON" --> D
    D -- "KuzuDB" --> E
    E -- "Markdown" --> F[Obsidian]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#0f3460,color:#fff
    style C fill:#1a1a2e,stroke:#0f3460,color:#fff
    style D fill:#1a1a2e,stroke:#0f3460,color:#fff
    style E fill:#1a1a2e,stroke:#0f3460,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

### 1. Ingest (`src/ingest/`)

Parses two source formats into a common normalized JSON structure:

- **Claude Web exports** — The `conversations.json` file from claude.ai/settings "Export Data"
- **Claude Code sessions** — JSONL files from `~/.claude/projects/**/*.jsonl`

### 2. Extract (`src/extract/`)

Sends each conversation to the Claude API with a specialized extraction prompt. Pulls out 9 entity types, each with evidence quotes and confidence scores:

| Entity | What it captures |
|---|---|
| Topics | Subjects discussed, with depth assessment |
| Skills | Mapped to the Homo Universalis taxonomy |
| Projects | Software, writing, or other work mentioned |
| People | Individuals referenced in conversations |
| Beliefs | Stated opinions, values, positions |
| Questions | Open questions and areas of curiosity |
| Thinking Patterns | Reasoning approaches and mental models |
| Emotional Tone | Sentiment and engagement level |
| Growth Signals | Evidence of learning and skill development |

### 3. Graph (`src/graph/`)

Loads all extractions into [KuzuDB](https://kuzudb.com), an embedded property graph database. The schema includes 9 node tables and ~20 relationship tables. The full Homo Universalis taxonomy is loaded as a skill tree with `CHILD_OF` hierarchy. All writes use `MERGE` for idempotent upserts.

### 4. Vault (`src/vault/`)

Generates an Obsidian-compatible markdown vault from the graph. Includes skill pages, topic pages, conversation transcripts, belief tracking, growth timelines, domain overviews, and project summaries. Every page is cross-referenced with `[[wikilinks]]` and backlinks are injected automatically.

---

## The Homo Universalis Taxonomy

Based on the Renaissance ideal of the universal person, the taxonomy provides a structured map of human capability. It serves as the scaffold onto which skills from your conversations get mapped.

**Structure:** 8 domains, ~40 families, ~200 leaf skills

**Domains:**

| Domain | Covers |
|---|---|
| Cognitive & Intellectual | Critical thinking, learning, analysis, problem-solving |
| Technical & Engineering | Software, systems, AI/ML, data, infrastructure |
| Business & Entrepreneurship | Strategy, product, finance, operations, growth |
| Social & Interpersonal | Communication, leadership, collaboration, influence |
| Creative & Artistic | Writing, design, music, visual arts, storytelling |
| Physical & Embodied | Movement, health, spatial awareness, craftsmanship |
| Self & Inner Development | Emotional intelligence, mindfulness, resilience, identity |
| Knowledge Domains | Science, philosophy, history, law, economics |

**Depth Scale (0-5):**

| Level | Name | Meaning |
|---|---|---|
| 0 | None | No evidence |
| 1 | Awareness | Mentioned or asked about |
| 2 | Exploration | Actively learning, asking questions |
| 3 | Application | Using in projects, making decisions |
| 4 | Fluency | Teaching others, deep understanding |
| 5 | Mastery | Pushing boundaries, novel contributions |

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| Language | TypeScript (strict) |
| Database | [KuzuDB](https://kuzudb.com) (embedded graph DB) |
| LLM | Claude API via [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) |
| Output | Obsidian-compatible Markdown vault |
| Future UI | React 19 web dashboard with Bun.serve() |

---

## Prerequisites

- [Bun](https://bun.sh) (v1.2+)
- An [Anthropic API key](https://console.anthropic.com) (for the extraction stage)
- Claude conversation exports (from [claude.ai/settings](https://claude.ai/settings) -- "Export Data")

---

## Setup

```bash
git clone https://github.com/guustgoossens/clauntology.git
cd clauntology
bun install
cp .env.example .env  # Add your ANTHROPIC_API_KEY
```

---

## Usage

The pipeline runs in four sequential stages. Each produces output that feeds the next.

```bash
# 1. Ingest — parse your Claude exports into normalized JSON
#    Place your Claude web export (conversations.json) in data/web-exports/
bun run ingest                # Parse all sources
bun run ingest:web            # Web exports only
bun run ingest:code           # Code sessions only
bun run ingest:force          # Re-parse everything

# 2. Extract — pull structured entities from each conversation
bun run extract:stats         # Check extraction progress
bun run extract:loop          # Run batch extraction (needs API key)

# 3. Graph — build the knowledge graph
bun run init-graph            # Create schema + load taxonomy
bun run init-graph:reset      # Reset and recreate from scratch
bun run build-graph           # Load extractions into KuzuDB
bun run build-graph:dry       # Dry run (preview without writing)
bun run build-graph:reset     # Reset schema + rebuild

# 4. Vault — generate your Obsidian vault
bun run generate-vault        # Output to vault/ directory
bun run generate-vault:verbose
```

Then open the `vault/` directory in [Obsidian](https://obsidian.md).

---

## Project Structure

```
src/
  ingest/
    index.ts              # Entry point — orchestrates parsing
    web-parser.ts         # Parses Claude Web conversations.json
    code-parser.ts        # Parses Claude Code JSONL sessions
    manifest.ts           # Tracks which files have been ingested
    types.ts              # Normalized conversation types
  extract/
    index.ts              # Entry point — single extraction
    extract-loop.ts       # Batch extraction runner
    extractor.ts          # Claude API call + response parsing
    prompts.ts            # System prompt for entity extraction
    schema.ts             # Extraction output types (9 entity types)
    save-extraction.ts    # Write extraction result to disk
    next-job.ts           # Queue: find next unprocessed conversation
  graph/
    init.ts               # Create KuzuDB schema + load taxonomy
    build.ts              # Load all extractions into graph
    loader.ts             # MERGE upsert logic per entity type
    schema.ts             # DDL for 9 node tables + ~20 rel tables
    taxonomy.ts           # The Homo Universalis skill tree (207 skills)
    queries.ts            # Reusable Cypher query helpers
    db.ts                 # KuzuDB connection management
  vault/
    index.ts              # Entry point — orchestrates generation
    generator.ts          # Core page generation logic
    wikilinks.ts          # [[wikilink]] resolution
    backlinks.ts          # Backlink injection across pages
    queries.ts            # Graph queries for vault content
    types.ts              # Vault page types
    templates/
      skill.ts            # Skill page template
      topic.ts            # Topic page template
      conversation.ts     # Conversation transcript template
      project.ts          # Project page template
      person.ts           # Person page template
      belief.ts           # Belief tracking template
      pattern.ts          # Thinking pattern template
      domain.ts           # Domain overview template
      era.ts              # Time period / era template
      dashboard.ts        # Top-level dashboard template
      meta.ts             # Metadata and frontmatter helpers
data/
  web-exports/            # Input: raw Claude web exports
  normalized/             # Stage 1 output: normalized JSON
  extractions/            # Stage 2 output: extraction JSON
db/                       # Stage 3: KuzuDB database files
vault/                    # Stage 4 output: Obsidian markdown vault
```

---

## Data Flow Example

A single conversation flows through the pipeline like this:

**Raw input** (Claude web export) --
```
"What's the best way to structure a TypeScript monorepo?"
```

**Stage 1 — Normalized JSON** --
```json
{
  "id": "conv_abc123",
  "source": "web",
  "title": "TypeScript monorepo structure",
  "created_at": "2025-03-15T10:30:00Z",
  "turns": [...]
}
```

**Stage 2 — Extraction JSON** --
```json
{
  "skills": [{
    "name": "TypeScript",
    "taxonomy_path": "Technical & Engineering/Software Development/TypeScript",
    "depth": "application",
    "evidence": ["discussing workspace references and project structure"],
    "confidence": 0.85
  }],
  "topics": [{ "name": "Monorepo Architecture", "depth": "exploration" }],
  "growth_signals": [{ "type": "skill_application", "description": "..." }]
}
```

**Stage 3 — Graph nodes** --
```
(:Skill {name: "TypeScript", level: 3.0})
  -[:MAPS_TO]-> (:SkillNode {taxonomy_path: "Technical & Engineering/..."})
(:Conversation {id: "conv_abc123"})
  -[:DEMONSTRATES]-> (:Skill {name: "TypeScript"})
```

**Stage 4 — Vault page** (`vault/skills/TypeScript.md`) --
```markdown
# TypeScript
Domain: Technical & Engineering | Family: Software Development
Depth: 3.0 / 5.0 (Application)

## Evidence
- "discussing workspace references and project structure" — [[conv_abc123]]

## Related Topics
- [[Monorepo Architecture]]
```

---

## Customization

| What | Where | How |
|---|---|---|
| Skill taxonomy | `src/graph/taxonomy.ts` | Add/remove/reorganize domains, families, and leaf skills |
| Extraction prompt | `src/extract/prompts.ts` | Change what entities get extracted and how |
| Vault templates | `src/vault/templates/*.ts` | Customize page rendering, sections, and formatting |
| Graph schema | `src/graph/schema.ts` | Add new node/relationship types |

---

## Status

| Stage | Status |
|---|---|
| Ingest (web + code) | Working |
| Extract (Claude API) | Working |
| Graph (KuzuDB) | Working |
| Vault (Obsidian) | Working |
| Entity resolver (deduplication) | Planned |
| Skill scorer (weighted depth) | Planned |
| Web UI (React 19) | Planned |
| Automation (watch + re-extract) | Planned |

---

## Privacy

All data stays on your machine. KuzuDB is an embedded database — no server, no network calls, no cloud. The only external call is to the Claude API during the extraction stage, which sends your conversation text for analysis.

No telemetry. No tracking. Your knowledge graph is yours.

---

## License

MIT
