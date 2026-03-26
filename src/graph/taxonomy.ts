/**
 * The Homo Universalis Skill Taxonomy.
 *
 * A complete map of human capability across 8 domains,
 * ~40 skill families, and ~200 leaf skills.
 * This is the scaffold onto which actual skills from
 * conversations get mapped.
 *
 * Structure: Domain → Family → Skill (leaf)
 * Each node gets a SkillNode entry in KuzuDB,
 * connected via CHILD_OF relationships.
 */

export interface TaxonomyNode {
  id: string;
  name: string;
  domain: string;
  family: string;
  taxonomy_path: string;
  description: string;
  node_type: "domain" | "family" | "skill";
  is_leaf: boolean;
  children?: TaxonomyNode[];
}

// ============================================
// Helper to build taxonomy tree
// ============================================

function domain(
  id: string,
  name: string,
  description: string,
  families: TaxonomyNode[]
): TaxonomyNode {
  return {
    id,
    name,
    domain: name,
    family: "",
    taxonomy_path: name,
    description,
    node_type: "domain",
    is_leaf: false,
    children: families,
  };
}

function family(
  domainName: string,
  id: string,
  name: string,
  description: string,
  skills: Array<{ id: string; name: string; desc: string }>
): TaxonomyNode {
  return {
    id,
    name,
    domain: domainName,
    family: name,
    taxonomy_path: `${domainName}/${name}`,
    description,
    node_type: "family",
    is_leaf: false,
    children: skills.map((s) => ({
      id: s.id,
      name: s.name,
      domain: domainName,
      family: name,
      taxonomy_path: `${domainName}/${name}/${s.name}`,
      description: s.desc,
      node_type: "skill" as const,
      is_leaf: true,
    })),
  };
}

// ============================================
// The Full Taxonomy
// ============================================

