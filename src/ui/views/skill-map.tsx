import React, { useRef, useEffect, useState, useCallback } from "react";

// ============================================
// Types
// ============================================

interface TaxonomyNode {
  id: string;
  name: string;
  domain: string;
  family: string;
  path: string;
  type: "domain" | "family" | "skill";
  is_leaf: boolean;
  parent_id: string | null;
}

interface DevelopedSkill {
  id: string;
  name: string;
  level: number;
  domain: string;
  path: string;
  evidence: number;
  active: boolean;
  growth: number;
  taxonomy_node_id: string;
}

interface TreeNode {
  id: string;
  name: string;
  domain: string;
  family: string;
  nodeType: "domain" | "family" | "skill";
  level: number; // skill depth 0-5
  hasEvidence: boolean;
  evidenceCount: number;
  parentId: string | null;
  children: TreeNode[];
  // Layout
  x: number;
  y: number;
  angle: number;
}

// ============================================
// Domain colors
// ============================================

const DOMAIN_COLORS: Record<string, string> = {
  "Cognitive & Intellectual": "#4ecdc4",
  "Technical & Engineering": "#45b7d1",
  "Business & Entrepreneurship": "#f7dc6f",
  "Social & Interpersonal": "#e74c3c",
  "Creative & Artistic": "#bb8fce",
  "Physical & Embodied": "#82e0aa",
  "Self & Inner Development": "#f0b27a",
  "Knowledge Domains": "#85c1e9",
};

function getDomainColor(domain: string): string {
  return DOMAIN_COLORS[domain] || "#888888";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// ============================================
// Radial tree layout
// ============================================

function layoutTree(root: TreeNode): void {
  // Root at center
  root.x = 0;
  root.y = 0;

  const DOMAIN_RADIUS = 220;
  const FAMILY_RADIUS = 450;
  const SKILL_RADIUS_BASE = 650;
  const SKILL_RADIUS_SPREAD = 120;

  // Spread domains evenly around circle
  const domains = root.children;
  const domainAngleStep = (2 * Math.PI) / domains.length;
  // Start from top (-PI/2) and go clockwise
  const startAngle = -Math.PI / 2;

  for (let di = 0; di < domains.length; di++) {
    const domain = domains[di];
    const domainAngle = startAngle + di * domainAngleStep;
    domain.x = Math.cos(domainAngle) * DOMAIN_RADIUS;
    domain.y = Math.sin(domainAngle) * DOMAIN_RADIUS;
    domain.angle = domainAngle;

    // Families fan out from domain
    const families = domain.children;
    if (families.length === 0) continue;

    // Angular spread per domain: proportional to family count
    const familySpread = domainAngleStep * 0.75;
    const familyStart = domainAngle - familySpread / 2;
    const familyStep = families.length > 1 ? familySpread / (families.length - 1) : 0;

    for (let fi = 0; fi < families.length; fi++) {
      const family = families[fi];
      const familyAngle = families.length > 1
        ? familyStart + fi * familyStep
        : domainAngle;
      family.x = Math.cos(familyAngle) * FAMILY_RADIUS;
      family.y = Math.sin(familyAngle) * FAMILY_RADIUS;
      family.angle = familyAngle;

      // Skills fan out from family
      const skills = family.children;
      if (skills.length === 0) continue;

      const skillSpread = familyStep > 0 ? familyStep * 0.8 : domainAngleStep * 0.15;
      const skillStart = familyAngle - skillSpread / 2;
      const skillStep = skills.length > 1 ? skillSpread / (skills.length - 1) : 0;

      for (let si = 0; si < skills.length; si++) {
        const skill = skills[si];
        const skillAngle = skills.length > 1
          ? skillStart + si * skillStep
          : familyAngle;
        // Stagger radius slightly for visual variety
        const radius = SKILL_RADIUS_BASE + (si % 3) * (SKILL_RADIUS_SPREAD / 3);
        skill.x = Math.cos(skillAngle) * radius;
        skill.y = Math.sin(skillAngle) * radius;
        skill.angle = skillAngle;
      }
    }
  }
}

// ============================================
// Build tree from API data
// ============================================

function buildTree(taxonomy: TaxonomyNode[], skills: DevelopedSkill[]): TreeNode {
  // Map developed skills by taxonomy node ID
  const developedMap = new Map<string, DevelopedSkill>();
  for (const s of skills) {
    if (s.taxonomy_node_id) {
      // Keep highest level if multiple skills map to same node
      const existing = developedMap.get(s.taxonomy_node_id);
      if (!existing || s.level > existing.level) {
        developedMap.set(s.taxonomy_node_id, s);
      }
    }
  }

  // Build flat node map
  const nodeMap = new Map<string, TreeNode>();
  for (const t of taxonomy) {
    const developed = developedMap.get(t.id);
    nodeMap.set(t.id, {
      id: t.id,
      name: t.name,
      domain: t.domain,
      family: t.family,
      nodeType: t.type,
      level: developed?.level ?? 0,
      hasEvidence: !!developed,
      evidenceCount: developed?.evidence ?? 0,
      parentId: t.parent_id,
      children: [],
      x: 0,
      y: 0,
      angle: 0,
    });
  }

  // Build hierarchy
  const root: TreeNode = {
    id: "root",
    name: "Homo Universalis",
    domain: "",
    family: "",
    nodeType: "domain",
    level: 0,
    hasEvidence: true,
    evidenceCount: 0,
    parentId: null,
    children: [],
    x: 0,
    y: 0,
    angle: 0,
  };

  for (const node of nodeMap.values()) {
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) parent.children.push(node);
    } else if (node.nodeType === "domain") {
      root.children.push(node);
    }
  }

  // Sort domains consistently
  root.children.sort((a, b) => a.name.localeCompare(b.name));
  // Sort families and skills within each
  for (const domain of root.children) {
    domain.children.sort((a, b) => a.name.localeCompare(b.name));
    for (const family of domain.children) {
      family.children.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  layoutTree(root);
  return root;
}

// ============================================
// Canvas rendering
// ============================================

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

function worldToScreen(wx: number, wy: number, cam: Camera, w: number, h: number): { x: number; y: number } {
  return {
    x: (wx - cam.x) * cam.zoom + w / 2,
    y: (wy - cam.y) * cam.zoom + h / 2,
  };
}

function screenToWorld(sx: number, sy: number, cam: Camera, w: number, h: number): { x: number; y: number } {
  return {
    x: (sx - w / 2) / cam.zoom + cam.x,
    y: (sy - h / 2) / cam.zoom + cam.y,
  };
}

function getAllNodes(root: TreeNode): TreeNode[] {
  const nodes: TreeNode[] = [];
  function walk(n: TreeNode) {
    nodes.push(n);
    for (const c of n.children) walk(c);
  }
  for (const c of root.children) walk(c);
  // Also include root
  nodes.push(root);
  return nodes;
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  root: TreeNode,
  cam: Camera,
  w: number,
  h: number,
  hoveredId: string | null,
  selectedId: string | null,
) {
  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, w, h);

  // Draw edges first (behind nodes)
  drawEdges(ctx, root, cam, w, h, hoveredId, selectedId);

  // Draw nodes
  drawNodes(ctx, root, cam, w, h, hoveredId, selectedId);
}

