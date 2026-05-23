import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeEmail } from "@/lib/growth/import/normalize"

export type ResolvedOutboundLead = {
  leadId: string
  decisionMakerId: string | null
  email: string
  rule: "outbound_contact" | "decision_maker" | "lead_contact"
}

export async function resolveOutboundLeadByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<ResolvedOutboundLead | null> {
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const { data: contactMatch } = await admin
    .schema("growth")
    .from("outbound_contacts")
    .select("lead_id, decision_maker_id, email")
    .eq("email", normalized)
    .not("lead_id", "is", null)
    .order("last_event_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (contactMatch?.lead_id) {
    return {
      leadId: contactMatch.lead_id,
      decisionMakerId: contactMatch.decision_maker_id,
      email: normalized,
      rule: "outbound_contact",
    }
  }

  const { data: dmRows } = await admin
    .schema("growth")
    .from("lead_decision_makers")
    .select("id, lead_id, email, status, confidence")
    .eq("email", normalized)
    .order("status", { ascending: true })
    .order("confidence", { ascending: false })

  if (dmRows && dmRows.length > 0) {
    const preferred =
      dmRows.find((row) => row.status === "confirmed") ??
      dmRows.find((row) => row.status === "suspected") ??
      dmRows[0]
    if (preferred?.lead_id) {
      return {
        leadId: preferred.lead_id,
        decisionMakerId: preferred.id,
        email: normalized,
        rule: "decision_maker",
      }
    }
  }

  const { data: leadMatch } = await admin
    .schema("growth")
    .from("leads")
    .select("id, contact_email, score")
    .eq("contact_email", normalized)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (leadMatch?.id) {
    return {
      leadId: leadMatch.id,
      decisionMakerId: null,
      email: normalized,
      rule: "lead_contact",
    }
  }

  return null
}