export const TAXONOMY: TaxonomyNode[] = [
  // ========================================
  // I. COGNITIVE & INTELLECTUAL
  // ========================================
  domain(
    "d_cognitive",
    "Cognitive & Intellectual",
    "The machinery of thought — how you process, analyze, create, and communicate ideas",
    [
      family("Cognitive & Intellectual", "f_systems", "Systems Thinking",
        "Understanding complex interconnected systems", [
          { id: "s_complexity", name: "Complexity & Emergence", desc: "Understanding how complex behaviors arise from simple rules" },
          { id: "s_feedback_loops", name: "Feedback Loops", desc: "Identifying reinforcing and balancing feedback in systems" },
          { id: "s_mental_models", name: "Mental Model Construction", desc: "Building and testing internal representations of how things work" },
          { id: "s_cross_domain_patterns", name: "Cross-Domain Pattern Recognition", desc: "Seeing structural similarities across unrelated fields" },
          { id: "s_second_order", name: "Second-Order Thinking", desc: "Anticipating consequences of consequences" },
        ]
      ),
      family("Cognitive & Intellectual", "f_analytical", "Analytical Reasoning",
        "Breaking down and solving problems with rigor", [
          { id: "s_logical_deduction", name: "Logical Deduction", desc: "Drawing valid conclusions from premises" },
          { id: "s_problem_decomposition", name: "Problem Decomposition", desc: "Breaking complex problems into manageable parts" },
          { id: "s_root_cause", name: "Root Cause Analysis", desc: "Finding the real source of problems, not symptoms" },
          { id: "s_quantitative", name: "Quantitative Reasoning", desc: "Working with numbers, magnitudes, and quantitative arguments" },
          { id: "s_statistical_thinking", name: "Statistical Thinking", desc: "Understanding probability, distributions, and uncertainty" },
          { id: "s_first_principles", name: "First-Principles Thinking", desc: "Reasoning from fundamental truths rather than analogy" },
        ]
      ),
      family("Cognitive & Intellectual", "f_creative", "Creative Thinking",
        "Generating novel ideas and making unexpected connections", [
          { id: "s_divergent", name: "Divergent Ideation", desc: "Generating many possible solutions without judgment" },
          { id: "s_synthesis", name: "Cross-Domain Synthesis", desc: "Combining ideas from different fields into something new" },
          { id: "s_lateral", name: "Lateral Thinking", desc: "Approaching problems from unexpected angles" },
          { id: "s_reframing", name: "Reframing & Perspective Shifts", desc: "Seeing the same situation from fundamentally different viewpoints" },
          { id: "s_aesthetic_judgment", name: "Aesthetic Judgment", desc: "Recognizing and creating beauty, elegance, and taste" },
          { id: "s_imagination", name: "Imagination & Visualization", desc: "Mental simulation and hypothetical scenario building" },
        ]
      ),
      family("Cognitive & Intellectual", "f_learning", "Learning & Meta-cognition",
        "How you learn, and knowing how you learn", [
          { id: "s_learning_speed", name: "Learning Speed & Absorption", desc: "Rapidly acquiring new knowledge and skills" },
          { id: "s_self_directed", name: "Self-Directed Learning", desc: "Charting your own learning path without external structure" },
          { id: "s_knowledge_org", name: "Knowledge Organization", desc: "Structuring information for retrieval and application" },
          { id: "s_learning_from_failure", name: "Learning from Failure", desc: "Extracting maximum insight from mistakes and setbacks" },
          { id: "s_epistemic_humility", name: "Epistemic Humility", desc: "Knowing what you don't know, calibrating confidence" },
          { id: "s_metacognition", name: "Metacognitive Awareness", desc: "Observing and steering your own thinking processes" },
          { id: "s_transfer_learning", name: "Knowledge Transfer", desc: "Applying learnings from one domain to accelerate in another" },
        ]
      ),
      family("Cognitive & Intellectual", "f_communication_ideas", "Communication of Ideas",
        "Making complex ideas accessible and compelling", [
          { id: "s_explaining_complex", name: "Explaining Complex Concepts Simply", desc: "Making hard things understandable without losing nuance" },
          { id: "s_written_argument", name: "Written Argumentation", desc: "Building persuasive, well-structured written arguments" },
          { id: "s_storytelling_ideas", name: "Storytelling for Ideas", desc: "Using narrative to convey abstract concepts" },
          { id: "s_visual_comm", name: "Visual Communication", desc: "Using diagrams, charts, and visuals to explain" },
          { id: "s_multilingual", name: "Multilingual Expression", desc: "Thinking and communicating across languages" },
        ]
      ),
    ]
  ),

  // ========================================
  // II. TECHNICAL & ENGINEERING
  // ========================================
  domain(
    "d_technical",
    "Technical & Engineering",
    "Building things that work — software, hardware, data systems, and AI",
    [
      family("Technical & Engineering", "f_software", "Software Engineering",
        "Designing and building software systems", [
          { id: "s_frontend", name: "Frontend Development", desc: "React, TypeScript, CSS, responsive design, component architecture" },
          { id: "s_backend", name: "Backend Development", desc: "APIs, servers, Node.js, Python, serverless, microservices" },
          { id: "s_architecture", name: "System Architecture", desc: "Designing scalable, maintainable system structures" },
          { id: "s_database_design", name: "Database Design", desc: "Relational, graph, document — schema design and optimization" },
          { id: "s_devops", name: "DevOps & Infrastructure", desc: "CI/CD, deployment, monitoring, cloud platforms" },
          { id: "s_version_control", name: "Version Control & Collaboration", desc: "Git workflows, code review, collaborative development" },
          { id: "s_testing", name: "Testing & Quality", desc: "Unit testing, integration testing, TDD, quality assurance" },
          { id: "s_performance", name: "Performance Optimization", desc: "Profiling, caching, algorithmic optimization" },
          { id: "s_fullstack", name: "Full-Stack Integration", desc: "End-to-end feature delivery across the stack" },
        ]
      ),
      family("Technical & Engineering", "f_ai_ml", "AI & Machine Learning",
        "Building intelligent systems", [
          { id: "s_llm_engineering", name: "LLM Engineering", desc: "Prompt design, RAG, context engineering, model selection" },
          { id: "s_agent_systems", name: "Agent Systems & Orchestration", desc: "Multi-agent architectures, tool calling, planning" },
          { id: "s_rag_systems", name: "RAG Systems", desc: "Retrieval-augmented generation, embedding, vector search" },
          { id: "s_prompt_engineering", name: "Prompt Engineering", desc: "Crafting effective prompts for LLMs" },
          { id: "s_classical_ml", name: "Classical Machine Learning", desc: "Supervised/unsupervised learning, feature engineering" },
          { id: "s_deep_learning", name: "Deep Learning", desc: "Neural networks, transformers, training, fine-tuning" },
          { id: "s_data_pipelines", name: "Data Pipeline Design", desc: "ETL, streaming, batch processing, data quality" },
          { id: "s_mlops", name: "ML Operations & Deployment", desc: "Model serving, monitoring, A/B testing, production ML" },
          { id: "s_ai_safety", name: "AI Safety & Alignment", desc: "Hallucination detection, guardrails, responsible AI" },
          { id: "s_voice_ai", name: "Voice AI & Speech", desc: "STT, TTS, conversational AI, voice interfaces" },
        ]
      ),
      family("Technical & Engineering", "f_data_science", "Data Science & Analytics",
        "Extracting insight from data", [
          { id: "s_statistical_analysis", name: "Statistical Analysis", desc: "Hypothesis testing, regression, Bayesian methods" },
          { id: "s_data_visualization", name: "Data Visualization", desc: "Charts, dashboards, visual storytelling with data" },
          { id: "s_eda", name: "Exploratory Data Analysis", desc: "Investigating datasets to find patterns and anomalies" },
          { id: "s_feature_engineering", name: "Feature Engineering", desc: "Creating meaningful features from raw data" },
          { id: "s_experiment_design", name: "Experiment Design", desc: "A/B testing, causal inference, controlled experiments" },
        ]
      ),
      family("Technical & Engineering", "f_hardware", "Hardware & Electronics",
        "Physical computing and electronic systems", [
          { id: "s_circuit_design", name: "Circuit Design", desc: "Designing electronic circuits and PCBs" },
          { id: "s_embedded", name: "Embedded Systems", desc: "Programming microcontrollers and embedded devices" },
          { id: "s_sensors", name: "Sensor Integration", desc: "Working with sensors, actuators, and physical interfaces" },
          { id: "s_physical_computing", name: "Physical Computing", desc: "Bridging software and physical world" },
          { id: "s_hardware_prototyping", name: "Hardware Prototyping", desc: "Rapid prototyping of physical devices" },
        ]
      ),
      family("Technical & Engineering", "f_design_ux", "Design & UX",
        "Making technology usable and beautiful", [
          { id: "s_ui_design", name: "UI Design", desc: "Visual design of interfaces, layouts, components" },
          { id: "s_ux_thinking", name: "UX Thinking", desc: "User-centered design, usability, user journeys" },
          { id: "s_info_architecture", name: "Information Architecture", desc: "Organizing and structuring information spaces" },
          { id: "s_prototyping", name: "Prototyping", desc: "Rapid creation of functional prototypes" },
          { id: "s_design_systems", name: "Design Systems", desc: "Building consistent, scalable design component libraries" },
        ]
      ),
      family("Technical & Engineering", "f_graph_knowledge", "Graph & Knowledge Engineering",
        "Structuring knowledge as graphs and ontologies", [
          { id: "s_graph_databases", name: "Graph Databases", desc: "KuzuDB, Neo4j, Cypher, property graphs" },
          { id: "s_ontology_design", name: "Ontology Design", desc: "Designing knowledge structures and taxonomies" },
          { id: "s_knowledge_graphs", name: "Knowledge Graph Construction", desc: "Building and querying knowledge graphs" },
          { id: "s_graph_visualization", name: "Graph Visualization", desc: "Force-directed layouts, network rendering" },
        ]
      ),
    ]
  ),

  // ========================================
  // III. BUSINESS & ENTREPRENEURSHIP
  // ========================================
  domain(
    "d_business",
    "Business & Entrepreneurship",
    "Creating, growing, and managing ventures that deliver value",
    [
      family("Business & Entrepreneurship", "f_strategy", "Vision & Strategy",
        "Seeing the big picture and charting a course", [
          { id: "s_opportunity", name: "Opportunity Identification", desc: "Spotting unmet needs and market gaps" },
          { id: "s_market_analysis", name: "Market Analysis", desc: "Understanding markets, segments, and competitive dynamics" },
          { id: "s_business_model", name: "Business Model Design", desc: "Creating sustainable value capture mechanisms" },
          { id: "s_competitive_positioning", name: "Competitive Positioning", desc: "Finding and defending a unique market position" },
          { id: "s_strategic_thinking", name: "Long-term Strategic Thinking", desc: "Planning beyond the immediate horizon" },
          { id: "s_pivot", name: "Pivot & Adaptation", desc: "Recognizing when to change course and executing the shift" },
        ]
      ),
      family("Business & Entrepreneurship", "f_product", "Product Development",
        "Building products people want", [
          { id: "s_pmf", name: "Product-Market Fit Sensing", desc: "Knowing when you've found (or lost) PMF" },
          { id: "s_prioritization", name: "Feature Prioritization", desc: "Deciding what to build next based on impact" },
          { id: "s_user_research", name: "User Research & Empathy", desc: "Deeply understanding user needs and pain points" },
          { id: "s_mvp", name: "MVP Thinking", desc: "Building the smallest thing that tests your hypothesis" },
          { id: "s_product_analytics", name: "Product Analytics", desc: "Using data to understand product usage and health" },
        ]
      ),
      family("Business & Entrepreneurship", "f_financial", "Financial Intelligence",
        "Understanding and managing money", [
          { id: "s_revenue_modeling", name: "Revenue Modeling", desc: "Projecting and analyzing revenue streams" },
          { id: "s_unit_economics", name: "Unit Economics", desc: "Understanding per-unit profitability and margins" },
          { id: "s_fundraising", name: "Fundraising & Investor Relations", desc: "Raising capital and managing investor expectations" },
          { id: "s_cash_flow", name: "Cash Flow Management", desc: "Managing money in and out, runway planning" },
          { id: "s_pricing", name: "Pricing Strategy", desc: "Setting prices that capture value" },
          { id: "s_crypto_defi", name: "Crypto & DeFi", desc: "Blockchain, cryptocurrency, decentralized finance, trading" },
          { id: "s_personal_finance", name: "Personal Finance", desc: "Budgeting, investing, financial planning" },
          { id: "s_accounting_knowledge", name: "Accounting Knowledge", desc: "Understanding financial statements, tax, compliance" },
        ]
      ),
      family("Business & Entrepreneurship", "f_growth", "Growth & Marketing",
        "Getting and keeping customers", [
          { id: "s_growth_hacking", name: "Growth Hacking", desc: "Creative, low-cost strategies for rapid growth" },
          { id: "s_content_strategy", name: "Content Strategy", desc: "Creating content that attracts and converts" },
          { id: "s_community", name: "Community Building", desc: "Building and nurturing user communities" },
          { id: "s_sales", name: "Sales & Closing", desc: "Converting prospects into customers" },
          { id: "s_negotiation", name: "Negotiation", desc: "Reaching favorable agreements through dialogue" },
          { id: "s_brand", name: "Brand Building", desc: "Creating a recognizable, trusted brand identity" },
          { id: "s_network_effects", name: "Network Effects", desc: "Building products that get better with more users" },
        ]
      ),
      family("Business & Entrepreneurship", "f_operations", "Operations & Execution",
        "Making things happen efficiently", [
          { id: "s_project_management", name: "Project Management", desc: "Planning, executing, and delivering projects" },
          { id: "s_team_building", name: "Team Building & Hiring", desc: "Assembling and retaining high-performing teams" },
          { id: "s_process_optimization", name: "Process Optimization", desc: "Making workflows more efficient" },
          { id: "s_legal_regulatory", name: "Legal & Regulatory Navigation", desc: "Understanding and complying with legal requirements" },
          { id: "s_scaling", name: "Scaling Systems", desc: "Growing operations while maintaining quality" },
          { id: "s_ops_research", name: "Operations Research", desc: "Linear optimization, scheduling, resource allocation" },
        ]
      ),
    ]
  ),

  // ========================================
  // IV. SOCIAL & INTERPERSONAL
  // ========================================
  domain(
    "d_social",
    "Social & Interpersonal",
    "Connecting with, understanding, and influencing other people",
    [
      family("Social & Interpersonal", "f_leadership", "Leadership",
        "Guiding and inspiring others toward shared goals", [
          { id: "s_vision_setting", name: "Vision-Setting & Inspiration", desc: "Painting a compelling picture that motivates action" },
          { id: "s_delegation", name: "Delegation & Trust", desc: "Empowering others by giving ownership" },
          { id: "s_decision_uncertainty", name: "Decision-Making Under Uncertainty", desc: "Making good calls with incomplete information" },
          { id: "s_managing_directions", name: "Managing in All Directions", desc: "Leading up, down, and sideways effectively" },
          { id: "s_leading_without_authority", name: "Leading Without Authority", desc: "Influencing without positional power" },
          { id: "s_cofounder_dynamics", name: "Co-founder Dynamics", desc: "Navigating the unique challenges of co-founding" },
        ]
      ),
      family("Social & Interpersonal", "f_communication_social", "Communication",
        "Expressing yourself and being understood", [
          { id: "s_active_listening", name: "Active Listening", desc: "Truly hearing and understanding others" },
          { id: "s_presentation", name: "Presentation & Public Speaking", desc: "Speaking effectively to groups" },
          { id: "s_persuasion", name: "Persuasion & Influence", desc: "Changing minds through argument and appeal" },
          { id: "s_written_comm", name: "Written Communication", desc: "Clear, effective writing for various audiences" },
          { id: "s_cross_cultural", name: "Cross-Cultural Communication", desc: "Communicating effectively across cultures" },
          { id: "s_difficult_conversations", name: "Difficult Conversations", desc: "Navigating sensitive or conflict-laden discussions" },
        ]
      ),
      family("Social & Interpersonal", "f_emotional_intel", "Emotional Intelligence",
        "Understanding and managing emotions — yours and others'", [
          { id: "s_empathy", name: "Empathy & Perspective-Taking", desc: "Feeling and understanding others' experiences" },
          { id: "s_social_awareness", name: "Self-Awareness in Social Context", desc: "Understanding how you come across to others" },
          { id: "s_reading_dynamics", name: "Reading Social Dynamics", desc: "Sensing power structures, alliances, and tensions" },
          { id: "s_emotional_reg_others", name: "Emotional Regulation in Others", desc: "Helping others manage their emotional states" },
          { id: "s_conflict_resolution", name: "Conflict Resolution", desc: "Finding constructive resolutions to disagreements" },
        ]
      ),
      family("Social & Interpersonal", "f_relationships", "Relationships",
        "Building and maintaining meaningful connections", [
          { id: "s_trust_building", name: "Building Trust", desc: "Creating deep, reliable connections over time" },
          { id: "s_networking", name: "Strategic Networking", desc: "Building a valuable professional network intentionally" },
          { id: "s_mentoring", name: "Mentoring & Being Mentored", desc: "Growing through guided relationships" },
          { id: "s_long_term_rel", name: "Maintaining Long-term Relationships", desc: "Keeping connections alive over years" },
          { id: "s_collaboration", name: "Collaboration & Teamwork", desc: "Working effectively with others toward shared goals" },
          { id: "s_romantic", name: "Romantic Relationship Navigation", desc: "Building and maintaining a healthy partnership" },
        ]
      ),
    ]
  ),

  // ========================================
  // V. CREATIVE & ARTISTIC
  // ========================================
  domain(
    "d_creative",
    "Creative & Artistic",
    "Expression, beauty, and the creation of meaning through art",
    [
      family("Creative & Artistic", "f_visual_arts", "Visual Arts",
        "Creating and appreciating visual beauty", [
          { id: "s_painting", name: "Painting & Drawing", desc: "Creating visual art by hand" },
          { id: "s_photography", name: "Photography", desc: "Capturing images with intention and skill" },
          { id: "s_digital_art", name: "Digital Art & Design", desc: "Creating visual art with digital tools" },
          { id: "s_art_appreciation", name: "Art Appreciation & Criticism", desc: "Understanding and evaluating art in context" },
          { id: "s_visual_style", name: "Visual Style & Taste", desc: "Developing and expressing a personal aesthetic" },
        ]
      ),
      family("Creative & Artistic", "f_music", "Music",
        "Creating and experiencing musical expression", [
          { id: "s_instrument", name: "Instrument Proficiency", desc: "Playing one or more instruments" },
          { id: "s_music_theory", name: "Music Theory", desc: "Understanding harmony, rhythm, structure" },
          { id: "s_composition", name: "Composition & Songwriting", desc: "Creating original music" },
          { id: "s_music_appreciation", name: "Music Appreciation", desc: "Deep listening and understanding of music" },
        ]
      ),
      family("Creative & Artistic", "f_writing_creative", "Writing & Storytelling",
        "Creating meaning through words", [
          { id: "s_creative_writing", name: "Creative Writing", desc: "Fiction, poetry, personal essays" },
          { id: "s_technical_writing", name: "Technical Writing", desc: "Documentation, tutorials, clear explanations" },
          { id: "s_journaling", name: "Journaling & Reflection", desc: "Writing as a tool for self-understanding" },
          { id: "s_humor", name: "Humor & Wit", desc: "Making people laugh and seeing absurdity" },
          { id: "s_rhetoric", name: "Rhetoric & Oratory", desc: "The art of persuasive speech and writing" },
        ]
      ),
      family("Creative & Artistic", "f_design_creative", "Creative Design",
        "Shaping the aesthetic dimension of things", [
          { id: "s_graphic_design", name: "Graphic Design", desc: "Visual communication through typography, layout, imagery" },
          { id: "s_industrial_design", name: "Industrial Design", desc: "Designing physical products for function and beauty" },
          { id: "s_spatial_design", name: "Spatial Design", desc: "Architecture, interior design, spatial experience" },
          { id: "s_typography", name: "Typography", desc: "The art of arranging type" },
          { id: "s_color_theory", name: "Color Theory", desc: "Understanding and applying color effectively" },
        ]
      ),
    ]
  ),

  // ========================================
  // VI. PHYSICAL & EMBODIED
  // ========================================
  domain(
    "d_physical",
    "Physical & Embodied",
    "The body as instrument — strength, skill, endurance, and presence",
    [
      family("Physical & Embodied", "f_athletics", "Athletics & Fitness",
        "Physical performance and health", [
          { id: "s_climbing", name: "Rock Climbing", desc: "Bouldering, sport climbing, route reading" },
          { id: "s_endurance", name: "Marathon & Endurance Running", desc: "Long-distance running, pace management" },
          { id: "s_strength", name: "Strength & Conditioning", desc: "Building and maintaining physical strength" },
          { id: "s_flexibility", name: "Flexibility & Mobility", desc: "Range of motion, injury prevention" },
          { id: "s_body_awareness", name: "Body Awareness", desc: "Proprioception, posture, physical self-knowledge" },
          { id: "s_sports_general", name: "General Athletics", desc: "Multi-sport capability and physical literacy" },
        ]
      ),
      family("Physical & Embodied", "f_craftsmanship", "Craftsmanship",
        "Making things with your hands", [
          { id: "s_woodworking", name: "Woodworking", desc: "Building with wood — furniture, objects, structures" },
          { id: "s_cooking", name: "Cooking & Culinary Arts", desc: "Creating food with skill and creativity" },
          { id: "s_manual_dexterity", name: "Manual Dexterity", desc: "Fine motor control and precision handwork" },
          { id: "s_maker_skills", name: "Maker Skills", desc: "3D printing, laser cutting, CNC, general fabrication" },
        ]
      ),
      family("Physical & Embodied", "f_movement", "Movement & Presence",
        "How you move through and occupy space", [
          { id: "s_dance", name: "Dance", desc: "Moving expressively to music or rhythm" },
          { id: "s_martial_arts", name: "Martial Arts", desc: "Discipline, technique, and physical combat skills" },
          { id: "s_yoga", name: "Yoga & Mindful Movement", desc: "Union of breath, movement, and awareness" },
          { id: "s_stage_presence", name: "Stage Presence", desc: "Commanding attention through physical presence" },
        ]
      ),
    ]
  ),

  // ========================================
  // VII. SELF & INNER DEVELOPMENT
  // ========================================
  domain(
    "d_self",
    "Self & Inner Development",
    "The inner game — knowing yourself, steering yourself, becoming yourself",
    [
      family("Self & Inner Development", "f_self_knowledge", "Self-Knowledge",
        "Understanding who you are at the deepest level", [
          { id: "s_values_clarity", name: "Values Clarity", desc: "Knowing what truly matters to you and acting accordingly" },
          { id: "s_motivation_mapping", name: "Motivation Mapping", desc: "Understanding what drives you (intrinsic vs extrinsic)" },
          { id: "s_personality_awareness", name: "Personality Awareness", desc: "Understanding your temperament, tendencies, and patterns" },
          { id: "s_strengths_blind", name: "Strengths & Blind Spots", desc: "Knowing what you're naturally good at and where you're weak" },
          { id: "s_identity_integration", name: "Identity Integration", desc: "Harmonizing different aspects of who you are" },
          { id: "s_shadow_work", name: "Shadow Work", desc: "Confronting and integrating the parts of yourself you'd rather not see" },
        ]
      ),
      family("Self & Inner Development", "f_mental_perf", "Mental Performance",
        "The engine of sustained cognitive output", [
          { id: "s_focus_flow", name: "Focus & Flow States", desc: "Entering and maintaining deep concentration" },
          { id: "s_sustained_concentration", name: "Sustained Concentration", desc: "Maintaining focus over long periods" },
          { id: "s_context_switching", name: "Context Switching", desc: "Moving between tasks without losing momentum" },
          { id: "s_energy_management", name: "Energy Management", desc: "Optimizing when and how you work" },
          { id: "s_cognitive_endurance", name: "Cognitive Endurance", desc: "Thinking hard for extended periods" },
          { id: "s_hyperfocus", name: "Hyperfocus On Demand", desc: "Directing intense focus at will toward specific objectives" },
        ]
      ),
      family("Self & Inner Development", "f_resilience", "Resilience & Growth",
        "Bouncing back and pushing forward", [
          { id: "s_grit", name: "Grit & Persistence", desc: "Continuing despite difficulty, frustration, or slow progress" },
          { id: "s_recovery", name: "Recovery from Setbacks", desc: "Processing failure and returning to action" },
          { id: "s_ambiguity_comfort", name: "Comfort with Ambiguity", desc: "Operating effectively when things are unclear" },
          { id: "s_risk_tolerance", name: "Risk Tolerance Calibration", desc: "Taking appropriate risks, not too cautious or reckless" },
          { id: "s_antifragility", name: "Anti-fragility", desc: "Getting stronger from stress and volatility" },
          { id: "s_growth_mindset", name: "Growth Mindset", desc: "Believing capabilities can be developed through effort" },
        ]
      ),
      family("Self & Inner Development", "f_emotional_self", "Emotional Self-Management",
        "Navigating your inner emotional landscape", [
          { id: "s_stress_regulation", name: "Stress Regulation", desc: "Managing stress without being overwhelmed" },
          { id: "s_impulse_control", name: "Impulse Control", desc: "Acting deliberately rather than reactively" },
          { id: "s_emotional_processing", name: "Emotional Processing", desc: "Working through emotions rather than suppressing them" },
          { id: "s_optimism_calibration", name: "Optimism Calibration", desc: "Maintaining hope without delusion" },
          { id: "s_self_compassion", name: "Self-Compassion", desc: "Being kind to yourself without being soft" },
        ]
      ),
      family("Self & Inner Development", "f_wisdom", "Wisdom & Philosophy",
        "The deepest questions and the search for meaning", [
          { id: "s_ethical_reasoning", name: "Ethical Reasoning", desc: "Thinking through moral dilemmas with rigor and empathy" },
          { id: "s_big_picture", name: "Big-Picture Thinking", desc: "Zooming out to see life in its fullest context" },
          { id: "s_mortality_awareness", name: "Mortality Awareness", desc: "Using finitude as a lens for what matters" },
          { id: "s_meaning_making", name: "Meaning-Making", desc: "Constructing a sense of purpose and significance" },
          { id: "s_intellectual_humility", name: "Intellectual Humility", desc: "Holding strong opinions loosely" },
          { id: "s_philosophical_frameworks", name: "Philosophical Framework Building", desc: "Developing personal philosophies to navigate life" },
        ]
      ),
    ]
  ),

  // ========================================
  // VIII. KNOWLEDGE DOMAINS
  // ========================================
  domain(
    "d_knowledge",
    "Knowledge Domains",
    "Substantive knowledge about the world — what you know, not just how you think",
    [
      family("Knowledge Domains", "f_sciences", "Sciences",
        "Understanding the natural and formal world", [
          { id: "s_mathematics", name: "Mathematics", desc: "Calculus, linear algebra, optimization, number theory" },
          { id: "s_physics", name: "Physics", desc: "Mechanics, thermodynamics, electromagnetism, quantum" },
          { id: "s_biology", name: "Biology", desc: "Life sciences, genetics, ecology, neuroscience" },
          { id: "s_chemistry", name: "Chemistry", desc: "Molecular science, reactions, materials" },
          { id: "s_cs_theory", name: "Computer Science Theory", desc: "Algorithms, complexity, information theory" },
        ]
      ),
      family("Knowledge Domains", "f_humanities", "Humanities",
        "Understanding the human condition through culture and thought", [
          { id: "s_philosophy", name: "Philosophy", desc: "Epistemology, ethics, existentialism, logic" },
          { id: "s_history", name: "History", desc: "Understanding the past to navigate the present" },
          { id: "s_literature", name: "Literature", desc: "Reading and understanding great works" },
          { id: "s_linguistics", name: "Linguistics", desc: "Understanding language structure and evolution" },
          { id: "s_cultural_studies", name: "Cultural Studies", desc: "Understanding cultures, traditions, and cross-cultural dynamics" },
        ]
      ),
      family("Knowledge Domains", "f_social_sciences", "Social Sciences",
        "Understanding human behavior and society", [
          { id: "s_economics", name: "Economics", desc: "Micro, macro, behavioral, game theory" },
          { id: "s_psychology", name: "Psychology", desc: "Cognitive, behavioral, personality, developmental" },
          { id: "s_sociology", name: "Sociology", desc: "Social structures, institutions, and collective behavior" },
          { id: "s_political_science", name: "Political Science", desc: "Power, governance, policy, international relations" },
        ]
      ),
      family("Knowledge Domains", "f_applied", "Applied Knowledge",
        "Specialized domain knowledge for practical application", [
          { id: "s_accounting_tax", name: "Accounting & Tax Regulations", desc: "Belgian/EU accounting, tax compliance, regulatory frameworks" },
          { id: "s_business_law", name: "Business Law", desc: "Corporate law, IP, contracts, regulatory compliance" },
          { id: "s_education_theory", name: "Education Theory", desc: "How learning works, pedagogy, curriculum design" },
          { id: "s_health_wellness", name: "Healthcare & Wellness", desc: "Health science, nutrition, wellness practices" },
        ]
      ),
      family("Knowledge Domains", "f_tech_landscape", "Technology Landscape",
        "Understanding the broader technology ecosystem", [
          { id: "s_cloud_platforms", name: "Cloud Platforms & Infrastructure", desc: "AWS, GCP, Azure, serverless, containers" },
          { id: "s_blockchain", name: "Blockchain & Web3", desc: "Distributed ledgers, smart contracts, DeFi protocols" },
          { id: "s_robotics", name: "Robotics & Automation", desc: "Autonomous systems, RPA, industrial automation" },
          { id: "s_quantum", name: "Quantum Computing", desc: "Quantum algorithms, hardware, applications" },
          { id: "s_biotech", name: "Biotech & Computational Biology", desc: "Bioinformatics, drug discovery, synthetic biology" },
        ]
      ),
    ]
  ),
];