function drawEdges(
  ctx: CanvasRenderingContext2D,
  root: TreeNode,
  cam: Camera,
  w: number,
  h: number,
  hoveredId: string | null,
  selectedId: string | null,
) {
  function drawEdge(parent: TreeNode, child: TreeNode) {
    const p = worldToScreen(parent.x, parent.y, cam, w, h);
    const c = worldToScreen(child.x, child.y, cam, w, h);

    const domainColor = getDomainColor(child.domain);
    const { r, g, b } = hexToRgb(domainColor);

    const isHighlighted = hoveredId === child.id || hoveredId === parent.id
      || selectedId === child.id || selectedId === parent.id;

    const alpha = isHighlighted ? 0.7 : (child.hasEvidence ? 0.25 : 0.08);
    const width = isHighlighted ? 3 : (child.hasEvidence ? 1.5 : 0.8);

    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.lineWidth = width;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);

    const mx = (p.x + c.x) / 2;
    const my = (p.y + c.y) / 2;
    const centerX = w / 2;
    const centerY = h / 2;
    const pullFactor = 0.15;
    const cpx = mx + (centerX - mx) * pullFactor;
    const cpy = my + (centerY - my) * pullFactor;

    ctx.quadraticCurveTo(cpx, cpy, c.x, c.y);
    ctx.stroke();
  }

  function walk(node: TreeNode) {
    for (const child of node.children) {
      drawEdge(node, child);
      walk(child);
    }
  }

  for (const domain of root.children) {
    drawEdge(root, domain);
    walk(domain);
  }
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  root: TreeNode,
  cam: Camera,
  w: number,
  h: number,
  hoveredId: string | null,
  selectedId: string | null,
) {
  const allNodes = getAllNodes(root);

  const layers = [
    allNodes.filter(n => n.nodeType === "skill" && !n.hasEvidence),
    allNodes.filter(n => n.nodeType === "skill" && n.hasEvidence),
    allNodes.filter(n => n.nodeType === "family"),
    allNodes.filter(n => n.nodeType === "domain"),
    [root],
  ];

  for (const layer of layers) {
    for (const node of layer) {
      drawNode(ctx, node, cam, w, h, hoveredId, selectedId);
    }
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  node: TreeNode,
  cam: Camera,
  w: number,
  h: number,
  hoveredId: string | null,
  selectedId: string | null,
) {
  const pos = worldToScreen(node.x, node.y, cam, w, h);
  const domainColor = getDomainColor(node.domain || "");
  const { r, g, b } = hexToRgb(domainColor || "#888888");

  const isHovered = hoveredId === node.id;
  const isSelected = selectedId === node.id;
  const isActive = isHovered || isSelected;

  // Node sizes (in world units, scaled by zoom)
  let baseRadius: number;
  if (node.id === "root") {
    baseRadius = 18;
  } else if (node.nodeType === "domain") {
    baseRadius = 14;
  } else if (node.nodeType === "family") {
    baseRadius = 9;
  } else if (node.hasEvidence) {
    baseRadius = 5 + node.level * 2;
  } else {
    baseRadius = 4;
  }

  const radius = baseRadius * cam.zoom;

  // --- Draw glow for active/developed nodes ---
  if ((node.hasEvidence || node.nodeType !== "skill") && node.id !== "root") {
    const glowRadius = radius * (isActive ? 3 : 2);
    const gradient = ctx.createRadialGradient(pos.x, pos.y, radius * 0.5, pos.x, pos.y, glowRadius);
    const glowAlpha = isActive ? 0.3 : (node.hasEvidence ? 0.12 : 0.05);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowAlpha})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Draw hexagonal node shape ---
  const sides = node.nodeType === "domain" ? 6 : (node.nodeType === "family" ? 6 : 8);
  const rotation = node.nodeType === "domain" ? Math.PI / 6 : 0;

  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const angle = (i * 2 * Math.PI) / sides + rotation;
    const px = pos.x + Math.cos(angle) * radius;
    const py = pos.y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  if (node.id === "root") {
    // Root: golden center node
    ctx.fillStyle = `rgba(212, 168, 67, ${isActive ? 1 : 0.9})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 234, 184, 0.8)`;
    ctx.lineWidth = 2 * cam.zoom;
    ctx.stroke();
  } else if (node.nodeType === "domain") {
    // Domain: filled with domain color
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isActive ? 1 : 0.85})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`;
    ctx.lineWidth = 1.5 * cam.zoom;
    ctx.stroke();
  } else if (node.nodeType === "family") {
    // Family: semi-filled
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isActive ? 0.7 : 0.35})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isActive ? 0.9 : 0.5})`;
    ctx.lineWidth = 1.5 * cam.zoom;
    ctx.stroke();
  } else if (node.hasEvidence) {
    // Developed skill: bright, filled
    const fillAlpha = 0.3 + (node.level / 5) * 0.6;
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isActive ? 1 : fillAlpha})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isActive ? 1 : 0.8})`;
    ctx.lineWidth = (1 + node.level * 0.3) * cam.zoom;
    ctx.stroke();

    // Inner depth indicator (filled proportion)
    if (node.level > 0) {
      const innerRadius = radius * (node.level / 5) * 0.6;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, innerRadius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.9)`;
      ctx.fill();
    }
  } else {
    // Undiscovered skill: dark, outline only
    ctx.fillStyle = `rgba(20, 20, 30, ${isActive ? 0.8 : 0.5})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${isActive ? 0.4 : 0.12})`;
    ctx.lineWidth = 0.8 * cam.zoom;
    ctx.stroke();
  }

  // --- Labels ---
  const showLabel = cam.zoom > 0.3 && (
    node.id === "root" ||
    node.nodeType === "domain" ||
    (node.nodeType === "family" && cam.zoom > 0.5) ||
    (node.hasEvidence && cam.zoom > 0.7) ||
    isActive
  );

  if (showLabel) {
    const fontSize = node.id === "root" ? 12 :
      node.nodeType === "domain" ? 10 :
      node.nodeType === "family" ? 8.5 : 7.5;

    const scaledSize = fontSize * cam.zoom;
    if (scaledSize < 4) return; // too small to read

    ctx.font = `${node.nodeType === "domain" || node.id === "root" ? "600" : "400"} ${scaledSize}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const labelY = pos.y + radius + 4 * cam.zoom;

    // Text label with truncation
    let label = node.name;
    if (label.length > 22 && cam.zoom < 1.2) {
      label = label.slice(0, 20) + "…";
    }

    // Shadow for readability
    ctx.fillStyle = `rgba(10, 10, 15, 0.85)`;
    ctx.fillText(label, pos.x + 1, labelY + 1);

    // Label color
    if (node.id === "root") {
      ctx.fillStyle = "#ffeab8";
    } else if (node.hasEvidence || node.nodeType !== "skill") {
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${isActive ? 1 : 0.8})`;
    } else {
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
    }
    ctx.fillText(label, pos.x, labelY);

    // Depth badge for developed skills
    if (node.hasEvidence && node.level > 0 && cam.zoom > 0.8) {
      const depthLabel = `L${node.level.toFixed(0)}`;
      const badgeSize = 6 * cam.zoom;
      ctx.font = `600 ${badgeSize}px 'JetBrains Mono', monospace`;
      const badgeY = labelY + scaledSize + 2 * cam.zoom;
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
      ctx.fillText(depthLabel, pos.x, badgeY);
    }
  }
}

