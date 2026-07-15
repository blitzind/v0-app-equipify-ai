/**
 * GE-AIOS-RUNTIME-OPTIMIZATION-AUDIT-1A — Read-only runtime optimization audit registry.
 * Architectural audit only — no runtime behavior changes.
 */

export const GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_QA_MARKER =
  "ge-aios-runtime-optimization-audit-1a-v1" as const

export const GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_RUNTIME_RULE =
  "read-only architectural audit — no optimizations, caches, projections, or persistence changes" as const

export type GrowthRuntimeOptimizationAuditVerdict =
  | "READY_FOR_RUNTIME_OPTIMIZATION"
  | "ALREADY_OPTIMIZED"
  | "BLOCKED_BY_DUPLICATE_RESOLUTION"
  | "BLOCKED_BY_N_PLUS_ONE"
  | "BLOCKED_BY_UNBOUNDED_RESOLUTION"
  | "BLOCKED_BY_SCHEDULER_ARCHITECTURE"

export type GrowthRuntimeResolverCostTier = "very_high" | "high" | "medium" | "low" | "negligible"

export type GrowthRuntimeResolverInventoryEntry = {
  id: string
  label: string
  costTier: GrowthRuntimeResolverCostTier
  modulePath: string
  approximateDbReads: string
  aiCalls: string
  downstreamResolvers: string[]
  cacheUse: string
  projectionsReused: string[]
  operatorVisibilityRequired: boolean
  canRunWithoutOperator: boolean
}

export type GrowthRuntimeEntryPoint = {
  id: string
  label: string
  entryPath: string
  resolverChain: string[]
  database: string[]
  ai: string[]
  output: string
}

export type GrowthRuntimeDuplicateResolutionEntry = {
  subsystem: string
  sameRequest: "once" | "twice" | "n_times"
  samePage: "once" | "twice" | "n_times"
  sameSchedulerTick: "once" | "twice" | "n_times"
  sameAccountOpen: "once" | "twice" | "n_times"
  sameHomeLoad: "once" | "twice" | "n_times"
  sameApprovalLoad: "once" | "twice" | "n_times"
  notes: string
}

export type GrowthRuntimeProjectionSurface = {
  surface: string
  requiresFullResolver: boolean
  existingProjection: string | null
  cachedSummary: string | null
  verdict: "full_resolver" | "existing_projection" | "cached_summary" | "mixed"
}

export type GrowthRuntimeLazyLoadingViolation = {
  surface: string
  expected: string
  actual: string
  severity: "critical" | "high" | "medium" | "low"
}

export type GrowthRuntimeCacheInventoryEntry = {
  name: string
  modulePath: string
  ttl: string
  scope: string
  reuse: string
  invalidations: string
  status: "active" | "underutilized" | "duplicate" | "unused" | "missing_opportunity"
}

export type GrowthRuntimeOptimizationOpportunity = {
  id: string
  title: string
  roi: "highest" | "medium" | "low"
  complexity: "low" | "medium" | "high"
  risk: "low" | "medium" | "high"
  latencySavings: string
  databaseSavings: string
  aiSavings: string
  scalabilityImprovement: string
}

export type GrowthRuntimeScaleBottleneck = {
  accountCount: 100 | 1_000 | 10_000 | 100_000
  firstBottleneck: string
  symptoms: string[]
}

