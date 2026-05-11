import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type PortalMembershipListItem = {
  id: string
  membership_number: string
  status: string
  billing_frequency: string
  next_invoice_at: string | null
  next_work_order_at: string | null
  auto_renew: boolean
  auto_bill_enabled: boolean
  recurring_amount_cents: number
  renewal_notice_days: number
  expires_at: string | null
}

export async function fetchPortalMembershipList(
  svc: SupabaseClient,
  organizationId: string,
  customerId: string,
): Promise<PortalMembershipListItem[]> {
  const { data, error } = await svc
    .from("blitzpay_memberships")
    .select(
      "id, membership_number, status, billing_frequency, next_invoice_at, next_work_order_at, auto_renew, auto_bill_enabled, recurring_amount_cents, renewal_notice_days, expires_at",
    )
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(80)
  if (error) throw new Error(error.message)
  return (data ?? []) as PortalMembershipListItem[]
}

export async function fetchPortalMembershipDetail(
  svc: SupabaseClient,
  organizationId: string,
  customerId: string,
  membershipId: string,
): Promise<PortalMembershipListItem | null> {
  const { data, error } = await svc
    .from("blitzpay_memberships")
    .select(
      "id, membership_number, status, billing_frequency, next_invoice_at, next_work_order_at, auto_renew, auto_bill_enabled, recurring_amount_cents, renewal_notice_days, expires_at",
    )
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .eq("id", membershipId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as PortalMembershipListItem) ?? null
}
