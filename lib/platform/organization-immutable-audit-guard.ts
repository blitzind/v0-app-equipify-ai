import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type OrganizationImmutableAuditBlockDetails = {
  immutableAuditRecordCount: number
  blitzpayMobileAuditCount: number
}

/**
 * Preflight: orgs linked to append-only BlitzPay mobile audit rows cannot be hard-deleted
 * (DELETE trigger raises blitzpay_mobile_audit_immutable even via FK cascade).
 */
export async function countOrganizationImmutableAuditRecords(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrganizationImmutableAuditBlockDetails> {
  const { count, error } = await admin
    .from("blitzpay_mobile_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(error.message)
  }

  const immutableAuditRecordCount = count ?? 0
  return {
    immutableAuditRecordCount,
    blitzpayMobileAuditCount: immutableAuditRecordCount,
  }
}
