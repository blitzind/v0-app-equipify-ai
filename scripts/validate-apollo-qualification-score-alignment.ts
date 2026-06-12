/**
 * Production validation — recovery / pilot / enrollment qualification score alignment.
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/validate-apollo-qualification-score-alignment.ts
 */
import { createClient } from "@supabase/supabase-js"
import { analyzeApollo25CompanyPilotCompanyEligibility } from "@/lib/growth/apollo/apollo-25-company-pilot-selection"
import { summarizeApolloOperatorReviewForQualification } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import { evaluateApolloEnrollmentQualification } from "@/lib/growth/apollo/apollo-enrollment-qualification-engine"
import { buildApolloIntelligenceRecoveryScoreDecompositionRow } from "@/lib/growth/apollo/apollo-intelligence-recovery-qualification"
import { loadApolloPrimaryContactOperatorReviewSnapshot } from "@/lib/growth/apollo/apollo-primary-contact-operator-review"
import { loadApolloQualificationScoringContextForCompany } from "@/lib/growth/apollo/apollo-qualification-scoring-context"
import {
  applyApolloQualificationScoringContextToSelectionInput,
  buildApolloEnrollmentQualificationInputFromScoringContext,
} from "@/lib/growth/apollo/apollo-qualification-scoring-context-helpers"
import { bootstrapVerifiedChannelsCertEnv } from "@/lib/growth/qa/verified-channels-cert-env-bootstrap"

const COMPANY_QUERIES: Array<{ label: string; search: string }> = [
  { label: "Absolute Electric LLC", search: "Absolute Electric LLC" },
  { label: "Absolute Heating & Air", search: "Absolute Heating & Air" },
  { label: "Auxo Medical", search: "Auxo Medical" },
  { label: "Sierra Biomed", search: "Sierra Biomed" },
  { label: "Henry Schein", search: "Henry Schein" },
]

const PILOT_COHORT_ID = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"
const THRESHOLD = 70

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function findCompanyCandidateId(
  admin: ReturnType<typeof createClient>,
  search: string,
): Promise<{ company_candidate_id: string; canonical_company_id: string | null; domain: string | null } | null> {
  for (const table of ["external_company_candidates", "real_world_company_candidates", "discovery_candidates"]) {
    const { data: rows } = await admin
      .schema("growth")
      .from(table)
      .select("id, company_name, canonical_company_id, domain, website")
      .ilike("company_name", `%${search}%`)
      .limit(5)

    const row =
      (rows ?? []).find((candidate) => asString(candidate.company_name).includes(search)) ?? rows?.[0]
    if (row?.id) {
      return {
        company_candidate_id: asString(row.id),
        canonical_company_id: asString(row.canonical_company_id) || null,
        domain: asString(row.domain) || asString(row.website) || null,
      }
    }
  }
  return null
}

