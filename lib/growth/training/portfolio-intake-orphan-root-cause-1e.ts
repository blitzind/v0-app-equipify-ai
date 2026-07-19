/**
 * GE-AIOS-PORTFOLIO-INTAKE-ORPHAN-ROOT-CAUSE-1E — Architecture analysis constants (client-safe).
 */

export const GROWTH_AIOS_PORTFOLIO_INTAKE_ORPHAN_ROOT_CAUSE_1E_QA_MARKER =
  "ge-aios-portfolio-intake-orphan-root-cause-1e-v1" as const

/** Canonical promotion owner in autonomous discovery. */
export const PORTFOLIO_INTAKE_PROMOTION_OWNER = {
  component: "runAutonomousPortfolioDiscoveryBatch",
  file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
  pushFunction: "executeBulkPushToLeadInbox",
  pushFile: "lib/growth/prospect-search/prospect-search-push-to-inbox.ts",
} as const

/** Scheduler entry that eventually reaches promotion. */
export const PORTFOLIO_INTAKE_SCHEDULER_ENTRY = {
  component: "tickAutonomousPortfolioManagerForScheduler",
  file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts",
  next: "tickAutonomousPortfolioDiscoveryReplenishment",
} as const

export type PortfolioIntakeCallChainStep = {
  order: number
  component: string
  file: string
  function: string
  condition?: string
  outcome?: string
}

/** Intended call chain from scheduler tick to lead promotion (code-evidence based). */
export const PORTFOLIO_INTAKE_INTENDED_CALL_CHAIN: PortfolioIntakeCallChainStep[] = [
  {
    order: 1,
    component: "Objective scheduler",
    file: "lib/growth/objectives/growth-objective-runtime-scheduler.ts",
    function: "tickAutonomousPortfolioManagerForScheduler",
  },
  {
    order: 2,
    component: "Portfolio scheduler tick",
    file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-scheduler-tick-1a.ts",
    function: "loadPortfolioDatamoonDiscoveryOperatorState",
    condition: "discoveryAlreadyRunning = datamoonDiscovery.jobActive",
  },
  {
    order: 3,
    component: "Replenishment decision",
    file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a.ts",
    function: "evaluatePortfolioReplenishmentDecision",
    condition: "discoveryAlreadyRunning → shouldResumeActiveDiscovery = true",
  },
  {
    order: 4,
    component: "Execution plan",
    file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-replenishment-1a.ts",
    function: "resolveAutonomousPortfolioDiscoveryExecutionPlan",
    condition: 'shouldResumeActiveDiscovery → action "resume_active"',
  },
  {
    order: 5,
    component: "Portfolio discovery batch",
    file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
    function: "runAutonomousPortfolioDiscoveryBatch → runProspectSearch",
  },
  {
    order: 6,
    component: "DataMoon autonomous discovery",
    file: "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts",
    function: "findActiveAutonomousProspectSearchDatamoonRun",
    condition: 'status in ("pending_build","building")',
  },
  {
    order: 7,
    component: "Resume active run",
    file: "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts",
    function: "resumeAutonomousProspectSearchDatamoonDiscoveryFromActiveRun → pollDatamoonAudienceImportRun",
  },
  {
    order: 8,
    component: "Completion on same tick",
    file: "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts",
    function: "isDatamoonAutonomousDiscoveryRunCompleted",
    condition: "poll observes completed → companies returned, jobActive: false",
  },
  {
    order: 9,
    component: "Portfolio discovery batch",
    file: "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
    function: "runAutonomousPortfolioDiscoveryBatch",
    condition: "!datamoonJobActive && search.companies.length > 0",
  },
  {
    order: 10,
    component: "Lead promotion",
    file: "lib/growth/prospect-search/prospect-search-push-to-inbox.ts",
    function: "executeBulkPushToLeadInbox → pushProspectSearchCompanyToLeadInbox → createLeadCandidate",
  },
]

/** First divergence point when run completes between scheduler ticks. */
export const PORTFOLIO_INTAKE_MISSING_TRANSITION = {
  id: "completed_to_intake_pending",
  description:
    "No durable promotion-eligible state after run.status becomes completed — run exits ACTIVE_STATUSES and is never polled again for intake",
  firstDivergence: {
    component: "Lifecycle lookup",
    file: "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
    function: "findActiveAutonomousProspectSearchDatamoonRun",
    condition: 'ACTIVE_STATUSES = {"pending_build","building"} — completed runs excluded',
    actualPath:
      "runProspectSearchDatamoonAutonomousDiscovery → startDatamoonAudienceImportRun (new job)",
    expectedPath:
      "resume completed run survivors → executeBulkPushToLeadInbox before starting new discovery",
  },
} as const

