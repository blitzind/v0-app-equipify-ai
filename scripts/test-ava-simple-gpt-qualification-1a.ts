/**
 * AVA-SIMPLE-GPT-QUALIFICATION-1A — Certification (includes evidence-gate amendment).
 *
 *   pnpm test:ava-simple-gpt-qualification-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY,
  AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
  resetAutonomousDiscoveryGptQualificationInFlightForTests,
  shouldScheduleAutonomousDiscoveryGptQualification,
} from "@/lib/growth/ava-reasoning/ava-autonomous-discovery-gpt-qualification-1a"
import {
  buildAutonomousDiscoveryEvidenceText,
} from "@/lib/growth/ava-reasoning/ava-autonomous-discovery-evidence-1a"
import { evaluateGrowthLeadAdmission } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  DATAMOON_B2B_COMPANY_IDENTITY_FIELDS,
  GROWTH_DATAMOON_COMPANY_IDENTITY_RESOLUTION_1A_QA_MARKER,
  resolveDatamoonCredibleCompanyIdentity,
} from "@/lib/growth/lead-sources/datamoon/datamoon-company-identity-resolution-1a"
import {
  filterDatamoonRecordToExtFields,
  normalizeDatamoonAudienceRecord,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import { recordsToProspectCompanies } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import { buildProspectSearchPushMetadata } from "@/lib/growth/prospect-search/prospect-search-push-metadata"
import { isSendableAvaSupervisedDraft } from "@/lib/growth/ava-reasoning/equipify-supervised-draft-persistence"

const CERT_ID = AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER
const ROOT = process.cwd()
const LEAD_ID = "11111111-1111-4111-8111-111111111111"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleLeadMetadata() {
  return {
    [AVA_AUTONOMOUS_DISCOVERY_GPT_QUALIFICATION_METADATA_KEY]: AVA_SIMPLE_GPT_QUALIFICATION_1A_QA_MARKER,
    datamoon: {
      companyName: "Acme Service Co",
      companyDomain: "acmeservice.com",
      contactName: "Laura Morgan",
      contactTitle: "Director of Operations",
      contactEmail: "laura@acmeservice.com",
    },
    prospect_search: {
      query: "equipment service companies",
      source_id: "domain:acmeservice.com",
    },
  }
}

async function main() {
  console.log(`[${CERT_ID}] certification\n`)

  assert.equal(GROWTH_DATAMOON_COMPANY_IDENTITY_RESOLUTION_1A_QA_MARKER.includes("ava-simple-gpt-qualification"), true)
  assert.ok(DATAMOON_B2B_COMPANY_IDENTITY_FIELDS.includes("company_name"))
  assert.ok(DATAMOON_B2B_COMPANY_IDENTITY_FIELDS.includes("company_domain"))

  const extFiltered = filterDatamoonRecordToExtFields({
    first_name: "Laura",
    last_name: "Morgan",
    company_name: "Acme Service Co",
    company_domain: "acmeservice.com",
    job_title: "Operations Director",
  })
  assert.equal(extFiltered.company_name, undefined)

  const b2bNormalized = normalizeDatamoonAudienceRecord(
    {
      first_name: "Laura",
      last_name: "Morgan",
      company_name: "Acme Service Co",
      company_domain: "acmeservice.com",
      job_title: "Operations Director",
      business_email: "laura@acmeservice.com",
    },
    { providerMode: "ext", audienceType: "b2b" },
  )
  assert.equal(b2bNormalized.company_name, "Acme Service Co")
  assert.equal(b2bNormalized.company_domain, "acmeservice.com")
  console.log("  ✓ B2B normalization preserves company identity fields under ext provider mode")

  const contactOnly = resolveDatamoonCredibleCompanyIdentity(
    normalizeDatamoonAudienceRecord(
      { first_name: "Laura", last_name: "Morgan", personal_emails: "laura@gmail.com" },
      { providerMode: "ext" },
    ),
  )
  assert.equal(contactOnly.state, "insufficient_identity")
  console.log("  ✓ Contact-only records classify as insufficient_identity before GPT")

  const evidenceWithWebsite = buildAutonomousDiscoveryEvidenceText({
    companyName: "Acme Service Co",
    website: "https://acmeservice.com",
    websiteRetrieval: {
      ok: true,
      normalizedUrl: "https://acmeservice.com",
      text: "We service commercial kitchen equipment.",
      sourceUrls: ["https://acmeservice.com"],
      charCount: 42,
      code: null,
      message: null,
    },
    metadata: sampleLeadMetadata(),
  })
  assert.match(evidenceWithWebsite, /Acme Service Co/)
  assert.match(evidenceWithWebsite, /commercial kitchen equipment/)
  assert.match(evidenceWithWebsite, /DataMoon discovery context/)
  console.log("  ✓ Credible company + website success → evidence packet includes website + DataMoon")

  const evidenceFetchFailed = buildAutonomousDiscoveryEvidenceText({
    companyName: "Acme Service Co",
    website: "https://acmeservice.com",
    websiteRetrieval: {
      ok: false,
      normalizedUrl: "https://acmeservice.com",
      text: "",
      sourceUrls: [],
      charCount: 0,
      code: "fetch_failed",
      message: "Homepage fetch failed.",
    },
    metadata: sampleLeadMetadata(),
  })
  assert.match(evidenceFetchFailed, /Homepage content was not retrieved successfully/)
  assert.match(evidenceFetchFailed, /DataMoon discovery context/)
  assert.doesNotMatch(evidenceFetchFailed, /commercial kitchen equipment/)
  console.log("  ✓ Credible company + website fetch failure → evidence packet still built for GPT")

  const evidenceNoWebsite = buildAutonomousDiscoveryEvidenceText({
    companyName: "Acme Service Co",
    website: null,
    websiteRetrieval: null,
    metadata: sampleLeadMetadata(),
  })
  assert.match(evidenceNoWebsite, /No company website URL is available/)
  assert.match(evidenceNoWebsite, /Laura Morgan/)
  console.log("  ✓ Credible company + no websiteText → evidence packet uses available inputs")

  const cutoverSrc = readSource("lib/growth/ava-reasoning/equipify-supervised-cutover-service.ts")
  assert.match(cutoverSrc, /websiteEvidenceOptional/)
  assert.match(cutoverSrc, /buildAutonomousDiscoveryEvidenceText/)
  assert.match(cutoverSrc, /ava_direct_cutover_website_retrieval_optional_failed/)
  assert.match(cutoverSrc, /if \(!input\.websiteEvidenceOptional\)/)
  console.log("  ✓ Website retrieval is enrichment only on autonomous GPT path")

  const qualificationSrc = readSource("lib/growth/ava-reasoning/ava-autonomous-discovery-gpt-qualification-1a.ts")
  assert.match(qualificationSrc, /websiteEvidenceOptional:\s*true/)
  assert.match(qualificationSrc, /evaluation_started_at/)
  assert.match(qualificationSrc, /inFlightQualifications/)
  assert.match(qualificationSrc, /missing_information/)
  console.log("  ✓ Autonomous qualification invokes optional-website GPT + idempotency guards")

  const gptPathAdmission = evaluateGrowthLeadAdmission(
    {
      companyName: "Acme Service Co",
      website: null,
      domain: null,
      industry: "Oil and Gas",
      email: "laura@acmeservice.com",
      contactName: "Laura Morgan",
      identityUncertain: false,
      source: "datamoon",
      metadata: {},
    },
    { approvedProfile: null, activeMissionTitle: null },
    { autonomousGptQualificationPath: true },
  )
  assert.equal(gptPathAdmission.state, "accepted")
  assert.equal(gptPathAdmission.reasons.includes("pending_operational_keyword_validation"), false)
  console.log("  ✓ No deterministic keyword/industry gate precedes GPT path")

  assert.equal(isSendableAvaSupervisedDraft({
    decision: "pursue",
    email: { subject: "Hi", body: "Hello" },
    recommendedContact: { contactId: "c1", name: "Laura", email: "laura@acmeservice.com", title: null },
    contactsSupplied: [{
      contactId: "c1",
      name: "Laura",
      email: "laura@acmeservice.com",
      title: null,
      contactabilityStatus: "contactable",
    }],
  }), true)
  assert.equal(isSendableAvaSupervisedDraft({
    decision: "reject",
    email: null,
    recommendedContact: null,
    contactsSupplied: [],
  }), false)
  assert.equal(isSendableAvaSupervisedDraft({
    decision: "hold",
    email: null,
    recommendedContact: null,
    contactsSupplied: [],
  }), false)
  console.log("  ✓ Pursue creates sendable draft; reject/hold do not")

  assert.equal(
    shouldScheduleAutonomousDiscoveryGptQualification({
      id: LEAD_ID,
      status: "new",
      metadata: sampleLeadMetadata(),
    } as never),
    true,
  )
  assert.equal(
    shouldScheduleAutonomousDiscoveryGptQualification({
      id: LEAD_ID,
      status: "new",
      metadata: {
        ...sampleLeadMetadata(),
        ava_gpt_qualification: { evaluated_at: "2026-07-28T00:00:00.000Z" },
      },
    } as never),
    false,
  )
  assert.equal(
    shouldScheduleAutonomousDiscoveryGptQualification({
      id: LEAD_ID,
      status: "new",
      metadata: {
        ...sampleLeadMetadata(),
        ava_gpt_qualification: { evaluation_started_at: new Date().toISOString() },
      },
    } as never),
    false,
  )
  console.log("  ✓ Completed or in-flight qualification prevents duplicate scheduling")

  resetAutonomousDiscoveryGptQualificationInFlightForTests()
  assert.match(qualificationSrc, /inFlightQualifications\.get\(input\.leadId\)/)
  assert.match(qualificationSrc, /already_inflight_or_completed/)
  console.log("  ✓ Duplicate invocation guarded by process-local in-flight map + evaluation_started_at")

  assert.doesNotMatch(
    readSource("lib/growth/ava-reasoning/ava-autonomous-discovery-gpt-qualification-1a.ts"),
    /sendOutbound|approveFirstTouch|delivery_attempts/i,
  )
  console.log("  ✓ Safety guard — no approval/send path")

  console.log(`\n[${CERT_ID}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
