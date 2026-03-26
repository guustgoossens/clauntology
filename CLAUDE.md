---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## Ontolo GG — Extraction Instructions

This project builds a personal knowledge graph from Claude conversations. When the user asks you to "extract conversations" or "do extraction", follow this process:

### How extraction works
1. Run `bun run extract:stats` to see progress
2. Run `bun run extract:loop --batch N` to get the next N conversations to process
3. For each conversation: read the normalized JSON file, analyze it according to the extraction prompt in `src/extract/prompts.ts`, and write the extraction result as a CachedExtraction JSON to the output path shown
4. The extraction schema is defined in `src/extract/schema.ts` — follow it exactly

### Extraction process per conversation
1. Read the conversation file (e.g. `data/normalized/web/{id}.json`)
2. Analyze the conversation content to extract: topics, skills, projects, people, beliefs, questions, thinking_patterns, emotional_tone, growth_signals, conversation_summary, key_insight
3. For skills: map to the homo universalis taxonomy in `src/graph/taxonomy.ts` using taxonomy_path format "Domain/Family/Skill"
4. For every extraction: include quotes as evidence and confidence scores
5. Write the result as a CachedExtraction JSON (see schema.ts for the format) to the output path

### Key files
- `PLAN.md` — Full project plan with schema design
- `src/extract/schema.ts` — Extraction output types
- `src/extract/prompts.ts` — The extraction prompt (read EXTRACTION_SYSTEM_PROMPT for full instructions)
- `src/graph/taxonomy.ts` — The 207-skill homo universalis taxonomy
- `data/normalized/` — Input: parsed conversations
- `data/extractions/` — Output: extraction results

### Running extraction in a loop
Use multiple sub-agents to extract conversations in parallel. Each agent reads one conversation, extracts entities, and writes the result. Use `bun run extract:loop --batch 10` to get 10 jobs, then process them.