async function main() {
  const boot = bootstrapVerifiedChannelsCertEnv()
  if (!boot) {
    console.log(JSON.stringify({ error: "no_credentials" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const results: Record<string, unknown>[] = []

  for (const { label, search } of COMPANY_QUERIES) {
    const found = await findCompanyCandidateId(admin, search)
    if (!found) {
      results.push({ company_name: label, error: "company_candidate_not_found" })
      continue
    }

    const { company_candidate_id, canonical_company_id: rowCanonicalId, domain: rowDomain } = found
    const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, company_candidate_id)
    if (!snapshot) {
      results.push({ company_name: label, error: "operator_review_snapshot_missing" })
      continue
    }

    const summary = summarizeApolloOperatorReviewForQualification(snapshot)
    const scoringContext = await loadApolloQualificationScoringContextForCompany(admin, {
      company_candidate_id,
      canonical_company_id: snapshot.canonical_company_id ?? rowCanonicalId,
    })

    const recoveryRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
      company_candidate_id,
      company_name: label,
      contacts: snapshot.contacts,
      snapshot_summary: summary,
      qualificationContext: scoringContext,
      production_threshold: THRESHOLD,
    })

    const pilotInput = applyApolloQualificationScoringContextToSelectionInput(
      {
        company_candidate_id,
        company_name: label,
        domain: snapshot.domain ?? rowDomain ?? "",
        contacts: snapshot.contacts,
        snapshot_summary: summary,
        enrollment_status: null,
        has_active_sequence_enrollment: false,
        in_active_pilot_cohort: false,
        canonical_company_id: snapshot.canonical_company_id,
      },
      scoringContext,
    )
    const pilotAnalysis = analyzeApollo25CompanyPilotCompanyEligibility(
      pilotInput,
      THRESHOLD,
      "greenfield",
    )

    const sequenceReadyContacts = snapshot.contacts.filter(
      (contact) => contact.sequence_ready && contact.contactable,
    )
    const enrollmentContact = sequenceReadyContacts[0] ?? snapshot.contacts[0]
    let enrollment_score = 0
    if (enrollmentContact) {
      const qualification = evaluateApolloEnrollmentQualification(
        buildApolloEnrollmentQualificationInputFromScoringContext({
          snapshot_summary: summary,
          contact: enrollmentContact,
          context: scoringContext,
          verified_email_source: "apollo_search_verified_email",
          enrichment_source: "apollo_enrollment_cert",
        }),
        { threshold: THRESHOLD },
      )
      enrollment_score = qualification.qualification_score
    }

    results.push({
      company_name: label,
      recovery_score: recoveryRow.current_score,
      pilot_score: pilotAnalysis.score,
      enrollment_score,
      company_intelligence_present: scoringContext.company_intelligence_present,
      buying_committee_present: scoringContext.buying_committee_present,
    })
  }

  const { data: cohortCompanies, error: cohortError } = await admin
    .schema("growth")
    .from("apollo_pilot_cohort_companies")
    .select("company_candidate_id, company_name")
    .eq("cohort_id", PILOT_COHORT_ID)

  if (cohortError) {
    results.push({ cohort_validation_error: cohortError.message })
  } else {
    for (const cohortRow of cohortCompanies ?? []) {
      const cohortName = asString(cohortRow.company_name)
      if (!COMPANY_QUERIES.some((query) => query.label === cohortName || cohortName.includes(query.search))) continue

      const cohortCompanyId = asString(cohortRow.company_candidate_id)
      const snapshot = await loadApolloPrimaryContactOperatorReviewSnapshot(admin, cohortCompanyId)
      if (!snapshot) continue

      const summary = summarizeApolloOperatorReviewForQualification(snapshot)
      const scoringContext = await loadApolloQualificationScoringContextForCompany(admin, {
        company_candidate_id: cohortCompanyId,
        canonical_company_id: snapshot.canonical_company_id,
      })
      const recoveryRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
        company_candidate_id: cohortCompanyId,
        company_name: cohortName,
        contacts: snapshot.contacts,
        snapshot_summary: summary,
        qualificationContext: scoringContext,
        production_threshold: THRESHOLD,
      })
      const pilotInput = applyApolloQualificationScoringContextToSelectionInput(
        {
          company_candidate_id: cohortCompanyId,
          company_name: cohortName,
          domain: snapshot.domain ?? "",
          contacts: snapshot.contacts,
          snapshot_summary: summary,
          enrollment_status: null,
          has_active_sequence_enrollment: false,
          in_active_pilot_cohort: false,
          canonical_company_id: snapshot.canonical_company_id,
        },
        scoringContext,
      )
      const pilotAnalysis = analyzeApollo25CompanyPilotCompanyEligibility(
        pilotInput,
        THRESHOLD,
        "greenfield",
      )
      const enrollmentContact =
        snapshot.contacts.find((contact) => contact.sequence_ready && contact.contactable) ??
        snapshot.contacts[0]
      let enrollment_score = 0
      if (enrollmentContact) {
        enrollment_score = evaluateApolloEnrollmentQualification(
          buildApolloEnrollmentQualificationInputFromScoringContext({
            snapshot_summary: summary,
            contact: enrollmentContact,
            context: scoringContext,
            verified_email_source: "apollo_search_verified_email",
            enrichment_source: "apollo_enrollment_cert",
          }),
          { threshold: THRESHOLD },
        ).qualification_score
      }

      const existing = results.find((row) => row.company_name === cohortName)
      if (existing) {
        existing.recovery_score = recoveryRow.current_score
        existing.pilot_score = pilotAnalysis.score
        existing.enrollment_score = enrollment_score
      } else {
        results.push({
          company_name: cohortName,
          recovery_score: recoveryRow.current_score,
          pilot_score: pilotAnalysis.score,
          enrollment_score,
        })
      }
    }
  }

  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
