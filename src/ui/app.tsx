import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { SkillMap } from "./views/skill-map.tsx";

interface Stats {
  Conversation: number;
  Skill: number;
  Topic: number;
  Project: number;
  Person: number;
  Belief: number;
  Question: number;
}

function getDomainColor(domain: string): string {
  const colors: Record<string, string> = {
    "Cognitive & Intellectual": "#4ecdc4",
    "Technical & Engineering": "#45b7d1",
    "Business & Entrepreneurship": "#f7dc6f",
    "Social & Interpersonal": "#e74c3c",
    "Creative & Artistic": "#bb8fce",
    "Physical & Embodied": "#82e0aa",
    "Self & Inner Development": "#f0b27a",
    "Knowledge Domains": "#85c1e9",
  };
  return colors[domain] || "#888";
}

function DetailPanel({ skill, onClose }: { skill: any; onClose: () => void }) {
  const [detail, setDetail] = useState<any>(null);

  useEffect(() => {
    if (!skill.id) return;
    fetch(`/api/skill/${skill.id}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [skill.id]);

  const depthLabels = ["None", "Awareness", "Exploration", "Application", "Fluency", "Mastery"];
  const depthLevel = Math.round(skill.level || 0);
  const color = getDomainColor(skill.domain);

  return (
    <div className="detail-panel">
      <button className="close-btn" onClick={onClose}>
        &times;
      </button>
      <div className="node-type-badge">{skill.nodeType?.toUpperCase() || "SKILL"}</div>
      <h2 className="skill-name" style={{ color }}>{skill.name}</h2>
      {skill.domain && (
        <div className="domain-badge" style={{ borderColor: color, color }}>
          {skill.domain}
        </div>
      )}
      {skill.hasEvidence && (
        <div className="depth-section">
          <div className="depth-label">
            DEPTH — {depthLabels[depthLevel] || "Unknown"}
          </div>
          <div className="depth-bar">
            <div
              className="depth-fill"
              style={{
                width: `${((skill.level || 0) / 5) * 100}%`,
                background: color,
              }}
            />
          </div>
          <div className="depth-value">
            {(skill.level || 0).toFixed(1)} / 5.0
          </div>
        </div>
      )}
      {!skill.hasEvidence && skill.nodeType === "skill" && (
        <div className="undiscovered-label">
          UNDISCOVERED — No evidence in conversations yet
        </div>
      )}
      {skill.evidenceCount > 0 && (
        <div className="evidence-count">
          {skill.evidenceCount} conversation{skill.evidenceCount !== 1 ? "s" : ""}
        </div>
      )}
      {detail?.evidence && detail.evidence.length > 0 && (
        <div className="evidence-section">
          <div className="section-label">EVIDENCE TRAIL</div>
          <div className="evidence-list">
            {detail.evidence
              .sort((a: any, b: any) => (b.date || "").localeCompare(a.date || ""))
              .map((e: any, i: number) => (
              <div key={i} className="evidence-item">
                <span className="evidence-depth" style={{ color }}>
                  L{e.depth || 0}
                </span>
                <span className="evidence-title">
                  {e.title || "Untitled conversation"}
                </span>
                <span className="evidence-date">{e.date?.slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<any>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <>
      <div className="top-bar">
        <div className="title">ONTOLO</div>
        <div className="stats-bar">
          {stats && (
            <>
              <span>{stats.Skill} SKILLS</span>
              <span>{stats.Conversation} CONVERSATIONS</span>
              <span>{stats.Topic} TOPICS</span>
              <span>{stats.Project} PROJECTS</span>
              <span>{stats.Person} PEOPLE</span>
            </>
          )}
        </div>
      </div>
      <div className="graph-container">
        <SkillMap onSelectSkill={setSelectedSkill} />
      </div>
      {selectedSkill && (
        <DetailPanel
          skill={selectedSkill}
          onClose={() => setSelectedSkill(null)}
        />
      )}
      <div className="key-hints">
        <span><kbd>H</kbd> reset view</span>
        <span><kbd>ESC</kbd> deselect</span>
        <span>scroll to zoom</span>
        <span>drag to pan</span>
      </div>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
