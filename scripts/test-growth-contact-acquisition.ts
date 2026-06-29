/**
 * GE-IRE-7A — Native Contact Acquisition Engine certification.
 * Run: pnpm test:growth-contact-acquisition
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { recommendAccountOutreach } from "../lib/growth/contact-verification/account-outreach-recommendation"
import {
  buildAcquisitionCandidate,
  computeAcquisitionOverallConfidence,
  rankAcquisitionBackupContacts,
  type ContactAcquisitionEngineDependencies,
} from "../lib/growth/contact-verification/contact-acquisition-engine"
import {
  isContactAcquisitionEnabled,
  isContactAcquisitionEnabledClient,
  GROWTH_CONTACT_ACQUISITION_PANEL_QA_MARKER,
} from "../lib/growth/contact-verification/contact-acquisition-feature"
import {
  CONTACT_ACQUISITION_CONFIDENCE_WEIGHTING,
  GROWTH_CONTACT_ACQUISITION_QA_MARKER,
} from "../lib/growth/contact-verification/contact-acquisition-types"
import {
  assertAcquisitionCandidateViewHasNoSensitiveData,
  buildAcquisitionCandidateView,
  sanitizeAcquisitionCandidateView,
} from "../lib/growth/contact-verification/contact-acquisition-view"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function withEnv<T>(overrides: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(overrides)) {
    saved.set(key, process.env[key])
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of saved.entries()) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }) as Promise<T>
}

const FIXTURE_INPUT = {
  companyId: "company-fixture-001",
  companyName: "Precision Biomedical",
  domain: "precisionbiomedical.com",
  industry: "healthcare",
  targetUseCase: "service_operations" as const,
  generatedAt: "2026-06-28T00:00:00.000Z",
  contacts: [
    {
      personId: "person-001",
      firstName: "Chris",
      lastName: "Taylor",
      jobTitle: "VP Operations",
      department: "operations",
      email: "chris.taylor@precisionbiomedical.com",
      phone: "+1-555-0100",
      linkedinUrl: "https://linkedin.com/in/chris-taylor",
    },
    {
      personId: "person-002",
      firstName: "Pat",
      lastName: "Reed",
      jobTitle: "Procurement Manager",
      department: "finance",
      email: "pat.reed@precisionbiomedical.com",
    },
  ],
}

async function main(): Promise<void> {
  console.log("\n=== GE-IRE-7A Contact Acquisition Engine Certification ===\n")

  assert.equal(GROWTH_CONTACT_ACQUISITION_QA_MARKER, "contact-acquisition-engine-v1")
  assert.equal(CONTACT_ACQUISITION_CONFIDENCE_WEIGHTING.version, "cae-v1")
  assert.equal(isContactAcquisitionEnabled(), false)
  assert.equal(isContactAcquisitionEnabled({ GROWTH_CONTACT_ACQUISITION: "true" }), true)
  assert.equal(isContactAcquisitionEnabledClient(), false)
  console.log("  ✓ Feature flag false by default")

  const engineSource = readSource("lib/growth/contact-verification/contact-acquisition-engine.ts")
  assert.match(engineSource, /resolveEmailIdentity/)
  assert.match(engineSource, /verifyEmailNatively/)
  assert.match(engineSource, /recommendContacts/)
  assert.match(engineSource, /analyzeBuyingCommittee/)
  assert.match(engineSource, /recommendAccountOutreach/)
  assert.doesNotMatch(engineSource, /openai/i)
  assert.doesNotMatch(engineSource, /zerobounce/i)
  console.log("  ✓ Engine orchestrates all five deterministic layers without AI/providers")

  let identityCalls = 0
  let verificationCalls = 0
  let recommendationCalls = 0
  let committeeCalls = 0
  let outreachCalls = 0

  const dependencies: ContactAcquisitionEngineDependencies = {
    skipDns: true,
    resolveEmailIdentity: async (...args) => {
      identityCalls += 1
      const { resolveEmailIdentity } = await import(
        "../lib/growth/contact-verification/identity-resolution-engine"
      )
      return resolveEmailIdentity(...args)
    },
    verifyEmailNatively: async (...args) => {
      verificationCalls += 1
      const { verifyEmailNatively } = await import(
        "../lib/growth/contact-verification/native-email-verification"
      )
      return verifyEmailNatively(...args)
    },
    recommendContacts: async (...args) => {
      recommendationCalls += 1
      const { recommendContacts } = await import(
        "../lib/growth/contact-verification/contact-recommendation-engine"
      )
      return recommendContacts(...args)
    },
    analyzeBuyingCommittee: async (...args) => {
      committeeCalls += 1
      const { analyzeBuyingCommittee } = await import(
        "../lib/growth/contact-verification/buying-committee-intelligence"
      )
      return analyzeBuyingCommittee(...args)
    },
    recommendAccountOutreach: async (...args) => {
      outreachCalls += 1
      return recommendAccountOutreach(...args)
    },
  }

  const first = await buildAcquisitionCandidate(FIXTURE_INPUT, dependencies)
  const second = await buildAcquisitionCandidate(FIXTURE_INPUT, dependencies)

  assert.ok(identityCalls >= 1)
  assert.ok(verificationCalls >= 1)
  assert.equal(recommendationCalls, 2)
  assert.equal(committeeCalls, 2)
  assert.equal(outreachCalls, 2)
  console.log("  ✓ All intelligence layers invoked through engine dependencies")

  assert.equal(first.version, 1)
  assert.equal(first.companyId, FIXTURE_INPUT.companyId)
  assert.equal(first.generatedAt, FIXTURE_INPUT.generatedAt)
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  assert.ok(first.primaryContact.fullName.length > 0)
  assert.ok(first.overallConfidence >= 0 && first.overallConfidence <= 100)
  console.log("  ✓ Deterministic acquisition candidate with stable confidence")

  const weighted = computeAcquisitionOverallConfidence({
    identityScore: 80,
    verificationScore: 70,
    committeeScore: 60,
    recommendationScore: 75,
    outreachReadinessScore: 65,
  })
  assert.equal(weighted, 71)
  console.log("  ✓ Confidence weighting helper produces normalized score")

  const outreach = await recommendAccountOutreach(FIXTURE_INPUT, { skipDns: true })
  const backups = rankAcquisitionBackupContacts({
    outreach,
    contacts: FIXTURE_INPUT.contacts,
  })
  if (backups.length >= 2) {
    assert.ok(backups[0].confidence >= backups[backups.length - 1].confidence)
  }
  assert.ok(backups.every((row) => row.reasonSelected.length > 0))
  console.log("  ✓ Backup contacts ranked with reasonSelected")

  assert.ok(first.blockers.every((blocker) => !blocker.includes("_")))
  assert.ok(first.reasons.length > 0)
  console.log("  ✓ Human-readable blockers and deterministic reasons")

  await withEnv({ GROWTH_CONTACT_ACQUISITION: undefined }, async () => {
    const disabled = await buildAcquisitionCandidateView(FIXTURE_INPUT, { skipDns: true })
    assert.equal(disabled, null)
  })

  const view = await withEnv({ GROWTH_CONTACT_ACQUISITION: "true" }, async () =>
    buildAcquisitionCandidateView(FIXTURE_INPUT, { skipDns: true }),
  )
  assert.ok(view)
  assert.equal(view?.qa_marker, GROWTH_CONTACT_ACQUISITION_PANEL_QA_MARKER)

  const sanitized = sanitizeAcquisitionCandidateView(first, {
    visibleEmails: ["chris.taylor@precisionbiomedical.com"],
  })
  assert.equal(sanitized.primary_contact.email, "chris.taylor@precisionbiomedical.com")
  assert.ok(
    assertAcquisitionCandidateViewHasNoSensitiveData(sanitized, {
      allowEmails: ["chris.taylor@precisionbiomedical.com"],
    }),
  )
  console.log("  ✓ UI view sanitization masks non-visible emails")

  const panelSource = readSource(
    "components/growth/prospect-search/prospect-search-acquisition-candidate-panel.tsx",
  )
  assert.match(panelSource, /isContactAcquisitionEnabledClient/)
  assert.match(panelSource, /if \(!panelEnabled\) return null/)
  assert.match(panelSource, /Collapsible/)
  assert.match(panelSource, /contact-acquisition/)
  assert.match(panelSource, /data-contact-acquisition-panel="read-only"/)
  console.log("  ✓ Prospect Search panel is feature-flagged, collapsible, lazy-loaded, read-only")

  const intelligencePanelSource = readSource(
    "components/growth/prospect-search/company-contact-intelligence-panel.tsx",
  )
  assert.match(intelligencePanelSource, /ProspectSearchAcquisitionCandidatePanel/)
  assert.match(intelligencePanelSource, /ProspectSearchAccountOutreachStrategyPanel/)
  console.log("  ✓ Panel mounted beneath Account Outreach Strategy")

  const apiSource = readSource(
    "app/api/platform/growth/prospect-search/contact-acquisition/route.ts",
  )
  assert.match(apiSource, /companyId/)
  assert.match(apiSource, /isContactAcquisitionEnabled/)
  assert.match(apiSource, /acquisition_disabled/)
  assert.ok(!apiSource.includes("supabase.from"))
  assert.ok(!apiSource.includes(".insert("))
  assert.ok(!apiSource.includes(".update("))
  console.log("  ✓ Diagnostic API accepts companyId, gated, read-only, no persistence")

  const nextConfig = readSource("next.config.mjs")
  assert.match(nextConfig, /NEXT_PUBLIC_GROWTH_CONTACT_ACQUISITION/)
  console.log("  ✓ Client env exposure in next.config")

  console.log("\nGE-IRE-7A contact acquisition engine certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