export type PortfolioIntakeLifecycleState =
  | "pending_build"
  | "building"
  | "completed"
  | "intake_pending"
  | "intake_complete"
  | "failed"
  | "terminal"

export const PORTFOLIO_INTAKE_INTENDED_STATE_MACHINE: Array<{
  state: PortfolioIntakeLifecycleState
  next: PortfolioIntakeLifecycleState[]
  owner?: string
}> = [
  { state: "pending_build", next: ["building"], owner: "datamoon-audience-import-service" },
  { state: "building", next: ["completed", "failed"], owner: "pollDatamoonAudienceImportRun" },
  {
    state: "completed",
    next: ["intake_pending"],
    owner: "MISSING — no explicit transition written",
  },
  {
    state: "intake_pending",
    next: ["intake_complete"],
    owner: "runAutonomousPortfolioDiscoveryBatch (intended but unreachable async)",
  },
  { state: "intake_complete", next: ["terminal"], owner: "executeBulkPushToLeadInbox" },
  { state: "failed", next: ["terminal"], owner: "portfolio disposition active_discovery_failed" },
]

export const PORTFOLIO_INTAKE_IMPLEMENTED_STATE_MACHINE: Array<{
  state: PortfolioIntakeLifecycleState
  next: PortfolioIntakeLifecycleState[]
  notes?: string
}> = [
  { state: "pending_build", next: ["building"] },
  { state: "building", next: ["completed", "failed"] },
  {
    state: "completed",
    next: ["terminal"],
    notes: "Run becomes terminal for scheduler — findActive returns null, start_new on next tick",
  },
  { state: "failed", next: ["terminal"] },
]

export type PortfolioIntakeArchitecturalIntent = "A" | "B" | "C"

/** Code-evidence verdict on architectural intent. */
export const PORTFOLIO_INTAKE_ARCHITECTURAL_INTENT_VERDICT: {
  answer: PortfolioIntakeArchitecturalIntent
  label: string
  evidence: string[]
} = {
  answer: "A",
  label:
    "Completed runs were intended to be resumed — but only while still findable as active (building/pending) on the same scheduler tick that observes completion via poll",
  evidence: [
    'test-ge-aios-datamoon-autonomous-discovery-cutover-1a Phase 14B: "active building job resumes through Prospect Search"',
    'Phase 14C: "completed poll continues through intake" — resumeAutonomousProspectSearchDatamoonDiscoveryFromActiveRun returns companies when isDatamoonAutonomousDiscoveryRunCompleted',
    'Phase 14E: "healthy portfolio still polls orphaned active jobs to terminal state" — resume_active while discoveryAlreadyRunning',
    "runAutonomousPortfolioDiscoveryBatch calls executeBulkPushToLeadInbox only when datamoonJobActive === false after runProspectSearch",
    "findLatestAutonomousProspectSearchDatamoonRun exists for operator UI only — not used in promotion execution path",
  ],
}

export const PORTFOLIO_INTAKE_RECOMMENDED_FIX = {
  id: "intake_pending_metadata_gate",
  summary:
    "Add durable intake_pending / intake_completed flags on autonomous run metadata; before startDatamoonAudienceImportRun, resume the latest org-scoped completed run with intake_completed !== true",
  owner: "prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts + prospect-search-datamoon-discovery-1a.ts",
  notSimply:
    "Expanding ACTIVE_STATUSES to include completed — that conflates provider lifecycle with intake lifecycle",
  tenantNeutral:
    "Uses existing autonomous_prospect_search_1a.organization_id metadata — no customer-specific branches",
  filesWouldChange: [
    "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a.ts",
    "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts",
    "lib/growth/portfolio-manager/growth-autonomous-portfolio-discovery-1a.ts",
    "lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a.ts",
  ],
  recommendedImplementationMilestone: "GE-AIOS-PORTFOLIO-INTAKE-PENDING-STATE-1F",
} as const

/** Example orphaned survivor traced in production (from 1D inventory). */
export const PORTFOLIO_INTAKE_EXAMPLE_ORPHAN_SURVIVOR = {
  company: "Halliburton Company",
  canonicalCompanyKey: "domain:halliburton.com",
  classification: "bug",
} as const
