/** Revenue integrity certification route — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { certifyRevenuePersistenceIntegrity } from "@/lib/growth/revenue-integrity/revenue-integrity-certification"
import { buildRevenueIntegrityReadinessPayload } from "@/lib/growth/revenue-integrity/revenue-integrity-route-gates"
import { REVENUE_INTEGRITY_QA_MARKER } from "@/lib/growth/revenue-integrity/revenue-integrity-types"

export async function buildRevenueIntegrityReadiness(_admin: SupabaseClient) {
  return buildRevenueIntegrityReadinessPayload({ gates_ok: true, blockers: [] })
}

export async function executeRevenueIntegrityCertification(
  admin: SupabaseClient,
  input: {
    draft_id: string
    repair?: boolean
    dry_run?: boolean
    operator_email?: string | null
  },
) {
  const execution_id = randomUUID()

  if (input.dry_run) {
    const { investigateOpportunityDraftPersistence } = await import(
      "@/lib/growth/revenue-integrity/investigate-opportunity-draft-persistence"
    )
    const investigation = await investigateOpportunityDraftPersistence(admin, input.draft_id)
    return {
      ok: investigation.scenario === "healthy",
      execution_id,
      qa_marker: REVENUE_INTEGRITY_QA_MARKER,
      dry_run: true,
      investigation,
      blockers: investigation.scenario === "healthy" ? [] : [`scenario:${investigation.scenario}`],
    }
  }

  const certification = await certifyRevenuePersistenceIntegrity(admin, {
    draft_id: input.draft_id,
    repair: input.repair === true,
    operator_email: input.operator_email,
  })

  return {
    ok: certification.certified,
    execution_id,
    qa_marker: REVENUE_INTEGRITY_QA_MARKER,
    certification,
    blockers: certification.blockers,
  }
}
