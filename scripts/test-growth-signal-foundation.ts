/**
 * Regression checks for Intent Signals foundation (Milestone A).
 * Run: pnpm test:growth-signal-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildSignalDedupeHash,
  attachSignalDedupeHash,
} from "../lib/growth/signals/signal-dedupe"
import {
  buildSignalEvidenceSummary,
  validateSignalEvidenceRequired,
} from "../lib/growth/signals/signal-evidence"
import { scoreSignalV1 } from "../lib/growth/signals/signal-scoring-engine"
import { GROWTH_SIGNAL_FOUNDATION_SCHEMA_MIGRATION } from "../lib/growth/signals/signal-schema-health"
import {
  GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
  GROWTH_SIGNAL_INTERNAL_FIELD_NAMES,
  GROWTH_SIGNAL_TYPES,
  type GrowthNormalizedSignalDraft,
  type GrowthSignalRow,
} from "../lib/growth/signals/signal-types"
import {
  getSignalProvider,
  listSignalProviders,
  summarizeSignalProviderRegistry,
} from "../lib/growth/signals/providers/signal-provider-registry"
import { createManualImportSignalAdapter } from "../lib/growth/signals/providers/adapters/manual-import-adapter"
import {
  createNewsManualSignalAdapter,
  normalizeNewsManualItem,
} from "../lib/growth/signals/providers/adapters/news-signal-adapter"
import {
  createJobPostingManualSignalAdapter,
  normalizeJobPostingManualItem,
} from "../lib/growth/signals/providers/adapters/job-posting-adapter"
import {
  classifyNewsSignalCategory,
  GROWTH_NEWS_MANUAL_QUEUE_SAMPLE_INPUT,
} from "../lib/growth/signals/news-signal-categories"
import {
  classifyHiringIntensity,
  classifyJobDepartment,
  classifyJobRoleFamily,
  GROWTH_JOB_POSTING_MANUAL_QUEUE_SAMPLE_INPUT,
} from "../lib/growth/signals/job-signal-classification"
import {
  aggregateJobPostingsToHiringVelocity,
  buildDerivedHireSignalDraft,
} from "../lib/growth/signals/hiring-velocity"
import { stripInternalSignalFields } from "../lib/growth/signals/signal-api-sanitize"
import {
  GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
  GROWTH_SIGNAL_WATCHLIST_EXAMPLE_PAYLOAD,
  GROWTH_SIGNAL_SAFE_ACTIONS,
  GROWTH_SIGNAL_BLOCKED_ACTIONS,
} from "../lib/growth/signals/signal-watchlist-types"
import {
  GROWTH_SIGNAL_TRIGGER_RULE_EXAMPLE_PAYLOAD,
  GROWTH_SIGNAL_TRIGGER_SAFETY_MODES,
} from "../lib/growth/signals/signal-trigger-rule-types"
import {
  evaluateSignalWatchlist,
  evaluateSignalTriggerRule,
  signalMatchesWatchlistFilters,
} from "../lib/growth/signals/signal-trigger-evaluator"
import {
  GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
  buildCompanySignalRollup,
  deriveMomentumLabel,
  signalMatchesCompanyRollupTarget,
} from "../lib/growth/signals/company-signal-rollup"
import {
  buildProspectSearchSignalIntelligenceOverlay,
  resolveProspectSearchCompanyMatchKeys,
  sortProspectSearchCompaniesBySignalMomentum,
} from "../lib/growth/signals/integrations/prospect-search-signal-overlay"
import { buildTerritorySignalIntelligenceSummary } from "../lib/growth/signals/integrations/territory-signal-intelligence"
import { buildCommandCenterSignalMomentumSummary } from "../lib/growth/signals/integrations/command-center-bridge"
import {
  evaluatePersonIdentityConfidence,
  meetsPromotionIdentityThreshold,
  PERSON_IDENTITY_REJECT_THRESHOLD,
} from "../lib/growth/signals/person-identity-confidence"
import {
  detectTransitionType,
  computeSeniorityDelta,
  buildPersonSignalDedupeKey,
  GROWTH_PEOPLE_SIGNALS_QA_MARKER,
  GROWTH_JOB_CHANGE_MANUAL_QUEUE_SAMPLE_INPUT,
} from "../lib/growth/signals/job-change-signal-normalizer"
import {
  normalizeJobChangeManualItems,
  GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY,
} from "../lib/growth/signals/providers/adapters/job-change-manual-adapter"
import { sanitizePersonSignalMetadata } from "../lib/growth/signals/person-signal-metadata"

function main(): void {
  assert.equal(GROWTH_SIGNAL_FOUNDATION_QA_MARKER, "growth-signal-foundation-v1")
  assert.equal(GROWTH_SIGNAL_TYPES.length, 10)
  assert.ok(GROWTH_SIGNAL_TYPES.includes("website_visitor"))
  assert.ok(GROWTH_SIGNAL_TYPES.includes("manual_signal"))

  const migrationPath = path.join(
    process.cwd(),
    `supabase/migrations/${GROWTH_SIGNAL_FOUNDATION_SCHEMA_MIGRATION}`,
  )
  assert.ok(fs.existsSync(migrationPath), "signal foundation migration must exist")
  const migration = fs.readFileSync(migrationPath, "utf8")
  assert.match(migration, /growth\.signals/)
  assert.match(migration, /growth\.signal_sources/)
  assert.match(migration, /growth\.signal_targets/)
  assert.match(migration, /growth\.signal_events/)
  assert.match(migration, /growth\.signal_providers/)
  assert.match(migration, /growth\.signal_ingestion_queue/)
  assert.match(migration, /growth\.signal_raw_payloads/)
  assert.match(migration, /dedupe_hash/)
  assert.match(migration, /organization_id/)
  assert.match(migration, /workflow_state/)
  assert.match(migration, /suppression_state/)
  assert.match(migration, /occurred_at/)
  assert.match(migration, /detected_at/)
  assert.match(migration, /growth-signal-foundation-v1/)

  const sampleDraft: GrowthNormalizedSignalDraft = {
    signal_type: "news_event",
    provider_key: "manual_import",
    occurred_at: "2026-05-20T12:00:00Z",
    company_name: "Acme Field Services",
    domain: "acmefield.com",
    evidence: [
      {
        source_type: "press_news",
        source_url: "https://example.com/news/acme-expansion",
        excerpt: "Acme Field Services announced a new regional service hub.",
        observed_at: "2026-05-20T12:00:00Z",
      },
    ],
  }

  assert.equal(validateSignalEvidenceRequired({ evidence: [] }), "At least one evidence entry is required.")
  assert.equal(validateSignalEvidenceRequired(sampleDraft), null)
  assert.match(buildSignalEvidenceSummary(sampleDraft), /Acme Field Services/)

  const hashA = buildSignalDedupeHash({
    organization_id: null,
    signal_type: "news_event",
    provider_key: "manual_import",
    provider_event_id: null,
    occurred_at: sampleDraft.occurred_at,
    domain: "acmefield.com",
    company_name: sampleDraft.company_name,
  })
  const hashB = attachSignalDedupeHash(sampleDraft)
  assert.equal(typeof hashA, "string")
  assert.equal(hashA.length, 40)
  assert.equal(hashA, hashB)
  assert.equal(buildSignalDedupeHash({
    organization_id: null,
    signal_type: "news_event",
    provider_key: "manual_import",
    provider_event_id: null,
    occurred_at: sampleDraft.occurred_at,
    domain: "acmefield.com",
    company_name: sampleDraft.company_name,
  }), hashA)

  const scoring = scoreSignalV1(sampleDraft)
  assert.ok(scoring.signal_score >= 0 && scoring.signal_score <= 100)
  assert.ok(scoring.confidence >= 0 && scoring.confidence <= 1)
  assert.ok(["low", "normal", "high", "urgent"].includes(scoring.urgency))
  assert.equal(typeof scoring.routing_priority, "number")
  assert.equal(scoring.scoring_metadata.version, "v1")
  assert.ok(scoring.scoring_metadata.components)

  const providers = listSignalProviders()
  assert.ok(providers.length >= 1)
  assert.ok(getSignalProvider("manual_import"))
  const registry = summarizeSignalProviderRegistry()
  assert.ok(registry.some((entry) => entry.provider_key === "manual_import"))
  assert.ok(getSignalProvider("news_manual"))
  assert.ok(registry.some((entry) => entry.provider_key === "news_manual"))

  const newsAdapter = createNewsManualSignalAdapter()
  const newsDrafts = newsAdapter.normalize(GROWTH_NEWS_MANUAL_QUEUE_SAMPLE_INPUT)
  assert.equal(newsDrafts.length, 1)
  assert.equal(newsDrafts[0]?.signal_type, "news_event")
  assert.equal(newsDrafts[0]?.provider_key, "news_manual")
  assert.ok(newsDrafts[0]?.evidence[0]?.source_url)

  assert.equal(normalizeNewsManualItem({ headline: "No URL story" }), null)
  assert.equal(
    classifyNewsSignalCategory({
      headline: "Acme raises Series B funding round",
      excerpt: "Venture capital investment announced.",
    }),
    "funding",
  )
  assert.equal(
    classifyNewsSignalCategory({ headline: "Routine quarterly update", excerpt: "Business as usual." }),
    "general",
  )

  const manual = createManualImportSignalAdapter()
  const normalized = manual.normalize([
    {
      signal_type: "manual_signal",
      occurred_at: "2026-05-21T09:00:00Z",
      company_name: "Sample Co",
      evidence: [{ source_type: "manual", excerpt: "Operator verified signal." }],
    },
  ])
  assert.equal(normalized.length, 1)
  assert.equal(normalized[0]?.provider_key, "manual_import")

  const stripped = stripInternalSignalFields({
    id: "1",
    raw_payload_ref: "secret",
    raw_payload: { secret: true },
    scoring_metadata: { hidden: true },
    evidence_summary: "visible",
  })
  for (const key of GROWTH_SIGNAL_INTERNAL_FIELD_NAMES) {
    assert.equal(key in stripped, false, `expected ${key} to be stripped`)
  }
  assert.equal(stripped.evidence_summary, "visible")

  const listRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/signals/route.ts"),
    "utf8",
  )
  const detailRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/signals/[id]/route.ts"),
    "utf8",
  )
  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/signal-repository.ts"),
    "utf8",
  )

  assert.match(listRoute, /loadGrowthSignals/)
  assert.match(listRoute, /category/)
  assert.match(listRoute, /publisher/)
  assert.match(listRoute, /GROWTH_SIGNAL_FOUNDATION_QA_MARKER/)
  assert.match(detailRoute, /loadGrowthSignalById/)
  assert.doesNotMatch(listRoute, /signal_raw_payloads/)
  assert.doesNotMatch(detailRoute, /signal_raw_payloads/)
  assert.match(repoSource, /stripInternalSignalFields/)
  assert.match(repoSource, /validateSignalEvidenceRequired/)
  assert.doesNotMatch(repoSource, /sendEmail|sequence|auto.?outreach/i)

  const workerSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/signal-ingestion-worker.ts"),
    "utf8",
  )
  assert.match(workerSource, /processSignalIngestionQueue/)
  assert.doesNotMatch(workerSource, /sendEmail|sequence|auto.?outreach/i)

  const inboxBridge = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/integrations/lead-inbox-bridge.ts"),
    "utf8",
  )
  assert.match(inboxBridge, /not enabled in Milestone A/)

  const newsTab = fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-signals/tabs/news-tab.tsx"),
    "utf8",
  )
  const uxConstants = fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-signals/intent-signals-ux-constants.ts"),
    "utf8",
  )
  const signalsShell = fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-signals/intent-signals-shell.tsx"),
    "utf8",
  )
  assert.match(newsTab, /GROWTH_INTENT_SIGNALS_NEWS_TAB_QA_MARKER/)
  assert.match(newsTab, /signal_type: "news_event"/)
  assert.match(newsTab, /watchlist_id/)
  assert.match(newsTab, /tabMeta\.emptyState\.title/)
  assert.match(uxConstants, /No news signals yet/)
  assert.match(uxConstants, /id: "news"[\s\S]*implemented: true/)
  assert.match(signalsShell, /NewsTab/)
  assert.match(signalsShell, /activeTab === "news"/)

  const workerSourceNews = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/signal-ingestion-worker.ts"),
    "utf8",
  )
  assert.match(workerSourceNews, /queueNewsManualIngestion/)
  assert.match(workerSourceNews, /news_manual/)
  assert.match(workerSourceNews, /queueJobPostingManualIngestion/)
  assert.match(workerSourceNews, /job_posting_manual/)
  assert.match(workerSourceNews, /syncDerivedHiringSignals/)

  const jobAdapter = createJobPostingManualSignalAdapter()
  const jobDrafts = jobAdapter.normalize(GROWTH_JOB_POSTING_MANUAL_QUEUE_SAMPLE_INPUT)
  assert.equal(jobDrafts.length, 1)
  assert.equal(jobDrafts[0]?.signal_type, "job_posting")
  assert.equal(jobDrafts[0]?.provider_key, "job_posting_manual")
  assert.equal(normalizeJobPostingManualItem({ title: "Missing URL", company_name: "Acme" }), null)

  assert.equal(classifyJobDepartment({ title: "Field Service Technician" }), "Field Service")
  assert.equal(classifyJobRoleFamily({ title: "Dispatch Coordinator" }), "Coordinator")
  assert.equal(classifyHiringIntensity(1), "low")
  assert.equal(classifyHiringIntensity(4), "medium")
  assert.equal(classifyHiringIntensity(7), "high")

  const sampleJobs: GrowthSignalRow[] = [
    {
      id: "j1",
      organization_id: null,
      signal_type: "job_posting",
      provider_key: "job_posting_manual",
      provider_event_id: null,
      dedupe_hash: "a",
      confidence: 0.8,
      signal_score: 50,
      urgency: "normal",
      routing_priority: 5,
      occurred_at: new Date().toISOString(),
      detected_at: new Date().toISOString(),
      expires_at: null,
      company_id: null,
      company_name: "Acme Health Systems",
      domain: "acmehealth.com",
      contact_id: null,
      contact_display_label: null,
      title: "Biomedical Equipment Technician",
      previous_title: null,
      seniority: null,
      geography: "Nashville, TN",
      industry: null,
      category: "Biomedical",
      evidence_summary: "job posting",
      workflow_state: "new",
      suppression_state: "active",
      processed_to_lead_inbox: false,
      lead_inbox_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { source_url: "https://example.com/jobs/123" },
    },
    {
      id: "j2",
      organization_id: null,
      signal_type: "job_posting",
      provider_key: "job_posting_manual",
      provider_event_id: null,
      dedupe_hash: "b",
      confidence: 0.8,
      signal_score: 52,
      urgency: "normal",
      routing_priority: 5,
      occurred_at: new Date().toISOString(),
      detected_at: new Date().toISOString(),
      expires_at: null,
      company_id: null,
      company_name: "Acme Health Systems",
      domain: "acmehealth.com",
      contact_id: null,
      contact_display_label: null,
      title: "Field Service Manager",
      previous_title: null,
      seniority: null,
      geography: "Nashville, TN",
      industry: null,
      category: "Field Service",
      evidence_summary: "job posting",
      workflow_state: "new",
      suppression_state: "active",
      processed_to_lead_inbox: false,
      lead_inbox_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: { source_url: "https://example.com/jobs/124" },
    },
  ]
  const aggregates = aggregateJobPostingsToHiringVelocity(sampleJobs)
  assert.equal(aggregates.length, 1)
  assert.equal(aggregates[0]?.metrics.open_role_count, 2)
  const derivedDraft = buildDerivedHireSignalDraft(aggregates[0]!)
  assert.equal(derivedDraft.signal_type, "hire")
  assert.equal(derivedDraft.metadata?.no_employee_records, true)
  assert.equal(derivedDraft.contact_display_label, undefined)

  const jobScoring = scoreSignalV1(jobDrafts[0]!)
  const jobScoringRepeat = scoreSignalV1(jobDrafts[0]!)
  assert.equal(jobScoring.signal_score, jobScoringRepeat.signal_score)
  assert.ok((jobScoring.scoring_metadata.components as Record<string, number>).job_hiring_relevance >= 0)

  assert.ok(getSignalProvider("job_posting_manual"))
  assert.ok(registry.some((entry) => entry.provider_key === "job_posting_manual"))

  const jobsTab = fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-signals/tabs/jobs-tab.tsx"),
    "utf8",
  )
  const hiresTab = fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-signals/tabs/hires-tab.tsx"),
    "utf8",
  )
  assert.match(jobsTab, /GROWTH_INTENT_SIGNALS_JOBS_TAB_QA_MARKER/)
  assert.match(jobsTab, /signal_type: "job_posting"/)
  assert.match(hiresTab, /GROWTH_INTENT_SIGNALS_HIRES_TAB_QA_MARKER/)
  assert.match(hiresTab, /signal_type: "hire"/)
  assert.match(uxConstants, /No hiring signals yet/)
  assert.match(uxConstants, /id: "jobs"[\s\S]*implemented: true/)
  assert.match(uxConstants, /id: "hires"[\s\S]*implemented: true/)
  assert.match(signalsShell, /JobsTab/)
  assert.match(signalsShell, /HiresTab/)
  assert.match(signalsShell, /activeTab === "jobs"/)
  assert.match(signalsShell, /activeTab === "hires"/)
  assert.match(listRoute, /signal_type/)

  const ccBridge = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/integrations/command-center-bridge.ts"),
    "utf8",
  )
  assert.match(ccBridge, /buildCommandCenterHiringMetrics/)
  assert.match(ccBridge, /buildCommandCenterWatchlistMetrics/)

  const watchlistMigrationPath = path.join(
    process.cwd(),
    "supabase/migrations/20270528120000_growth_engine_signal_watchlists.sql",
  )
  assert.ok(fs.existsSync(watchlistMigrationPath), "watchlist migration must exist")
  const watchlistMigration = fs.readFileSync(watchlistMigrationPath, "utf8")
  assert.match(watchlistMigration, /growth\.signal_watchlists/)
  assert.match(watchlistMigration, /growth\.signal_trigger_rules/)
  assert.match(watchlistMigration, /growth\.signal_watchlist_matches/)

  const {
    GROWTH_SIGNAL_WATCHLISTS_QA_MARKER: watchlistMarker,
    GROWTH_SIGNAL_WATCHLIST_EXAMPLE_PAYLOAD: watchlistExample,
    GROWTH_SIGNAL_SAFE_ACTIONS: safeActions,
    GROWTH_SIGNAL_BLOCKED_ACTIONS: blockedActions,
  } = {
    GROWTH_SIGNAL_WATCHLISTS_QA_MARKER,
    GROWTH_SIGNAL_WATCHLIST_EXAMPLE_PAYLOAD,
    GROWTH_SIGNAL_SAFE_ACTIONS,
    GROWTH_SIGNAL_BLOCKED_ACTIONS,
  }
  assert.equal(watchlistMarker, "growth-signal-watchlists-v1")
  assert.ok(watchlistExample.name)
  assert.ok(safeActions.includes("add_to_watchlist"))
  assert.ok(blockedActions.includes("auto_sequence"))

  assert.equal(GROWTH_SIGNAL_TRIGGER_RULE_EXAMPLE_PAYLOAD.enabled, false)
  assert.ok(GROWTH_SIGNAL_TRIGGER_SAFETY_MODES.includes("manual_review"))

  const watchlistNewsOnly = {
    id: "w1",
    signal_types: ["news_event"] as GrowthSignalRow["signal_type"][],
    filters: { minimum_signal_score: 40 },
  }
  const newsSignal: GrowthSignalRow = {
    ...sampleJobs[0]!,
    id: "n1",
    signal_type: "news_event",
    signal_score: 45,
    category: "Field Service",
  }
  const jobSignal = sampleJobs[0]!
  const watchlistMatches = evaluateSignalWatchlist(watchlistNewsOnly, [newsSignal, jobSignal])
  assert.equal(watchlistMatches.length, 1)
  assert.equal(watchlistMatches[0]?.signal.id, "n1")

  const scoreWatchlist = {
    id: "w2",
    signal_types: [] as GrowthSignalRow["signal_type"][],
    filters: { minimum_signal_score: 50 },
  }
  const lowScore = { ...newsSignal, id: "n2", signal_score: 30 }
  assert.equal(signalMatchesWatchlistFilters(lowScore, scoreWatchlist).matched, false)
  assert.equal(signalMatchesWatchlistFilters(newsSignal, scoreWatchlist).matched, false)
  assert.equal(signalMatchesWatchlistFilters({ ...newsSignal, signal_score: 55 }, scoreWatchlist).matched, true)

  const deptWatchlist = {
    id: "w3",
    signal_types: ["job_posting"] as GrowthSignalRow["signal_type"][],
    filters: { department: "Biomedical" },
  }
  assert.equal(signalMatchesWatchlistFilters(jobSignal, deptWatchlist).matched, true)
  assert.equal(signalMatchesWatchlistFilters(sampleJobs[1]!, deptWatchlist).matched, false)

  const intensitySignal: GrowthSignalRow = {
    ...sampleJobs[0]!,
    id: "h1",
    signal_type: "hire",
    metadata: {
      hiring_velocity: { hiring_intensity: "high", open_role_count: 6 },
    },
  }
  const intensityWatchlist = {
    id: "w4",
    signal_types: ["hire"] as GrowthSignalRow["signal_type"][],
    filters: { hiring_intensity: "high" },
  }
  assert.equal(signalMatchesWatchlistFilters(intensitySignal, intensityWatchlist).matched, true)

  const triggerSuggestions = evaluateSignalTriggerRule(
    {
      id: "r1",
      name: "High hire review",
      enabled: false,
      safety_mode: "manual_review",
      conditions: { signal_types: ["hire"], hiring_intensity: "high" },
      actions: { suggest_review: true },
    },
    [intensitySignal],
  )
  assert.equal(triggerSuggestions.length, 0)

  const enabledSuggestions = evaluateSignalTriggerRule(
    {
      id: "r2",
      name: "High hire review",
      enabled: true,
      safety_mode: "suggest_only",
      conditions: { signal_types: ["hire"], hiring_intensity: "high" },
      actions: { suggest_review: true, suggest_watchlist: true },
    },
    [intensitySignal],
  )
  assert.equal(enabledSuggestions.length, 1)
  assert.ok(enabledSuggestions[0]?.suggested_actions.includes("suggest_review"))
  assert.doesNotMatch(JSON.stringify(enabledSuggestions), /auto_send|auto_sequence|auto_enroll/)

  const actionsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/signal-actions.ts"),
    "utf8",
  )
  assert.match(actionsSource, /isGrowthSignalBlockedAction/)
  assert.match(actionsSource, /GROWTH_SIGNAL_BLOCKED_ACTIONS/)
  assert.match(actionsSource, /blocked_action/)
  assert.doesNotMatch(actionsSource, /sendEmail|slack/i)

  const refreshSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/signal-watchlist-repository.ts"),
    "utf8",
  )
  assert.match(refreshSource, /refreshSignalWatchlistMatches/)
  assert.match(refreshSource, /upsert/)
  assert.doesNotMatch(refreshSource, /pushToLeadInbox|sendEmail|auto_sequence|slack/i)

  const actionsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/signals/[id]/actions/route.ts"),
    "utf8",
  )
  assert.match(actionsRoute, /applyGrowthSignalAction/)
  assert.doesNotMatch(actionsRoute, /raw_payload|stack/i)

  const watchlistsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/signals/watchlists/route.ts"),
    "utf8",
  )
  assert.match(watchlistsRoute, /GROWTH_SIGNAL_WATCHLISTS_QA_MARKER/)

  assert.match(uxConstants, /growth-signal-watchlists-v1/)
  assert.match(signalsShell, /IntentSignalsWatchlistBar/)

  const prospectOverlay = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/integrations/prospect-search-signal-overlay.ts"),
    "utf8",
  )
  assert.match(prospectOverlay, /buildProspectSearchHiringOverlay/)
  assert.match(prospectOverlay, /buildProspectSearchSignalIntelligenceOverlay/)
  assert.match(prospectOverlay, /signalMatchesCompanyRollupTarget|resolveProspectSearchCompanyMatchKeys/)

  assert.equal(GROWTH_SIGNAL_MOMENTUM_QA_MARKER, "growth-signal-momentum-v1")

  const baseSignal = (partial: Partial<GrowthSignalRow>): GrowthSignalRow => ({
    id: partial.id ?? "s1",
    organization_id: null,
    signal_type: partial.signal_type ?? "news_event",
    provider_key: "manual",
    provider_event_id: null,
    dedupe_hash: "d1",
    confidence: 0.8,
    signal_score: partial.signal_score ?? 55,
    urgency: partial.urgency ?? "normal",
    routing_priority: 1,
    occurred_at: partial.occurred_at ?? new Date().toISOString(),
    detected_at: partial.occurred_at ?? new Date().toISOString(),
    expires_at: null,
    company_id: partial.company_id ?? null,
    company_name: partial.company_name ?? "Acme Health Systems",
    domain: partial.domain ?? "acmehealth.com",
    contact_id: null,
    contact_display_label: null,
    title: partial.title ?? "News",
    previous_title: null,
    seniority: null,
    geography: partial.geography ?? null,
    industry: null,
    category: partial.category ?? "Field Service",
    evidence_summary: partial.evidence_summary ?? "Expansion announced",
    workflow_state: "new",
    suppression_state: "active",
    processed_to_lead_inbox: false,
    lead_inbox_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: partial.metadata ?? {},
  })

  const signals = [
    baseSignal({ id: "n1", signal_type: "news_event", signal_score: 60 }),
    baseSignal({
      id: "j1",
      signal_type: "job_posting",
      signal_score: 50,
      evidence_summary: "Biomedical technician",
      category: "Biomedical",
    }),
    baseSignal({
      id: "h1",
      signal_type: "hire",
      signal_score: 70,
      urgency: "high",
      metadata: {
        hiring_velocity: { hiring_intensity: "high", hiring_spike: true, open_role_count: 4 },
      },
    }),
  ]

  const rollup = buildCompanySignalRollup({
    domain: "acmehealth.com",
    signals,
    watchlist_matches: [{ signal_id: "n1", watchlist_id: "w1", watchlist_name: "Medical hiring" }],
  })
  assert.equal(rollup.total_signal_count, 3)
  assert.equal(rollup.news_count, 1)
  assert.equal(rollup.job_posting_count, 1)
  assert.equal(rollup.hiring_signal_count, 1)
  assert.equal(rollup.watchlist_match_count, 1)
  assert.ok(rollup.momentum_score > rollup.momentum_base_score)
  assert.equal(deriveMomentumLabel(0), "Quiet")
  assert.equal(deriveMomentumLabel(80), "Priority")

  assert.equal(
    signalMatchesCompanyRollupTarget(signals[0]!, { domain: "acmehealth.com", company_name: "Other Co" }),
    true,
  )
  assert.equal(
    signalMatchesCompanyRollupTarget(signals[0]!, { domain: null, company_name: "Acme Health Systems" }),
    false,
  )
  assert.equal(
    signalMatchesCompanyRollupTarget(
      { ...signals[0]!, company_name: "Similar Name Co", domain: null },
      { domain: null, company_name: "Acme Health Systems" },
    ),
    false,
  )

  const overlay = buildProspectSearchSignalIntelligenceOverlay({
    company: {
      website: "https://acmehealth.com",
      company_name: "Acme Health Systems",
      growth_lead_id: null,
      prospect_id: null,
      customer_id: null,
    },
    signals,
  })
  assert.equal(overlay.qa_marker, "growth-signal-momentum-v1")
  assert.ok(overlay.signal_momentum_score > 0)

  const keys = resolveProspectSearchCompanyMatchKeys({
    website: "https://acmehealth.com",
    company_name: "Acme",
    growth_lead_id: null,
    prospect_id: null,
    customer_id: null,
  })
  assert.equal(keys.domain, "acmehealth.com")

  const sorted = sortProspectSearchCompaniesBySignalMomentum([
    { id: "a", signal_momentum_score: 10, recent_signal_count: 1 } as never,
    { id: "b", signal_momentum_score: 40, recent_signal_count: 3 } as never,
  ])
  assert.equal(sorted[0]?.id, "b")

  const territoryEmpty = buildTerritorySignalIntelligenceSummary({
    companies: [{ company_id: "c1", company_name: "Acme", state: "TN", city: "Nashville" }],
    signals,
  })
  assert.equal(territoryEmpty.total_signals_30d, 0)

  const ccSummary = buildCommandCenterSignalMomentumSummary({ signals })
  assert.equal(ccSummary.qa_marker, "growth-signal-momentum-v1")
  assert.ok(ccSummary.top_companies_by_momentum.length >= 1)
  assert.equal(typeof ccSummary.job_changes_count, "number")
  assert.equal(typeof ccSummary.promotions_count, "number")

  const rollupRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/signals/company-rollup/route.ts"),
    "utf8",
  )
  assert.match(rollupRoute, /sanitizeRollup/)
  assert.doesNotMatch(rollupRoute, /raw_payload:/)

  assert.equal(PERSON_IDENTITY_REJECT_THRESHOLD, 0.5)
  assert.equal(evaluatePersonIdentityConfidence({ person_name: "" }).accept, false)
  assert.equal(
    evaluatePersonIdentityConfidence({
      person_name: "Jane Smith",
      person_external_id: "manual-123",
      source_url: "https://example.com/profile/jane-smith",
    }).identity_confidence,
    1,
  )
  assert.equal(meetsPromotionIdentityThreshold(0.74), false)
  assert.equal(meetsPromotionIdentityThreshold(0.75), true)

  assert.equal(GROWTH_PEOPLE_SIGNALS_QA_MARKER, "growth-people-signals-v1")
  assert.equal(
    detectTransitionType({
      previous_company_domain: "oldco.com",
      new_company_domain: "newco.com",
      previous_title: "Manager",
      new_title: "Director",
    }),
    "company_move",
  )
  assert.equal(
    detectTransitionType({
      previous_company_domain: "acme.com",
      new_company_domain: "acme.com",
      previous_title: "Manager",
      new_title: "Director",
    }),
    "internal_promotion",
  )
  assert.equal(computeSeniorityDelta("Manager", "Director"), 1)
  assert.notEqual(
    buildPersonSignalDedupeKey({
      person_name: "Jane Smith",
      new_company_domain: "a.com",
      new_title: "Director",
      occurred_at: "2026-05-01T00:00:00Z",
      signal_type: "job_change",
    }),
    buildPersonSignalDedupeKey({
      person_name: "Jane Smith",
      new_company_domain: "b.com",
      new_title: "Director",
      occurred_at: "2026-05-01T00:00:00Z",
      signal_type: "job_change",
    }),
  )

  assert.equal(GROWTH_JOB_CHANGE_MANUAL_PROVIDER_KEY, "job_change_manual")
  assert.equal(normalizeJobChangeManualItems([{ person_name: "Jane" }]).length, 0)
  assert.equal(
    normalizeJobChangeManualItems([
      {
        person_name: "Jane",
        excerpt: "maybe changed jobs",
        new_company_name: "Acme",
        new_title: "Director",
        source_url: "https://example.com/jane",
      },
    ]).length,
    0,
  )
  const companyMoveDrafts = normalizeJobChangeManualItems(GROWTH_JOB_CHANGE_MANUAL_QUEUE_SAMPLE_INPUT)
  assert.ok(companyMoveDrafts.some((draft) => draft.signal_type === "job_change"))
  const promotionDrafts = normalizeJobChangeManualItems([
    {
      person_name: "Alex Rivera",
      person_external_id: "promo-1",
      source_url: "https://example.com/alex",
      excerpt: "Alex Rivera promoted to Director of Field Service at Summit Biomed.",
      occurred_at: "2026-05-18T09:00:00Z",
      new_company_name: "Summit Biomed",
      new_company_domain: "summitbiomed.com",
      previous_company_name: "Summit Biomed",
      previous_company_domain: "summitbiomed.com",
      previous_title: "Field Service Manager",
      new_title: "Director of Field Service",
      explicit_promotion: true,
    },
  ])
  assert.ok(promotionDrafts.some((draft) => draft.signal_type === "promotion"))
  assert.equal(
    normalizeJobChangeManualItems([
      {
        person_name: "Alex Rivera",
        source_url: "https://example.com/alex-2",
        excerpt: "Alex Rivera promoted.",
        new_company_name: "Summit Biomed",
        new_company_domain: "summitbiomed.com",
        new_title: "Director of Field Service",
      },
    ]).length,
    0,
  )

  const sanitized = sanitizePersonSignalMetadata({
    person_name: "Jane",
    person_external_id: "secret-id",
    identity_confidence: 0.9,
    people_provider: "debug",
  })
  assert.equal(sanitized.person_name, "Jane")
  assert.equal((sanitized as Record<string, unknown>).person_external_id, undefined)

  const personSignal = {
    ...signals[0]!,
    signal_type: "job_change" as const,
    seniority: "director",
    metadata: {
      person_signal: true,
      transition_type: "company_move",
      identity_confidence: 0.9,
      previous_company_domain: "oldco.com",
    },
  }
  assert.equal(
    signalMatchesWatchlistFilters(personSignal, {
      signal_types: ["job_change"],
      filters: { transition_type: "company_move", identity_confidence_min: 0.75 },
    }).matched,
    true,
  )

  const personTabSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-signals/tabs/person-signals-tab.tsx"),
    "utf8",
  )
  assert.match(personTabSource, /GROWTH_INTENT_SIGNALS_JOB_CHANGES_TAB_QA_MARKER/)
  assert.match(personTabSource, /GROWTH_INTENT_SIGNALS_PROMOTIONS_TAB_QA_MARKER/)
  assert.match(personTabSource, /IntentSignalsPersonSignalDetail/)

  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-signals/intent-signals-shell.tsx"),
    "utf8",
  )
  assert.match(shellSource, /JobChangesTab/)
  assert.match(shellSource, /PromotionsTab/)

  const registrySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/signals/providers/signal-provider-registry.ts"),
    "utf8",
  )
  assert.match(registrySource, /createJobChangeManualSignalAdapter/)

  const uiActionsSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/intent-signals/intent-signals-signal-actions.tsx"),
    "utf8",
  )
  assert.doesNotMatch(uiActionsSource, /auto_sequence|auto_outreach|auto_enroll/)

  console.log("growth-signal-foundation: ok")
}

main()
