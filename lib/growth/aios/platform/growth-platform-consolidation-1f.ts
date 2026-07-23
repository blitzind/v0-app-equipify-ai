/** AVA-GROWTH-OPERATOR-1F — Platform consolidation registry (client-safe). */

export const GROWTH_AIOS_GROWTH_OPERATOR_1F_QA_MARKER =
  "ava-growth-operator-1f-platform-consolidation-v1" as const

export const GROWTH_PLATFORM_CONSOLIDATION_RULE =
  "One constitutional model, one decision authority, one escalation authority, one executive experience, one growth intelligence layer — no competing operator paths." as const

/** Canonical authority modules — sole per-opportunity execution authority. */
export const GROWTH_PLATFORM_CANONICAL_AUTHORITY_MODULES = [
  "lib/growth/aios/authority/growth-canonical-opportunity-authority-1b.ts",
  "lib/growth/work-manager/bridges/canonical-authority-work-manager-bridge-1b.ts",
  "lib/growth/aios/growth/growth-revenue-operator-canonical-binding-1b.ts",
  "lib/growth/aios/authority/growth-recommendation-authority-gate-1b.ts",
] as const

/** Canonical escalation modules — sole operator interrupt deferral. */
export const GROWTH_PLATFORM_CANONICAL_ESCALATION_MODULES = [
  "lib/growth/aios/authority/growth-canonical-escalation-authority-1c.ts",
  "lib/growth/aios/authority/growth-constitutional-portfolio-escalation-1c.ts",
  "lib/growth/aios/authority/growth-canonical-portfolio-authority-hydration-server-1c.ts",
  "lib/growth/aios/approvals/growth-hac-escalation-gate-1f.ts",
] as const

/** Executive experience modules — operator-facing presentation. */
export const GROWTH_PLATFORM_EXECUTIVE_EXPERIENCE_MODULES = [
  "lib/growth/aios/operator-experience/growth-executive-experience-1d.ts",
  "lib/growth/workspace/ux-1d/review/growth-executive-approval-package-1d.ts",
  "lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-synthesizer-1e.ts",
] as const

/** Advisory-only systems — must not compete on bound leads. */
export const GROWTH_PLATFORM_ADVISORY_ONLY_SYSTEMS = [
  "meta_recommender",
  "revenue_operator_unbound",
  "closed_loop_learning",
  "market_intelligence",
  "institutional_learning",
  "legacy_next_best_action",
] as const

/** Intentionally retained parallel systems with documented scope. */
export const GROWTH_PLATFORM_INTENTIONALLY_RETAINED = [
  {
    id: "decision_engine_10b",
    scope: "Candidate ranking for Work Manager — overridden by canonical authority map when hydrated",
  },
  {
    id: "meta_recommender",
    scope: "Portfolio/system advisory recommendations — suppressed for authoritative lead IDs",
  },
  {
    id: "executive_brain",
    scope: "Mission-level work orders — not per-opportunity execution authority",
  },
  {
    id: "adaptive_calibration_apply",
    scope: "Operator-gated config overlay mutation only",
  },
  {
    id: "resource_allocation_facade",
    scope: "Investment authorization — not operator interrupt surface",
  },
] as const