/** Expensive resolver inventory (Phase 1). */
export const GROWTH_RUNTIME_EXPENSIVE_RESOLVER_INVENTORY: GrowthRuntimeResolverInventoryEntry[] = [
  {
    id: "decision_engine",
    label: "Canonical Decision Engine",
    costTier: "very_high",
    modulePath: "lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead.ts",
    approximateDbReads: "8–14 per lead (lead, package, memory, email, meetings×8, replies×3, committee, closure, enrollment)",
    aiCalls: "None — deterministic rule engine",
    downstreamResolvers: ["memory_resolver", "outreach_package", "buying_committee", "relationship_strategy"],
    cacheUse: "In-process 30s TTL, scope-keyed (256 max)",
    projectionsReused: ["operator_card", "suppression_hints", "freshness"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "memory_resolver",
    label: "Canonical Human Memory Resolver",
    costTier: "very_high",
    modulePath: "lib/growth/lead-memory/resolve-canonical-human-memory-for-lead.ts",
    approximateDbReads: "10–12 parallel + institutional learning org read",
    aiCalls: "None",
    downstreamResolvers: ["outreach_package", "buying_committee", "institutional_learning", "learning_weights"],
    cacheUse: "None",
    projectionsReused: ["memory_profile_view", "account_narrative_slices"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "revenue_strategy",
    label: "Revenue Strategy Intelligence",
    costTier: "high",
    modulePath: "lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence.ts",
    approximateDbReads: "Embedded in 5F package build",
    aiCalls: "None",
    downstreamResolvers: ["conversation_intelligence", "relationship_strategy"],
    cacheUse: "Persisted in outreach package",
    projectionsReused: ["sales_strategy_brief"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "relationship_strategy",
    label: "Relationship Strategy 2A",
    costTier: "high",
    modulePath: "lib/growth/aios/growth/growth-relationship-strategy-2a.ts",
    approximateDbReads: "Consumed via decision/memory inputs",
    aiCalls: "None",
    downstreamResolvers: ["adaptive_loop"],
    cacheUse: "Embedded in canonical decision cache",
    projectionsReused: ["relationship_assessment"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "conversation_intelligence",
    label: "Conversation Intelligence",
    costTier: "medium",
    modulePath: "lib/growth/aios/growth/growth-outreach-conversation-intelligence.ts",
    approximateDbReads: "Lead conversation columns + reply history",
    aiCalls: "None",
    downstreamResolvers: [],
    cacheUse: "Persisted on growth.leads",
    projectionsReused: ["conversation_dashboard"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "meeting_intelligence",
    label: "Meeting Intelligence / Prep",
    costTier: "high",
    modulePath: "lib/growth/meeting-intelligence/meeting-prep-context.ts",
    approximateDbReads: "Memory + decision + research per meeting",
    aiCalls: "None at prep time (deterministic synthesis)",
    downstreamResolvers: ["memory_resolver", "decision_engine"],
    cacheUse: "ai_meeting_preparations draft reuse",
    projectionsReused: ["canonical_meeting_brief"],
    operatorVisibilityRequired: true,
    canRunWithoutOperator: false,
  },
  {
    id: "institutional_learning",
    label: "Institutional Learning 1A/1B",
    costTier: "medium",
    modulePath: "lib/growth/aios/growth/growth-institutional-learning-1a-resolver.ts",
    approximateDbReads: "Org-level closed-loop learning read model",
    aiCalls: "None",
    downstreamResolvers: [],
    cacheUse: "None — recomputed per memory resolve",
    projectionsReused: ["institutional_advice_snippets"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "buying_committee",
    label: "Buying Committee Intelligence",
    costTier: "high",
    modulePath: "lib/growth/buying-committee-intelligence/",
    approximateDbReads: "Rollup + operator status (duplicated in memory + decision)",
    aiCalls: "None",
    downstreamResolvers: [],
    cacheUse: "None",
    projectionsReused: ["committee_snapshot"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "growth_5f",
    label: "Growth 5F Autonomous Outreach Package",
    costTier: "very_high",
    modulePath: "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
    approximateDbReads: "Decision gate + memory + conversation + relationship + institutional",
    aiCalls: "None at build; LLM at transport/send",
    downstreamResolvers: ["decision_engine", "memory_resolver", "conversation_intelligence", "relationship_strategy"],
    cacheUse: "Persisted approval packages; decision cache scope growth5f:*",
    projectionsReused: ["approval_package", "send_plane_materialization"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "draft_factory",
    label: "Draft Factory Live Advancement",
    costTier: "high",
    modulePath: "lib/growth/draft-factory/draft-factory-durable-live.ts",
    approximateDbReads: "Lead + evidence + resource allocation per candidate",
    aiCalls: "None on advance; G5F on capacity wake",
    downstreamResolvers: ["decision_engine", "canonical_evidence"],
    cacheUse: "Decision cache scope draft-factory:advance",
    projectionsReused: ["draft_factory_state"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "reply_intelligence",
    label: "Reply Intelligence Pipeline",
    costTier: "medium",
    modulePath: "lib/growth/reply-intelligence/process-reply-intelligence.ts",
    approximateDbReads: "Reply + lead + memory (webhook path)",
    aiCalls: "Ingestion: none; draft creation: optional LLM",
    downstreamResolvers: ["memory_resolver", "decision_engine (uncached)"],
    cacheUse: "Invalidates decision cache on finalize",
    projectionsReused: ["reply_classification"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "call_workspace",
    label: "Call Workspace Reasoning",
    costTier: "high",
    modulePath: "lib/growth/operator-assist/call-workspace-aios-live-reasoning-service.ts",
    approximateDbReads: "Memory bundle per live session",
    aiCalls: "Live coaching optional LLM; objection/summary on user action",
    downstreamResolvers: ["memory_resolver"],
    cacheUse: "Post-call closure persisted",
    projectionsReused: ["call_copilot_briefing"],
    operatorVisibilityRequired: true,
    canRunWithoutOperator: false,
  },
  {
    id: "mission_projection",
    label: "Mission Orchestration Projection",
    costTier: "low",
    modulePath: "lib/growth/aios/missions/growth-canonical-mission-1a.ts",
    approximateDbReads: "HAC snapshot only on Home",
    aiCalls: "None",
    downstreamResolvers: [],
    cacheUse: "None — pure projection",
    projectionsReused: ["canonical_active_missions"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "operator_narrative",
    label: "Operator Account Narrative",
    costTier: "low",
    modulePath: "lib/growth/aios/operator-experience/growth-canonical-operator-account-narrative-1a.ts",
    approximateDbReads: "Consumes memory bundle slices",
    aiCalls: "None",
    downstreamResolvers: ["memory_resolver"],
    cacheUse: "None",
    projectionsReused: ["what_happened"],
    operatorVisibilityRequired: true,
    canRunWithoutOperator: false,
  },
  {
    id: "revenue_queue",
    label: "Revenue Queue Card Projection",
    costTier: "negligible",
    modulePath: "lib/growth/revenue-queue/revenue-queue-card-projection.ts",
    approximateDbReads: "None — lead row already loaded",
    aiCalls: "None",
    downstreamResolvers: [],
    cacheUse: "None",
    projectionsReused: ["navigation_card"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "home_summary",
    label: "Home Workspace Summary Orchestrator",
    costTier: "very_high",
    modulePath: "lib/growth/home/growth-home-workspace-summary-service.ts",
    approximateDbReads: "30+ paths including command center, DRQ, dashboards",
    aiCalls: "None at load",
    downstreamResolvers: ["daily_work_queue", "command_center", "hero_decision", "mission_discovery"],
    cacheUse: "Loader budget 2.5s timeouts; hero decision 30s cache",
    projectionsReused: ["revenue_queue_cards", "missions", "operator_focus"],
    operatorVisibilityRequired: true,
    canRunWithoutOperator: false,
  },
  {
    id: "executive_briefing",
    label: "Executive Briefing Synthesis",
    costTier: "medium",
    modulePath: "lib/growth/workspace/executive-briefing/growth-home-executive-briefing-synthesizer.ts",
    approximateDbReads: "Consumes workspace summary outputs",
    aiCalls: "None — deterministic synthesis",
    downstreamResolvers: [],
    cacheUse: "None",
    projectionsReused: ["executive_briefing_view"],
    operatorVisibilityRequired: true,
    canRunWithoutOperator: false,
  },
  {
    id: "command_center",
    label: "AI OS Command Center Read Model",
    costTier: "very_high",
    modulePath: "lib/growth/aios/ai-os-command-center-service.ts",
    approximateDbReads: "30+ sequential repository reads",
    aiCalls: "None at read time",
    downstreamResolvers: ["6 autonomous pilots", "HAC", "closed_loop_learning"],
    cacheUse: "None",
    projectionsReused: ["operations_dashboard", "daily_briefing"],
    operatorVisibilityRequired: false,
    canRunWithoutOperator: true,
  },
  {
    id: "daily_work_queue",
    label: "Daily Revenue Work Queue (IRE per lead)",
    costTier: "high",
    modulePath: "lib/growth/daily-work-queue/daily-revenue-work-queue-resolver.ts",
    approximateDbReads: "Up to 250× IRE bundle + 250× learning query (500 rows each)",
    aiCalls: "None",
    downstreamResolvers: ["lead_communication_strategy_bundle"],
    cacheUse: "None",
    projectionsReused: ["daily_work_queue_display"],
    operatorVisibilityRequired: true,
    canRunWithoutOperator: false,
  },
]

/** Runtime entry points (Phase 2). */
export const GROWTH_RUNTIME_ENTRY_POINTS: GrowthRuntimeEntryPoint[] = [
  {
    id: "home",
    label: "Home",
    entryPath: "app/api/platform/growth/home/workspace-summary/route.ts → buildGrowthHomeWorkspaceSummary",
    resolverChain: [
      "fetchGrowthHomeLeadPoolPage(250)",
      "buildRevenueQueueDashboardSectionsFromLeads (pure)",
      "fetchDailyRevenueWorkQueueFromLeads → resolveDailyRevenueWorkQueueForLeads (250× seq)",
      "9 parallel dashboard loaders",
      "buildGrowthHomeSalesOutcomes",
      "enrichRelationshipLeadSnapshotsBatch",
      "loadGrowthHomeMissionDiscoverySnapshot(50)",
      "loadCanonicalOperatorApprovalSnapshot → fetchAiOsCommandCenterReadModel",
      "resolveGrowthCanonicalDecisionForLeadCached (hero only)",
    ],
    database: ["growth.leads", "suppression_entries", "objectives", "30+ AI OS tables", "HAC sources"],
    ai: [],
    output: "GrowthHomeWorkspaceSummaryPayload",
  },
  {
    id: "revenue_queue",
    label: "Revenue Queue",
    entryPath: "Embedded in Home summary — buildRevenueQueueDashboardSectionsFromLeads",
    resolverChain: ["buildRevenueQueueCardProjectionFromLead × N"],
    database: [],
    ai: [],
    output: "Navigation-only queue sections",
  },
  {
    id: "lead_workspace",
    label: "Lead Workspace",
    entryPath: "loadRevenueQueueOperatorWorkspace → buildLeadOperatorWorkspacePayloadFromGrowthLead",
    resolverChain: [
      "resolveGrowthCanonicalDecisionForLeadCached",
      "resolveCanonicalHumanMemoryForLead",
      "intent/search/buying/company repos",
      "buildRevenueQueueCardProjectionFromLead",
    ],
    database: ["lead", "intent", "search", "buying stage", "company ID", "full decision+memory stack"],
    ai: [],
    output: "LeadOperatorWorkspacePayload",
  },
  {
    id: "meeting_workspace",
    label: "Meeting Workspace",
    entryPath: "POST ai-meeting-prep/generate → generateAndPersistAiMeetingPrep",
    resolverChain: ["buildMeetingPrepContextBundle", "resolveCanonicalHumanMemoryForLead", "resolveGrowthCanonicalDecisionForLeadCached", "ai-meeting-prep-generator"],
    database: ["meetings", "research", "memory", "decision"],
    ai: [],
    output: "ai_meeting_preparations row",
  },
  {
    id: "call_workspace",
    label: "Call Workspace",
    entryPath: "buildGrowthCallCopilotBriefing → run-call-copilot-session",
    resolverChain: ["memory", "decision", "channel content", "mission projection"],
    database: ["15–25 reads per session"],
    ai: ["objection/summary on user action", "optional live coach LLM"],
    output: "CallCopilotBriefing",
  },
  {
    id: "completed_work",
    label: "Completed Work",
    entryPath: "HAC loader → fetchCompletedWorkLeadLifecycleMap",
    resolverChain: ["filterActiveCompletedWorkItems"],
    database: ["lifecycle map"],
    ai: [],
    output: "Filtered HAC items",
  },
  {
    id: "human_approval_center",
    label: "Human Approval Center",
    entryPath: "loadCanonicalOperatorApprovalSnapshot / approvals-operator-review-service",
    resolverChain: ["command center", "HAC bounded fetch", "buildCanonicalOperatorApprovalSnapshot"],
    database: ["approval inbox", "sequence jobs", "outbound sessions"],
    ai: [],
    output: "CanonicalOperatorApprovalSnapshot",
  },
  {
    id: "reply_processing",
    label: "Reply Processing",
    entryPath: "processReplyIntelligence (webhook/inbox)",
    resolverChain: ["classify", "memory", "resolveGrowthCanonicalDecisionForLead (uncached)", "meeting intelligence"],
    database: ["replies", "leads", "memory"],
    ai: ["optional draft LLM"],
    output: "Reply routing + cache invalidation",
  },
  {
    id: "scheduler",
    label: "Objective Runtime Scheduler",
    entryPath: "runGrowthObjectiveRuntimeScheduler",
    resolverChain: [
      "listActiveRunningGrowthObjectives (all)",
      "tickAutonomousSalesLoopForScheduler → buildGrowthHomeWorkspaceSummary per org",
      "tickDraftFactoryDueStatesForScheduler",
      "selectSchedulerObjectives(50) → objective ticks + mission orchestration",
    ],
    database: ["all active objectives", "draft factory states", "full home per org"],
    ai: [],
    output: "Scheduler tick result",
  },
  {
    id: "draft_factory",
    label: "Draft Factory",
    entryPath: "tickDraftFactoryDueStatesForScheduler",
    resolverChain: ["listDueDraftFactoryStates(100)", "projectInvestmentForDueLead", "advanceDraftFactoryForLeadLive", "capacity wake → G5F"],
    database: ["draft states", "leads", "evidence"],
    ai: ["G5F capacity wake only"],
    output: "Advanced draft states + packages",
  },
  {
    id: "transport",
    label: "Transport / Sequences",
    entryPath: "transport-orchestrator / sequence scheduler",
    resolverChain: ["resolveGrowthCanonicalDecisionForLeadCached (transport scope)", "runGrowthAiCopilotGeneration or send-plane bypass"],
    database: ["sequence jobs", "packages"],
    ai: ["email steps when canonical miss"],
    output: "Transported message",
  },
  {
    id: "adaptive_loop",
    label: "Adaptive Loop",
    entryPath: "growth-adaptive-loop-1a (embedded in decision/5F)",
    resolverChain: ["detectAdaptiveStrategyChanges"],
    database: ["adaptive events"],
    ai: [],
    output: "Strategy evolution signals",
  },
]

/** Duplicate resolution matrix (Phase 3). */
export const GROWTH_RUNTIME_DUPLICATE_RESOLUTION_MATRIX: GrowthRuntimeDuplicateResolutionEntry[] = [
  {
    subsystem: "Decision Engine",
    sameRequest: "twice",
    samePage: "twice",
    sameSchedulerTick: "n_times",
    sameAccountOpen: "once",
    sameHomeLoad: "once",
    sameApprovalLoad: "twice",
    notes: "Hero cached once on Home; approval review resolves again; DF/G5F use separate cacheScope keys",
  },
  {
    subsystem: "Memory Resolver",
    sameRequest: "twice",
    samePage: "twice",
    sameSchedulerTick: "n_times",
    sameAccountOpen: "once",
    sameHomeLoad: "n_times",
    sameApprovalLoad: "twice",
    notes: "No cache; embedded in every decision miss + G5F package build + approval review",
  },
  {
    subsystem: "Institutional Learning",
    sameRequest: "once",
    samePage: "once",
    sameSchedulerTick: "n_times",
    sameAccountOpen: "once",
    sameHomeLoad: "n_times",
    sameApprovalLoad: "once",
    notes: "Org read inside every memory resolve; DRQ repeats closed-loop learning up to 250× on Home",
  },
  {
    subsystem: "Buying Committee",
    sameRequest: "twice",
    samePage: "twice",
    sameSchedulerTick: "n_times",
    sameAccountOpen: "twice",
    sameHomeLoad: "n_times",
    sameApprovalLoad: "twice",
    notes: "Loaded in memory resolver and decision resolver independently",
  },
  {
    subsystem: "Growth 5F",
    sameRequest: "twice",
    samePage: "once",
    sameSchedulerTick: "n_times",
    sameAccountOpen: "once",
    sameHomeLoad: "once",
    sameApprovalLoad: "once",
    notes: "Package persisted; rebuild uses growth5f:operator-rebuild scope",
  },
  {
    subsystem: "Relationship Strategy",
    sameRequest: "once",
    samePage: "once",
    sameSchedulerTick: "n_times",
    sameAccountOpen: "once",
    sameHomeLoad: "n_times",
    sameApprovalLoad: "once",
    notes: "Embedded in decision input; not separately cached",
  },
  {
    subsystem: "Conversation Intelligence",
    sameRequest: "once",
    samePage: "once",
    sameSchedulerTick: "once",
    sameAccountOpen: "once",
    sameHomeLoad: "once",
    sameApprovalLoad: "once",
    notes: "Persisted on lead; dashboard reads columns",
  },
  {
    subsystem: "Meeting Brief",
    sameRequest: "twice",
    samePage: "twice",
    sameSchedulerTick: "once",
    sameAccountOpen: "twice",
    sameHomeLoad: "once",
    sameApprovalLoad: "once",
    notes: "meeting-brief-service uses uncached decision; prep-context uses cached — inconsistent",
  },
  {
    subsystem: "Mission",
    sameRequest: "once",
    samePage: "once",
    sameSchedulerTick: "once",
    sameAccountOpen: "once",
    sameHomeLoad: "once",
    sameApprovalLoad: "once",
    notes: "Pure projection from HAC — correct pattern",
  },
  {
    subsystem: "Command Center",
    sameRequest: "once",
    samePage: "twice",
    sameSchedulerTick: "n_times",
    sameAccountOpen: "once",
    sameHomeLoad: "once",
    sameApprovalLoad: "once",
    notes: "Full load for HAC on Home; duplicated pilot data in sales_outcomes",
  },
]

/** Projection surface audit (Phase 4). */
export const GROWTH_RUNTIME_PROJECTION_SURFACES: GrowthRuntimeProjectionSurface[] = [
  {
    surface: "Revenue Queue",
    requiresFullResolver: false,
    existingProjection: "buildRevenueQueueCardProjectionFromLead",
    cachedSummary: null,
    verdict: "existing_projection",
  },
  {
    surface: "Home missions",
    requiresFullResolver: false,
    existingProjection: "buildCanonicalActiveMissionsProjection",
    cachedSummary: "HAC snapshot",
    verdict: "existing_projection",
  },
  {
    surface: "Approval cards",
    requiresFullResolver: false,
    existingProjection: "buildCanonicalOperatorApprovalSnapshot",
    cachedSummary: "HAC bounded 24/120",
    verdict: "existing_projection",
  },
  {
    surface: "Completed Work",
    requiresFullResolver: false,
    existingProjection: "filterActiveCompletedWorkItems",
    cachedSummary: null,
    verdict: "existing_projection",
  },
  {
    surface: "Home hero decision",
    requiresFullResolver: true,
    existingProjection: "projectCanonicalDecisionOperatorCard",
    cachedSummary: "30s in-process cache",
    verdict: "mixed",
  },
  {
    surface: "Daily Work Queue",
    requiresFullResolver: true,
    existingProjection: "adaptDailyRevenueWorkQueueToDisplaySummary",
    cachedSummary: null,
    verdict: "full_resolver",
  },
  {
    surface: "Home operator approval loader",
    requiresFullResolver: true,
    existingProjection: "buildCanonicalOperatorApprovalSnapshot",
    cachedSummary: null,
    verdict: "mixed",
  },
  {
    surface: "Lead lists",
    requiresFullResolver: false,
    existingProjection: "lead pool page + relationship snapshots",
    cachedSummary: null,
    verdict: "existing_projection",
  },
  {
    surface: "Meeting lists",
    requiresFullResolver: false,
    existingProjection: "meeting dashboard queries",
    cachedSummary: null,
    verdict: "existing_projection",
  },
]

/** Lazy-loading violations (Phase 5). */
export const GROWTH_RUNTIME_LAZY_LOADING_VIOLATIONS: GrowthRuntimeLazyLoadingViolation[] = [
  {
    surface: "Home",
    expected: "Summaries only",
    actual: "DRQ 250× IRE, full command center for HAC, hero decision, org memory/knowledge writes",
    severity: "critical",
  },
  {
    surface: "Revenue Queue",
    expected: "Summaries only",
    actual: "Pure projection — correct",
    severity: "low",
  },
  {
    surface: "Scheduler sales loop",
    expected: "Selected accounts only",
    actual: "buildGrowthHomeWorkspaceSummary per org (full Home stack)",
    severity: "critical",
  },
  {
    surface: "Scheduler objective preload",
    expected: "O(batch) objective fetch",
    actual: "listActiveRunningGrowthObjectives loads all before selecting 50",
    severity: "high",
  },
  {
    surface: "Lead Workspace",
    expected: "Full account on open",
    actual: "Full decision + memory — correct for account open",
    severity: "low",
  },
  {
    surface: "Call copilot briefing",
    expected: "Call intelligence only",
    actual: "buildGrowthAiCopilotInput fetched then voided",
    severity: "medium",
  },
  {
    surface: "Reply webhook",
    expected: "Reply intelligence only",
    actual: "Uncached full decision resolve on finalize",
    severity: "medium",
  },
  {
    surface: "Meeting brief service",
    expected: "Meeting intelligence only",
    actual: "Uncached decision path bypasses 30s cache",
    severity: "medium",
  },
]

/** Cache inventory (Phase 7). */
export const GROWTH_RUNTIME_CACHE_INVENTORY: GrowthRuntimeCacheInventoryEntry[] = [
  {
    name: "Canonical Decision",
    modulePath: "lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache.ts",
    ttl: "30s",
    scope: "Per cacheScope key (operator-surface, draft-factory, growth5f, transport, sequence)",
    reuse: "Same lead+scope+version within TTL",
    invalidations: "Package, meeting, reply, sequence, override events",
    status: "underutilized",
  },
  {
    name: "Memory Resolver",
    modulePath: "lib/growth/lead-memory/resolve-canonical-human-memory-for-lead.ts",
    ttl: "None",
    scope: "N/A",
    reuse: "preloadedMemoryBundle param exists but rarely used",
    invalidations: "N/A",
    status: "missing_opportunity",
  },
  {
    name: "Meeting Prep",
    modulePath: "lib/growth/meeting-intelligence/ai-meeting-prep-service.ts",
    ttl: "Until regenerate=true",
    scope: "Per meeting draft row",
    reuse: "Returns existing draft",
    invalidations: "Explicit regenerate",
    status: "active",
  },
  {
    name: "Outreach Package",
    modulePath: "lib/growth/aios/growth/growth-send-plane-1a-canonical-loader.ts",
    ttl: "DB persistence",
    scope: "Per lead",
    reuse: "DB read each resolve",
    invalidations: "Package rebuild",
    status: "active",
  },
  {
    name: "Institutional Learning",
    modulePath: "lib/growth/aios/growth/growth-institutional-learning-1a-resolver.ts",
    ttl: "None",
    scope: "Per org per memory resolve",
    reuse: "None",
    invalidations: "N/A",
    status: "missing_opportunity",
  },
  {
    name: "Approval Snapshot",
    modulePath: "lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a-loader.ts",
    ttl: "None",
    scope: "Per Home load",
    reuse: "None — reloads command center",
    invalidations: "N/A",
    status: "underutilized",
  },
  {
    name: "AI Cache (LLM)",
    modulePath: "lib/ai/router.ts",
    ttl: "Persistent DB",
    scope: "Per task + schema version",
    reuse: "Copilot generations, live coach",
    invalidations: "Schema version bump",
    status: "active",
  },
  {
    name: "Home Loader Budget",
    modulePath: "lib/growth/home/growth-home-workspace-loader-budget.ts",
    ttl: "2.5s per stage",
    scope: "Per loader",
    reuse: "Timeout → fallback null",
    invalidations: "N/A",
    status: "active",
  },
  {
    name: "IRE Historical Learning",
    modulePath: "lib/growth/revenue-workflow/load-ire-historical-learning.ts",
    ttl: "None",
    scope: "Per DRQ lead iteration",
    reuse: "None — up to 250× identical query",
    invalidations: "N/A",
    status: "duplicate",
  },
]

/** Top optimization opportunities (Phase 11) — audit only, not implemented. */
export const GROWTH_RUNTIME_OPTIMIZATION_OPPORTUNITIES: GrowthRuntimeOptimizationOpportunity[] = [
  {
    id: "hoist_ire_learning",
    title: "Hoist loadIreHistoricalLearning once per Home DRQ pass",
    roi: "highest",
    complexity: "low",
    risk: "low",
    latencySavings: "Eliminates up to 249 redundant 500-row queries per Home load",
    databaseSavings: "O(250) → O(1) closed-loop learning reads",
    aiSavings: "None",
    scalabilityImprovement: "Home load stable at 1k+ accounts",
  },
  {
    id: "slim_hac_command_center",
    title: "Narrow approval loader — skip full command center chain on Home",
    roi: "highest",
    complexity: "medium",
    risk: "medium",
    latencySavings: "Removes 20+ sequential awaits from Home hot path",
    databaseSavings: "30+ reads → ~5 HAC-focused reads",
    aiSavings: "None",
    scalabilityImprovement: "Home P95 drops materially",
  },
  {
    id: "sales_loop_home_projection",
    title: "Replace full Home summary in autonomous sales loop with lightweight portfolio projection",
    roi: "highest",
    complexity: "medium",
    risk: "medium",
    latencySavings: "20 orgs × full Home → bounded summary",
    databaseSavings: "Eliminates scheduler-driven Home amplification",
    aiSavings: "None",
    scalabilityImprovement: "Scheduler tick O(batch) not O(home×orgs)",
  },
  {
    id: "unify_decision_cache_scope",
    title: "Share decision cache across operator-surface and draft-factory scopes when versions match",
    roi: "medium",
    complexity: "medium",
    risk: "medium",
    latencySavings: "Avoid duplicate 8–14 query chains per lead per tick",
    databaseSavings: "Up to 15 full decision chains → 1 per lead per 30s",
    aiSavings: "None",
    scalabilityImprovement: "DF tick cost bounded",
  },
  {
    id: "memory_bundle_reuse",
    title: "Wire preloadedMemoryBundle through decision → G5F → approval paths",
    roi: "medium",
    complexity: "medium",
    risk: "low",
    latencySavings: "Eliminates duplicate 10–12 query memory resolves",
    databaseSavings: "2× → 1× memory per account action",
    aiSavings: "None",
    scalabilityImprovement: "Account-open and scheduler paths cheaper",
  },
  {
    id: "objective_fetch_batch",
    title: "Paginate listActiveRunningGrowthObjectives for scheduler selection",
    roi: "medium",
    complexity: "low",
    risk: "low",
    latencySavings: "Scheduler startup independent of total objective count",
    databaseSavings: "O(all objectives) → O(50)",
    aiSavings: "None",
    scalabilityImprovement: "10k+ objectives per org",
  },
  {
    id: "meeting_brief_cache_align",
    title: "Align meeting-brief-service with cached decision resolver",
    roi: "low",
    complexity: "low",
    risk: "low",
    latencySavings: "One fewer full decision chain per meeting open",
    databaseSavings: "8–14 reads saved per meeting",
    aiSavings: "None",
    scalabilityImprovement: "Meeting workspace consistency",
  },
  {
    id: "remove_void_copilot_input",
    title: "Remove voided buildGrowthAiCopilotInput from call briefing",
    roi: "low",
    complexity: "low",
    risk: "low",
    latencySavings: "7 parallel DB reads removed per call session",
    databaseSavings: "7 reads per call start",
    aiSavings: "None",
    scalabilityImprovement: "Call workspace faster cold start",
  },
]

/** Scale bottlenecks (Phase 13). */
export const GROWTH_RUNTIME_SCALE_BOTTLENECKS: GrowthRuntimeScaleBottleneck[] = [
  {
    accountCount: 100,
    firstBottleneck: "Home DRQ sequential loop + command center latency",
    symptoms: ["2.5s loader timeouts on DRQ/HAC", "P95 Home > 5s"],
  },
  {
    accountCount: 1_000,
    firstBottleneck: "DRQ 250× IRE + 250× learning query amplification",
    symptoms: ["Supabase connection pressure", "Home timeouts degrade DRQ to null", "Hero decision still resolves"],
  },
  {
    accountCount: 10_000,
    firstBottleneck: "Scheduler sales loop × 20 orgs × full Home + objective preload",
    symptoms: ["45s scheduler budget exhaustion", "Draft factory starvation", "Cross-org contention"],
  },
  {
    accountCount: 100_000,
    firstBottleneck: "Portfolio admission without summary-only Home + unbounded org objective scan",
    symptoms: ["Lead pool pagination churn", "HAC 120 cap hides backlog", "Memory/decision cold paths dominate account opens"],
  },
]

/** Existing reusable systems (Phase 12). */
export const GROWTH_RUNTIME_REUSABLE_SYSTEMS = [
  "growth-canonical-decision-engine-1c-cache (30s, scope-keyed, invalidation hooks)",
  "buildRevenueQueueCardProjectionFromLead (pure navigation projection)",
  "buildCanonicalActiveMissionsProjection (HAC-derived, display cap 24)",
  "buildCanonicalOperatorApprovalSnapshot (bounded HAC projection)",
  "growth-send-plane-1a-copilot-bridge (LLM bypass via canonical materialization)",
  "ai_meeting_preparations draft reuse",
  "enrichRelationshipLeadSnapshotsBatch (5-query batch loader)",
  "withGrowthHomeLoaderBudget (2.5s graceful degradation)",
  "preloadedMemoryBundle parameter on decision cache API",
  "GROWTH_SALES_WORKLOAD_CAP_REGISTRY centralized limits",
  "approval package persistence (Growth 5F pilot store)",
  "ai_cache for copilot generations",
] as const

export const GROWTH_RUNTIME_OPTIMIZATION_AUDIT_VERDICT: GrowthRuntimeOptimizationAuditVerdict =
  "READY_FOR_RUNTIME_OPTIMIZATION"

export function buildGrowthRuntimeOptimizationAuditSummary(): {
  qaMarker: typeof GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_QA_MARKER
  verdict: GrowthRuntimeOptimizationAuditVerdict
  expensiveResolverCount: number
  entryPointCount: number
  lazyLoadingViolationCount: number
  highestRoiOpportunityCount: number
  primaryBlockers: string[]
} {
  const criticalViolations = GROWTH_RUNTIME_LAZY_LOADING_VIOLATIONS.filter(
    (row) => row.severity === "critical" || row.severity === "high",
  )
  return {
    qaMarker: GROWTH_RUNTIME_OPTIMIZATION_AUDIT_1A_QA_MARKER,
    verdict: GROWTH_RUNTIME_OPTIMIZATION_AUDIT_VERDICT,
    expensiveResolverCount: GROWTH_RUNTIME_EXPENSIVE_RESOLVER_INVENTORY.length,
    entryPointCount: GROWTH_RUNTIME_ENTRY_POINTS.length,
    lazyLoadingViolationCount: GROWTH_RUNTIME_LAZY_LOADING_VIOLATIONS.length,
    highestRoiOpportunityCount: GROWTH_RUNTIME_OPTIMIZATION_OPPORTUNITIES.filter(
      (row) => row.roi === "highest",
    ).length,
    primaryBlockers: criticalViolations.map((row) => `${row.surface}: ${row.actual}`),
  }
}
