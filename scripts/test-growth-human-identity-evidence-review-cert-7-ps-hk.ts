/**
 * Phase 7.PS-HK — Human identity evidence review certification.
 * Run: pnpm test:growth-human-identity-evidence-review-cert-7-ps-hk
 */
import { createClient } from "@supabase/supabase-js"
import { submitHumanIdentityEvidenceReview } from "../lib/growth/human-identity-evidence/human-identity-evidence-review"
import { loadHumanIdentityEvidenceQueue } from "../lib/growth/human-identity-evidence/human-identity-evidence-queue"
import { GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER } from "../lib/growth/human-identity-evidence/human-identity-evidence-types"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const TARGETS = [
  {
    company_id: "3620d561-8568-4104-a878-898bfec618ca",
    person_id: "dd551823-7adc-4637-817f-4989a30f108e",
    name: "Emergency Repair Biomedical",
  },
  {
    company_id: "4456d3c3-900a-468f-ac33-aadabac67e52",
    person_id: "1e08ba6f-b820-497f-a0f8-19dca37887f7",
    name: "Biomedical Repair Service",
  },
  {
    company_id: "dcf0c09b-c636-4f82-b511-2af45076630e",
    person_id: "ece67a39-e12e-4dc7-8c51-99274e0b13b4",
    name: "ERS Biomedical Services",
  },
] as const

async function countVerifiedPhones(admin: ReturnType<typeof createClient>, person_id: string) {
  const { data } = await admin
    .schema("growth")
    .from("person_phones")
    .select("id, verification_status, confidence")
    .eq("person_id", person_id)
  return {
    total: data?.length ?? 0,
    verified: (data ?? []).filter((r) => r.verification_status === "verified").length,
  }
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ certification: "FAIL", error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const companyIds = TARGETS.map((t) => t.company_id)
  const queue = await loadHumanIdentityEvidenceQueue(admin, { company_ids: [...companyIds], limit: 20 })

  const results = []
  let passCount = 0

  for (const target of TARGETS) {
    const queueItem = queue.find((q) => q.canonical_person_id === target.person_id)
    const { data: contact } = await admin
      .schema("growth")
      .from("company_contacts")
      .select("id, contact_status, phone_status, source_evidence, metadata, phone")
      .eq("canonical_person_id", target.person_id)
      .maybeSingle()

    const beforePhones = await countVerifiedPhones(admin, target.person_id)

    let reviewResult = null as Awaited<ReturnType<typeof submitHumanIdentityEvidenceReview>> | null

    if (contact?.id && contact.contact_status === "candidate") {
      reviewResult = await submitHumanIdentityEvidenceReview(admin, {
        company_contact_id: String(contact.id),
        actions: ["mark_contact_verified", "mark_phone_verified"],
        review_note: "7.PS-HK cert — operator reviewed existing team_page phone evidence",
        rerun_phone_discovery: true,
        reviewer_email: "cert-7-ps-hk@equipify.internal",
      })
    } else if (contact?.id) {
      const { runPhoneDiscoveryForCanonicalPerson } = await import(
        "../lib/growth/phone-discovery/phone-discovery-orchestrator"
      )
      const rediscovery = await runPhoneDiscoveryForCanonicalPerson(admin, {
        company_id: target.company_id,
        person_id: target.person_id,
        promote: true,
      })
      reviewResult = {
        ok: rediscovery.promoted_count > 0,
        review_id: null,
        company_contact_id: String(contact.id),
        fields_changed: [],
        previous_values: {},
        new_values: {},
        phone_discovery: {
          run_id: rediscovery.run_id,
          verified_count: rediscovery.verified_count,
          promoted_count: rediscovery.promoted_count,
        },
        error: rediscovery.promoted_count > 0 ? undefined : "already_reviewed_but_no_promotion",
      }
    }

    const afterPhones = await countVerifiedPhones(admin, target.person_id)

    const promoted = (reviewResult?.phone_discovery?.promoted_count ?? 0) > 0
    const verifiedRun = (reviewResult?.phone_discovery?.verified_count ?? 0) > 0
    const pass = promoted && afterPhones.verified > beforePhones.verified

    if (pass) passCount += 1

    const { data: latestCandidate } = reviewResult?.phone_discovery?.run_id
      ? await admin
          .schema("growth")
          .from("phone_discovery_candidates")
          .select("verification_status, confidence, promotion_status")
          .eq("run_id", reviewResult.phone_discovery.run_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null }

    results.push({
      company: target.name,
      queue_priority: queueItem?.priority_score ?? null,
      contact_id: contact?.id ?? null,
      has_evidence:
        (Array.isArray(contact?.source_evidence) && contact.source_evidence.length > 0) ||
        Boolean(
          contact?.metadata &&
            typeof contact.metadata === "object" &&
            (contact.metadata as Record<string, unknown>).source_page_url,
        ),
      before_verified_phones: beforePhones.verified,
      after_verified_phones: afterPhones.verified,
      review: reviewResult,
      latest_candidate: latestCandidate,
      pass,
    })
  }

  const certification = passCount === TARGETS.length ? "PASS" : passCount > 0 ? "PASS_PARTIAL" : "FAIL"

  console.log(
    JSON.stringify(
      {
        qa_marker: GROWTH_HUMAN_IDENTITY_EVIDENCE_QA_MARKER,
        certification,
        pass_count: passCount,
        target_count: TARGETS.length,
        queue_size: queue.length,
        results,
      },
      null,
      2,
    ),
  )

  process.exit(certification === "PASS" ? 0 : 1)
}

void main()