/** R8 — Subsystem deferral audit: every operator-facing Growth subsystem and its canonical authority binding. */
export const GROWTH_PLATFORM_SUBSYSTEM_DEFERRAL_AUDIT = [
  {
    subsystem: "canonical_decision_engine_1a_1b",
    role: "constitutional_per_opportunity_authority",
    defersTo: ["canonical_decision_engine_1a"],
    exception: null,
  },
  {
    subsystem: "work_manager_11a",
    role: "execution_ranking_and_dispatch",
    defersTo: ["canonical_decision_engine_1a", "canonical_escalation_1c"],
    exception: "10B ranking retained; authority map overrides when hydrated",
  },
  {
    subsystem: "revenue_operator_orchestration",
    role: "agent_handoff_supervision",
    defersTo: ["canonical_decision_engine_1a"],
    exception: "Unbound leads use RO next-action until authority resolves",
  },
  {
    subsystem: "meta_recommender",
    role: "portfolio_system_advisory",
    defersTo: ["canonical_decision_engine_1a", "recommendation_authority_gate_1b"],
    exception: "System-scope recommendations outside bound lead IDs",
  },
  {
    subsystem: "human_approval_center",
    role: "operator_interrupt_aggregation",
    defersTo: ["canonical_escalation_1c"],
    exception: "Transport/outbound approvals always escalate (E1)",
  },
  {
    subsystem: "home_recommendation_queue",
    role: "executive_recommendation_presentation",
    defersTo: ["canonical_decision_engine_1a", "canonical_escalation_1c", "executive_experience_1d"],
    exception: null,
  },
  {
    subsystem: "growth_intelligence_1e",
    role: "strategic_recommendation_synthesis",
    defersTo: ["growth_intelligence_governance_1e"],
    exception: "Recommendation-only — never auto-mutates config",
  },
  {
    subsystem: "executive_brain",
    role: "mission_level_work_orders",
    defersTo: ["canonical_decision_engine_1a"],
    exception: "Mission scope — not per-opportunity execution",
  },
  {
    subsystem: "outbound_transport",
    role: "send_safety_gate",
    defersTo: ["canonical_escalation_1c", "human_approved_transport"],
    exception: "Always requires operator approval for send — constitutional protection",
  },
  {
    subsystem: "adaptive_calibration",
    role: "config_overlay_proposals",
    defersTo: ["canonical_escalation_1c"],
    exception: "Apply path requires explicit operator approval (E10)",
  },
  {
    subsystem: "operations_center",
    role: "internal_ops_diagnostic_view",
    defersTo: ["canonical_decision_engine_1a"],
    exception: "Deferred — WM without full authority map; not primary operator surface",
  },
  {
    subsystem: "legacy_ownership_briefing_synthesizers",
    role: "legacy_copy_fallback",
    defersTo: ["canonical_decision_engine_1a"],
    exception: "Deferred — canonical Home hero path is production default",
  },
] as const

/** R9 — Patterns certified as Fuzor OS reference architecture. */
export const GROWTH_FUZOR_OS_REFERENCE_PATTERNS = [
  "constitutional_operating_model",
  "decision_authority",
  "escalation_authority",
  "executive_experience",
  "growth_intelligence",
  "continuous_optimization",
  "production_governance",
] as const

/** Components recommended for promotion from Equipify to Fuzor OS platform. */
export const GROWTH_FUZOR_OS_PROMOTION_CANDIDATES = [
  {
    id: "worker_authority_framework",
    equipifyModules: [
      "lib/growth/aios/authority/growth-canonical-opportunity-authority-1b.ts",
      "lib/growth/aios/authority/growth-canonical-escalation-authority-1c.ts",
      "lib/growth/aios/authority/growth-canonical-portfolio-authority-hydration-server-1c.ts",
    ],
    fuzorOsTarget: "@fuzor-os/worker-authority",
  },
  {
    id: "executive_experience_layer",
    equipifyModules: [
      "lib/growth/aios/operator-experience/growth-executive-experience-1d.ts",
    ],
    fuzorOsTarget: "@fuzor-os/executive-experience",
  },
  {
    id: "escalation_gate_pattern",
    equipifyModules: [
      "lib/growth/aios/approvals/growth-hac-escalation-gate-1f.ts",
    ],
    fuzorOsTarget: "@fuzor-os/worker-escalation-gate",
  },
  {
    id: "recommendation_governance",
    equipifyModules: [
      "lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-governance-1e.ts",
      "lib/growth/aios/authority/growth-recommendation-authority-gate-1b.ts",
    ],
    fuzorOsTarget: "@fuzor-os/worker-intelligence-governance",
  },
  {
    id: "consolidation_registry",
    equipifyModules: [
      "lib/growth/aios/platform/growth-platform-consolidation-1f.ts",
    ],
    fuzorOsTarget: "@fuzor-os/worker-platform-registry",
  },
] as const
