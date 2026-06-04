import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthPhoneDiscoveryOperatorStatus } from "@/lib/growth/phone-discovery/phone-discovery-types"
import { personHasVerifiedPhone } from "@/lib/growth/phone-discovery/phone-discovery-person-phone-integrity"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** 7.4A — run-based status only (no job queue until 7.4B). */
export async function loadPhoneDiscoveryOperatorStatus(
  admin: SupabaseClient,
  input: { company_id: string; person_id: string },
): Promise<GrowthPhoneDiscoveryOperatorStatus | null> {
  const company_id = asString(input.company_id)
  const person_id = asString(input.person_id)
  if (!company_id || !person_id) return null

  const { data: role } = await admin
    .schema("growth")
    .from("person_company_roles")
    .select("id")
    .eq("company_id", company_id)
    .eq("person_id", person_id)
    .limit(1)
    .maybeSingle()
  if (!role) return null

  const has_verified_phone = await personHasVerifiedPhone(admin, person_id)

  const { data: verifiedPhone } = await admin
    .schema("growth")
    .from("person_phones")
    .select("phone, normalized_phone")
    .eq("person_id", person_id)
    .in("verification_status", ["verified", "operator_verified"])
    .order("is_primary", { ascending: false })
    .order("confidence", { ascending: false })
    .limit(1)
    .maybeSingle()

  const verified_phone =
    (typeof verifiedPhone?.phone === "string" && verifiedPhone.phone) ||
    (typeof verifiedPhone?.normalized_phone === "string" && verifiedPhone.normalized_phone) ||
    null

  const { data: lastRun } = await admin
    .schema("growth")
    .from("phone_discovery_runs")
    .select("id, status, completed_at, started_at, created_at")
    .eq("company_id", company_id)
    .eq("person_id", person_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let evidence_count = 0
  if (lastRun?.id) {
    const { data: candidateRows } = await admin
      .schema("growth")
      .from("phone_discovery_candidates")
      .select("id")
      .eq("run_id", lastRun.id)
    const candidateIds = (candidateRows ?? []).map((r) => asString(r.id)).filter(Boolean)
    if (candidateIds.length > 0) {
      const { count } = await admin
        .schema("growth")
        .from("phone_discovery_evidence")
        .select("id", { count: "exact", head: true })
        .in("candidate_id", candidateIds)
      evidence_count = count ?? 0
    }
  }

  const last_run_status = lastRun?.status ? asString(lastRun.status) : null
  const last_run_at =
    asString(lastRun?.completed_at) || asString(lastRun?.started_at) || asString(lastRun?.created_at) || null

  let discovery_status: GrowthPhoneDiscoveryOperatorStatus["discovery_status"] = "none"
  if (last_run_status === "failed") discovery_status = "failed"
  else if (last_run_status === "completed" || last_run_status === "partial") discovery_status = "completed"

  return {
    company_id,
    person_id,
    has_verified_phone,
    verified_phone,
    discovery_status,
    last_run_id: lastRun?.id ? asString(lastRun.id) : null,
    last_run_status,
    last_run_at,
    evidence_count,
    can_discover: !has_verified_phone,
    can_view_evidence: Boolean(lastRun?.id && evidence_count > 0),
  }
}