// ============================================
// Flatten taxonomy into insertable records
// ============================================

export interface FlatSkillNode {
  id: string;
  name: string;
  domain: string;
  family: string;
  taxonomy_path: string;
  description: string;
  node_type: string;
  is_leaf: boolean;
  parent_id: string | null;
}

/**
 * Flatten the taxonomy tree into a list of nodes with parent references.
 */
export function flattenTaxonomy(
  nodes: TaxonomyNode[] = TAXONOMY,
  parentId: string | null = null
): FlatSkillNode[] {
  const result: FlatSkillNode[] = [];

  for (const node of nodes) {
    result.push({
      id: node.id,
      name: node.name,
      domain: node.domain,
      family: node.family,
      taxonomy_path: node.taxonomy_path,
      description: node.description,
      node_type: node.node_type,
      is_leaf: node.is_leaf,
      parent_id: parentId,
    });

    if (node.children) {
      result.push(...flattenTaxonomy(node.children, node.id));
    }
  }

  return result;
}

/**
 * Get statistics about the taxonomy.
 */
export function taxonomyStats(): {
  domains: number;
  families: number;
  skills: number;
  total: number;
} {
  const flat = flattenTaxonomy();
  return {
    domains: flat.filter((n) => n.node_type === "domain").length,
    families: flat.filter((n) => n.node_type === "family").length,
    skills: flat.filter((n) => n.node_type === "skill").length,
    total: flat.length,
  };
}
