/**
 * GE-AIOS-CONTACT-1B — Live DataMoon DM discovery adapter certification.
 * Run: pnpm test:ge-aios-contact-1b-live-datamoon-dm-discovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "path"
import {
  authorizeDatamoonPersonEnrichment,
  buildDatamoonAudienceFiltersForDecisionMaker,
  decideDatamoonDecisionMakerEnrichment,
  projectDecisionMakerRequirement,
  rankDatamoonDecisionMakerCandidates,
  selectBestDatamoonDecisionMaker,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-engine"
import {
  buildDatamoonDmDiscoveryCriteriaFingerprint,
  buildDatamoonDmDiscoveryRunName,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-discovery-durable-store"
import {
  DATAMOON_DM_DISCOVERY_POLL_POLICY,
  GROWTH_AIOS_CONTACT_1B_QA_MARKER,
} from "../lib/growth/datamoon-decision-maker/datamoon-dm-discovery-types"
import { normalizeDatamoonRecordsToDecisionMakerCandidates } from "../lib/growth/datamoon-decision-maker/datamoon-dm-normalize"
import { extractDatamoonContactChannels } from "../lib/growth/datamoon-decision-maker/datamoon-dm-contact-channels"
import { evaluateCanonicalPersonEmailPromotion } from "../lib/growth/email-discovery/email-discovery-integrity-rules"
import { mapAiOsEventToDraftFactoryWakePlans } from "../lib/growth/draft-factory/draft-factory-wake-event-mapper"
import { isRegisteredAiEventType } from "../lib/growth/aios/ai-event-registry"
import { GROWTH_AI_EVENT_QA_MARKER } from "../lib/growth/aios/ai-event-types"
import type { AiOsEvent } from "../lib/growth/aios/ai-event-types"
import { AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES } from "../lib/growth/datamoon-decision-maker/datamoon-dm-types"

const ROOT = process.cwd()
const PHASE = "GE-AIOS-CONTACT-1B" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleEvent(eventType: string, payload: Record<string, unknown> = {}): AiOsEvent {
  return {
    id: "evt-1",
    eventType: eventType as AiOsEvent["eventType"],
    eventVersion: 1,
    schemaVersion: "1.0",
    category: "system",
    organizationId: "org-1",
    missionId: null,
    workOrderId: null,
    agentOwner: null,
    entityType: "lead",
    entityId: "lead-1",
    correlationId: "corr-1",
    causationId: null,
    priority: 500,
    producer: "test",
    source: "test",
    payload: { lead_id: "lead-1", ...payload },
    metadata: {},
    auditMetadata: {},
    lifecycle: "published",
    replayable: true,
    replayKey: `rk:${eventType}:org-1:lead-1`,
    occurredAt: "2026-07-12T23:00:00.000Z",
    createdAt: "2026-07-12T23:00:00.000Z",
    qaMarker: GROWTH_AI_EVENT_QA_MARKER,
  }
}

console.log(`[${PHASE}] Live DataMoon DM discovery certification`)
assert.equal(GROWTH_AIOS_CONTACT_1B_QA_MARKER, "ge-aios-contact-1b-live-datamoon-dm-discovery-v1")

// --- Production resolves live; stub forbidden ---
{
  const factory = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-discovery-factory.ts")
  assert.ok(factory.includes('runtime: "production"'))
  assert.ok(factory.includes("createLiveDatamoonDecisionMakerDiscoveryAdapter"))
  assert.ok(factory.includes("cannot resolve an injected/stub"))
  assert.ok(factory.includes("assertProductionDatamoonDmDiscoveryAdapterIsLive"))

  const service = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-service.ts")
  assert.ok(service.includes("resolveDatamoonDmDiscoveryAdapter"))
  assert.ok(service.includes('runtime: "production"'))
  assert.ok(service.includes("useLiveDiscoveryAdapter"))
  assert.ok(!/apollo/i.test(service))

  const live = readSource("lib/growth/datamoon-decision-maker/datamoon-dm-discovery-live-adapter.ts")
  assert.ok(live.includes("buildAudience"))
  assert.ok(live.includes("fetchAudience"))
  assert.ok(live.includes("resolveDatamoonProviderFiltersForImport"))
  assert.ok(!/apollo/i.test(live))
  console.log("  ✓ production resolves live adapter; stub forbidden; reuses buildAudience/fetchAudience")
}

// --- Fail closed / no-waste gates ---
{
  const req = projectDecisionMakerRequirement({
    researchComplete: true,
    companyIdentityConfident: true,
    existingDecisionMakers: [],
    earnedEnrichmentSpend: true,
    investmentState: "increase_investment",
  })
  const stop = authorizeDatamoonPersonEnrichment({
    requirement: req,
    investmentState: "stop_investment",
    portfolioSelected: true,
    providerEnabled: true,
    providerConfigured: true,
    budgetAvailable: true,
  })
  assert.equal(stop.authorized, false)
  assert.equal(stop.denyReason, "stop_investment")

  const defer = authorizeDatamoonPersonEnrichment({
    requirement: req,
    investmentState: "increase_investment",
    portfolioSelected: false,
    providerEnabled: true,
    providerConfigured: true,
    budgetAvailable: true,
  })
  assert.equal(defer.authorized, false)
  assert.equal(defer.denyReason, "not_portfolio_selected")

  const disabled = authorizeDatamoonPersonEnrichment({
    requirement: req,
    investmentState: "increase_investment",
    portfolioSelected: true,
    providerEnabled: false,
    providerConfigured: true,
    budgetAvailable: true,
  })
  assert.equal(disabled.authorized, false)
  assert.equal(disabled.denyReason, "provider_disabled")

  const unconfigured = authorizeDatamoonPersonEnrichment({
    requirement: req,
    investmentState: "increase_investment",
    portfolioSelected: true,
    providerEnabled: true,
    providerConfigured: false,
    budgetAvailable: true,
  })
  assert.equal(unconfigured.authorized, false)
  assert.equal(unconfigured.denyReason, "provider_not_configured")

  const sufficient = projectDecisionMakerRequirement({
    researchComplete: true,
    companyIdentityConfident: true,
    existingDecisionMakers: [
      {
        fullName: "Sam Owner",
        title: "Owner",
        email: "sam@clinic.example",
        status: "confirmed",
        isPrimary: true,
        confidence: 0.9,
      },
    ],
    earnedEnrichmentSpend: true,
    investmentState: "increase_investment",
  })
  assert.equal(sufficient.existingPersonSufficient, true)
  console.log("  ✓ stop/defer/disabled/unconfigured fail closed; sufficient DM skips")
}

// --- Filters + title families ---
{
  const filters = buildDatamoonAudienceFiltersForDecisionMaker({
    companyName: "Imaging Example",
    titleFamilies: [...AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES].slice(0, 5),
  })
  assert.ok(filters.some((f) => f.field === "company_name"))
  assert.ok(filters.some((f) => f.field === "job_title"))
  assert.ok(AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES.includes("Owner"))
  assert.ok(AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES.includes("Service Manager"))
  assert.ok(AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES.includes("Clinical Engineering Director"))
  console.log("  ✓ company + title filters map; ICP title families present")
}

// --- Durable fingerprint / run name ---
{
  const fp = buildDatamoonDmDiscoveryCriteriaFingerprint({
    organizationId: "org-1",
    leadId: "lead-1",
    companyName: "Clinic",
    companyDomain: "clinic.example",
    titleFamilies: ["Owner", "CEO"],
  })
  assert.ok(fp.includes("org-1"))
  assert.ok(fp.includes("datamoon"))
  assert.ok(fp.includes("contact-1b-v1"))
  const runName = buildDatamoonDmDiscoveryRunName({
    organizationId: "org-1",
    leadId: "lead-1",
    criteriaFingerprint: fp,
  })
  assert.ok(runName.startsWith("dm-discovery:org-1:lead-1:"))
  assert.ok(DATAMOON_DM_DISCOVERY_POLL_POLICY.maxPollsPerRun >= 10)
  assert.ok(DATAMOON_DM_DISCOVERY_POLL_POLICY.minPollIntervalMs >= 1_000)
  console.log("  ✓ durable fingerprint + run name + poll policy bounded")
}

// --- Candidate normalize + CONTACT-1A channels + company mismatch ---
{
  const ranked = normalizeDatamoonRecordsToDecisionMakerCandidates({
    records: [
      {
        id: "good",
        first_name: "Alex",
        last_name: "Owner",
        title: "Owner",
        business_email: "alex@clinic.example",
        personal_phone: "5551234567",
        company_name: "Clinic Example",
        company_domain: "clinic.example",
      },
      {
        id: "wrong",
        first_name: "Other",
        last_name: "Co",
        title: "CEO",
        business_email: "ceo@other.example",
        company_name: "Other Corp",
        company_domain: "other.example",
      },
    ],
    expectedCompanyDomain: "clinic.example",
    expectedCompanyName: "Clinic Example",
  })
  const best = selectBestDatamoonDecisionMaker(ranked)
  assert.ok(best)
  assert.equal(best!.fullName, "Alex Owner")
  assert.ok((best!.emails?.length ?? 0) >= 1)
  assert.ok((best!.phones?.length ?? 0) >= 1)

  const wrong = ranked.find((c) => c.fullName === "Other Co")
  assert.ok(wrong)
  assert.ok(wrong!.companyMatchConfidence < 0.45 || wrong!.outcomeClass === "company_match_uncertain")

  const switchboard = extractDatamoonContactChannels({ company_phone: "5550001111" })
  assert.equal(switchboard.primaryPhone, null)
  console.log("  ✓ candidates normalize; best selected; wrong-company rejected; switchboard not direct")
}

// --- Provider pending / integrity ---
{
  const req = projectDecisionMakerRequirement({
    researchComplete: true,
    companyIdentityConfident: true,
    existingDecisionMakers: [],
    earnedEnrichmentSpend: true,
    investmentState: "increase_investment",
  })
  const auth = authorizeDatamoonPersonEnrichment({
    requirement: req,
    investmentState: "increase_investment",
    portfolioSelected: true,
    providerEnabled: true,
    providerConfigured: true,
    budgetAvailable: true,
  })
  const pending = decideDatamoonDecisionMakerEnrichment({
    organizationId: "org-1",
    leadId: "lead-1",
    requirement: req,
    authorization: auth,
    providerCalled: true,
    discoveryStatus: "pending",
    now: "2026-07-12T23:00:00.000Z",
  })
  assert.equal(pending.outcome, "provider_pending")
  assert.equal(pending.resumeDraftFactoryTo, "waiting_for_dm")

  const block = evaluateCanonicalPersonEmailPromotion({
    existing: {
      person_id: "p1",
      normalized_email: "a@b.co",
      confidence: 0.9,
      verification_status: "verified",
      metadata: {},
    },
    target_person_id: "p1",
    incoming_confidence: 0.2,
    incoming_verification_status: "unverified",
  })
  assert.equal(block.allowed, false)
  console.log("  ✓ provider_pending resumes waiting_for_dm; verified contacts retained")
}

// --- Events + DF wiring ---
{
  assert.ok(isRegisteredAiEventType("growth.datamoon.person_requested"))
  assert.ok(isRegisteredAiEventType("growth.datamoon.person_pending"))
  assert.ok(isRegisteredAiEventType("growth.datamoon.person_completed"))
  assert.ok(isRegisteredAiEventType("growth.datamoon.person_failed"))

  const pendingPlans = mapAiOsEventToDraftFactoryWakePlans(
    sampleEvent("growth.datamoon.person_pending", { idempotency_key: "k1" }),
  )
  assert.equal(pendingPlans[0]?.kind, "lead")
  if (pendingPlans[0]?.kind === "lead") {
    assert.equal(pendingPlans[0].wakeType, "datamoon_person_requested")
  }

  const completedPlans = mapAiOsEventToDraftFactoryWakePlans(
    sampleEvent("growth.datamoon.person_completed", { idempotency_key: "k1" }),
  )
  if (completedPlans[0]?.kind === "lead") {
    assert.equal(completedPlans[0].wakeType, "datamoon_person_completed")
  }

  const durableLive = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
  assert.ok(durableLive.includes("evaluateAndEnrichDecisionMakerForLead"))
  assert.ok(durableLive.includes("useLiveDiscoveryAdapter"))
  assert.ok(durableLive.includes("CONTACT-1B") || durableLive.includes("waiting_for_dm"))

  const dueTick = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
  assert.ok(dueTick.includes("pollDueDatamoonDmDiscoveriesForOrganization"))

  const emitters = readSource("lib/growth/draft-factory/draft-factory-wake-emitters.ts")
  assert.ok(emitters.includes("growth.datamoon.person_requested"))
  assert.ok(emitters.includes("growth.datamoon.person_pending"))
  assert.ok(emitters.includes("source_version"))

  assert.ok(!readSource("vercel.json").includes("datamoon-dm-discovery"))
  console.log("  ✓ events registered; durable DF + due tick wired; no new cron")
}

// --- 500-lead simulation capacity ---
{
  let authorized = 0
  let deferred = 0
  const capacity = 40
  for (let i = 0; i < 500; i += 1) {
    const portfolioSelected = i < capacity
    const budgetAvailable = i < capacity
    const auth = authorizeDatamoonPersonEnrichment({
      requirement: projectDecisionMakerRequirement({
        researchComplete: true,
        companyIdentityConfident: true,
        existingDecisionMakers: [],
        earnedEnrichmentSpend: true,
        investmentState: "increase_investment",
      }),
      investmentState: "increase_investment",
      portfolioSelected,
      providerEnabled: true,
      providerConfigured: true,
      budgetAvailable,
    })
    if (auth.authorized) authorized += 1
    else deferred += 1
  }
  assert.equal(authorized, capacity)
  assert.equal(deferred, 500 - capacity)
  console.log("  ✓ 500-lead simulation respects capacity/spend gates")
}

// --- Growth 5F / transport / no Apollo ---
{
  const corpus = [
    "lib/growth/datamoon-decision-maker/datamoon-dm-discovery-live-adapter.ts",
    "lib/growth/datamoon-decision-maker/datamoon-dm-discovery-factory.ts",
    "lib/growth/datamoon-decision-maker/datamoon-dm-discovery-durable-store.ts",
    "lib/growth/draft-factory/draft-factory-durable-live.ts",
  ]
    .map(readSource)
    .join("\n")
  assert.equal(/from \"@\/lib\/growth\/providers\/apollo|apollo_people_search/i.test(corpus), false)
  assert.ok(readSource("lib/growth/draft-factory/draft-factory-durable-live.ts").includes("buildAutonomousOutreachApprovalPackage"))
  assert.ok(readSource("lib/growth/draft-factory/draft-factory-durable-live.ts").includes("transportBlocked"))
  console.log("  ✓ Growth 5F remains draft generator; transport blocked; no Apollo")
}

assert.ok(fs.existsSync(path.join(ROOT, "docs/GE-AIOS-CONTACT-1B_LIVE_DATAMOON_DM_DISCOVERY.md")))
console.log(`[${PHASE}] PASS`)