// ============================================
// Hit detection
// ============================================

function hitTest(
  wx: number,
  wy: number,
  root: TreeNode,
): TreeNode | null {
  const allNodes = getAllNodes(root);
  let closest: TreeNode | null = null;
  let closestDist = Infinity;

  for (const node of allNodes) {
    const dx = node.x - wx;
    const dy = node.y - wy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let hitRadius: number;
    if (node.id === "root") hitRadius = 20;
    else if (node.nodeType === "domain") hitRadius = 18;
    else if (node.nodeType === "family") hitRadius = 12;
    else hitRadius = 8;

    if (dist < hitRadius && dist < closestDist) {
      closest = node;
      closestDist = dist;
    }
  }

  return closest;
}

// ============================================
// Component
// ============================================

interface SkillMapProps {
  onSelectSkill: (skill: any) => void;
}

export function SkillMap({ onSelectSkill }: SkillMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<TreeNode | null>(null);
  const camRef = useRef<Camera>({ x: 0, y: 0, zoom: 0.7 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const dprRef = useRef(1);

  // Fetch and build tree
  useEffect(() => {
    const fetchData = async () => {
      const [taxonomy, skills] = await Promise.all([
        fetch("/api/taxonomy").then(r => r.json()),
        fetch("/api/skills").then(r => r.json()),
      ]);
      rootRef.current = buildTree(taxonomy, skills);
      requestDraw();
    };
    fetchData().catch(console.error);
  }, []);

  // Draw loop
  const requestDraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      const root = rootRef.current;
      if (!canvas || !root) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Work in CSS pixel space
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;

      drawTree(ctx, root, camRef.current, cssW, cssH, hoveredId, selectedId);
    });
  }, [hoveredId, selectedId]);

  // Redraw on state changes
  useEffect(() => { requestDraw(); }, [requestDraw]);

  // Canvas sizing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      const parent = canvas.parentElement;
      if (!parent) return;
      const cssW = parent.clientWidth;
      const cssH = parent.clientHeight;
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";

      // Scale context so we can draw in CSS pixel coordinates
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      requestDraw();
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [requestDraw]);

  // Mouse interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getCanvasCoords = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const cssW = () => canvas.clientWidth;
    const cssH = () => canvas.clientHeight;

    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        camRef.current.x -= dx / camRef.current.zoom;
        camRef.current.y -= dy / camRef.current.zoom;
        lastMouseRef.current = { x: e.clientX, y: e.clientY };
        requestDraw();
      } else if (rootRef.current) {
        const coords = getCanvasCoords(e);
        const world = screenToWorld(coords.x, coords.y, camRef.current, cssW(), cssH());
        const hit = hitTest(world.x, world.y, rootRef.current);
        const newId = hit?.id || null;
        if (newId !== hoveredId) {
          setHoveredId(newId);
          canvas.style.cursor = hit ? "pointer" : "grab";
        }
      }
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      const coords = getCanvasCoords(e);
      const world = screenToWorld(coords.x, coords.y, camRef.current, cssW(), cssH());
      const hit = hitTest(world.x, world.y, rootRef.current);

      if (hit) {
        setSelectedId(hit.id);
        onSelectSkill({
          id: hit.id,
          name: hit.name,
          domain: hit.domain,
          level: hit.level,
          nodeType: hit.nodeType,
          hasEvidence: hit.hasEvidence,
          evidenceCount: hit.evidenceCount,
        });
      } else {
        setSelectedId(null);
        onSelectSkill(null);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const coords = getCanvasCoords(e);
      const worldBefore = screenToWorld(coords.x, coords.y, camRef.current, cssW(), cssH());

      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      camRef.current.zoom = Math.max(0.15, Math.min(5, camRef.current.zoom * factor));

      const worldAfter = screenToWorld(coords.x, coords.y, camRef.current, cssW(), cssH());
      camRef.current.x -= worldAfter.x - worldBefore.x;
      camRef.current.y -= worldAfter.y - worldBefore.y;

      requestDraw();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        onSelectSkill(null);
      }
      // 'H' to reset view
      if (e.key === "h" || e.key === "H") {
        camRef.current = { x: 0, y: 0, zoom: 0.7 };
        requestDraw();
      }
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hoveredId, requestDraw, onSelectSkill]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }}
    />
  );
}
