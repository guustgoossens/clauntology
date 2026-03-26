/**
 * Ontolo GG — Web UI server.
 * Uses Bun.serve() with HTML imports and JSON API routes.
 */

import index from "./index.html";
import {
  getFullTaxonomy,
  getDevelopedSkills,
  getGraphStats,
  getSkillDetail,
  getDomainOverview,
} from "../graph/queries.ts";

Bun.serve({
  port: 3000,

  routes: {
    "/": index,

    "/api/taxonomy": {
      GET: () => Response.json(getFullTaxonomy()),
    },

    "/api/skills": {
      GET: () => Response.json(getDevelopedSkills()),
    },

    "/api/stats": {
      GET: () => Response.json(getGraphStats()),
    },

    "/api/skill/:id": {
      GET: (req) => {
        const id = req.params.id;
        const result = getSkillDetail(id);
        if (!result.length) {
          return Response.json({ error: "Skill not found" }, { status: 404 });
        }
        return Response.json(result[0]);
      },
    },

    "/api/domains": {
      GET: () => Response.json(getDomainOverview()),
    },
  },

  development: {
    hmr: true,
    console: true,
  },
});

console.log("Ontolo GG UI running at http://localhost:3000");
