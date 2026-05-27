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
  classifyNewsSignalCategory,
  GROWTH_NEWS_MANUAL_QUEUE_SAMPLE_INPUT,
} from "../lib/growth/signals/news-signal-categories"
import { stripInternalSignalFields } from "../lib/growth/signals/signal-api-sanitize"

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
  assert.match(newsTab, /signal_type=news_event/)
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

  console.log("growth-signal-foundation: ok")
}

main()
