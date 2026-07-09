import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { normalizePhone } from "@/lib/growth/import/normalize"
import type { CallWorkspacePhoneLeadMatch } from "@/lib/growth/native-dialer/call-workspace-coaching-types"
import { GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT } from "@/lib/growth/relationship/relationship-scale-limits"

function pickBestMatch(matches: CallWorkspacePhoneLeadMatch[]): CallWorkspacePhoneLeadMatch | null {
  if (matches.length === 0) return null
  return matches.sort((a, b) => b.confidence - a.confidence)[0] ?? null
}

async function matchGrowthLeadsByPhone(
  admin: SupabaseClient,
  normalizedPhone: string,
): Promise<CallWorkspacePhoneLeadMatch | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, contact_phone, company_name, score")
    .not("contact_phone", "is", null)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    if (normalizePhone(row.contact_phone as string) !== normalizedPhone) continue
    return {
      leadId: row.id as string,
      matchedVia: "growth_lead_contact_phone",
      confidence: 0.92,
      label: (row.company_name as string) ?? "Growth lead",
    }
  }
  return null
}

async function matchDecisionMakersByPhone(
  admin: SupabaseClient,
  normalizedPhone: string,
): Promise<CallWorkspacePhoneLeadMatch | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("id, lead_id, phone, status, confidence, full_name")
    .not("phone", "is", null)
    .order("confidence", { ascending: false })
    .limit(GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT)
  if (error) return null

  for (const row of data ?? []) {
    if (normalizePhone(row.phone as string) !== normalizedPhone) continue
    if (!row.lead_id) continue
    return {
      leadId: row.lead_id as string,
      matchedVia: "growth_decision_maker_phone",
      confidence: row.status === "confirmed" ? 0.9 : 0.82,
      label: (row.full_name as string) ?? "Decision maker",
    }
  }
  return null
}

async function matchProspectPromotedLead(
  admin: SupabaseClient,
  normalizedPhone: string,
  organizationId: string,
): Promise<CallWorkspacePhoneLeadMatch | null> {
  const { data: prospects, error } = await admin
    .from("prospects")
    .select("id, company_name, contact_phone")
    .eq("organization_id", organizationId)
    .not("contact_phone", "is", null)
    .limit(GROWTH_RELATIONSHIP_CALL_QUEUE_BATCH_LIMIT)
  if (error) return null

  for (const prospect of prospects ?? []) {
    if (normalizePhone(prospect.contact_phone as string) !== normalizedPhone) continue
    const { data: lead } = await admin
      .schema("growth")
      .from("leads")
      .select("id, company_name")
      .eq("promoted_prospect_id", prospect.id as string)
      .limit(1)
      .maybeSingle()
    if (lead?.id) {
      return {
        leadId: lead.id as string,
        matchedVia: "growth_prospect_promoted",
        confidence: 0.86,
        label: (lead.company_name as string) ?? (prospect.company_name as string) ?? "Prospect lead",
      }
    }
  }
  return null
}

async function matchCustomerContactLead(
  admin: SupabaseClient,
  normalizedPhone: string,
  organizationId: string,
): Promise<CallWorkspacePhoneLeadMatch | null> {
  const { data: contacts, error } = await admin
    .from("customer_contacts")
    .select("customer_id, phone, full_name")
    .eq("organization_id", organizationId)
    .not("phone", "is", null)
    .limit(300)
  if (error) return null

  for (const contact of contacts ?? []) {
    if (normalizePhone(contact.phone as string) !== normalizedPhone) continue
    const { data: lead } = await admin
      .schema("growth")
      .from("leads")
      .select("id, company_name")
      .eq("promoted_organization_id", contact.customer_id as string)
      .limit(1)
      .maybeSingle()
    if (lead?.id) {
      return {
        leadId: lead.id as string,
        matchedVia: "customer_contact_phone",
        confidence: 0.84,
        label: (lead.company_name as string) ?? (contact.full_name as string) ?? "Customer lead",
      }
    }
  }
  return null
}

/** Deterministic phone → lead lookup for manual dial / bridge sessions (no invented prospects). */
export async function resolveCallWorkspaceLeadByPhone(
  admin: SupabaseClient,
  phoneNumber: string,
): Promise<CallWorkspacePhoneLeadMatch | null> {
  const normalizedPhone = normalizePhone(phoneNumber)
  if (!normalizedPhone) return null

  const candidates: CallWorkspacePhoneLeadMatch[] = []

  const leadMatch = await matchGrowthLeadsByPhone(admin, normalizedPhone)
  if (leadMatch) candidates.push(leadMatch)

  const dmMatch = await matchDecisionMakersByPhone(admin, normalizedPhone)
  if (dmMatch) candidates.push(dmMatch)

  const orgId = getGrowthEngineAiOrgId()
  if (orgId) {
    const prospectMatch = await matchProspectPromotedLead(admin, normalizedPhone, orgId)
    if (prospectMatch?.leadId) candidates.push(prospectMatch)

    const customerMatch = await matchCustomerContactLead(admin, normalizedPhone, orgId)
    if (customerMatch) candidates.push(customerMatch)
  }

  return pickBestMatch(candidates)
}
