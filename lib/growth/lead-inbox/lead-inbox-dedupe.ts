import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadInboxCrmMatch, GrowthLeadInboxCreateInput } from "@/lib/growth/lead-inbox/lead-inbox-types"
import { isGrowthLeadInboxSchemaReady } from "@/lib/growth/lead-inbox/lead-inbox-schema-health"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "")
}

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/^www\./, "")
}

export type GrowthLeadInboxDedupeCheckInput = {
  dedupe_hash: string
  intent_session_id: string
  email?: string | null
  phone?: string | null
  domain?: string | null
}

export type GrowthLeadInboxDedupeResult = {
  is_duplicate: boolean
  reasons: string[]
  existing_inbox_id: string | null
}

export async function checkLeadInboxDuplicate(
  admin: SupabaseClient,
  input: GrowthLeadInboxDedupeCheckInput,
): Promise<GrowthLeadInboxDedupeResult> {
  const reasons: string[] = []
  let existing_inbox_id: string | null = null

  if (!(await isGrowthLeadInboxSchemaReady(admin))) {
    return { is_duplicate: false, reasons: ["schema_not_ready"], existing_inbox_id: null }
  }

  try {
    const { data: byHash } = await admin
      .schema("growth")
      .from("lead_inbox")
      .select("id, status")
      .eq("dedupe_hash", input.dedupe_hash)
      .maybeSingle()

    if (byHash) {
      existing_inbox_id = asString((byHash as Record<string, unknown>).id)
      reasons.push("dedupe_hash")
    }
  } catch {
    // fault isolated
  }

  if (!existing_inbox_id && input.intent_session_id) {
    try {
      const { data: bySession } = await admin
        .schema("growth")
        .from("lead_inbox")
        .select("id")
        .eq("intent_session_id", input.intent_session_id)
        .maybeSingle()
      if (bySession) {
        existing_inbox_id = asString((bySession as Record<string, unknown>).id)
        reasons.push("intent_session_id")
      }
    } catch {
      // fault isolated
    }
  }

  const email = normalizeEmail(input.email)
  if (!existing_inbox_id && email) {
    try {
      const { data } = await admin
        .schema("growth")
        .from("lead_inbox")
        .select("id, status")
        .eq("email", email)
        .limit(5)
      const active = ((data ?? []) as Record<string, unknown>[]).find((row) => {
        const status = asString(row.status)
        return status !== "archived" && status !== "disqualified"
      })
      if (active) {
        existing_inbox_id = asString(active.id)
        reasons.push("email")
      }
    } catch {
      // fault isolated
    }
  }

  const domain = normalizeDomain(input.domain)
  if (!existing_inbox_id && domain) {
    try {
      const { data } = await admin
        .schema("growth")
        .from("lead_inbox")
        .select("id")
        .eq("domain", domain)
        .eq("status", "new")
        .limit(1)
        .maybeSingle()
      if (data) {
        existing_inbox_id = asString((data as Record<string, unknown>).id)
        reasons.push("domain")
      }
    } catch {
      // fault isolated
    }
  }

  return {
    is_duplicate: reasons.length > 0,
    reasons,
    existing_inbox_id,
  }
}

export type GrowthLeadInboxCrmMatchIndex = {
  existing_account_match: GrowthLeadInboxCrmMatch
  existing_lead_match: GrowthLeadInboxCrmMatch
  existing_customer_ids: string[]
  existing_lead_ids: string[]
  existing_prospect_ids: string[]
  intent_session_seen: boolean
}

export async function resolveLeadInboxCrmMatches(
  admin: SupabaseClient,
  input: Pick<
    GrowthLeadInboxCreateInput,
    "email" | "phone" | "domain" | "company_name" | "intent_session_id"
  >,
): Promise<GrowthLeadInboxCrmMatchIndex> {
  const emptyMatch = (): GrowthLeadInboxCrmMatch => ({
    matched: false,
    source: null,
    ids: [],
    evidence: "",
  })

  const result: GrowthLeadInboxCrmMatchIndex = {
    existing_account_match: emptyMatch(),
    existing_lead_match: emptyMatch(),
    existing_customer_ids: [],
    existing_lead_ids: [],
    existing_prospect_ids: [],
    intent_session_seen: false,
  }

  const email = normalizeEmail(input.email)
  const phone = normalizePhone(input.phone)
  const domain = normalizeDomain(input.domain)
  const company = asString(input.company_name)

  try {
    if (email) {
      const { data } = await admin
        .schema("growth")
        .from("leads")
        .select("id, company_name")
        .eq("contact_email", email)
        .limit(5)
      const rows = (data ?? []) as Record<string, unknown>[]
      if (rows.length > 0) {
        result.existing_lead_ids = rows.map((r) => asString(r.id)).filter(Boolean)
        result.existing_lead_match = {
          matched: true,
          source: "growth.leads",
          ids: result.existing_lead_ids,
          evidence: `Matched growth.leads by email (${email}).`,
        }
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (company) {
      const { data } = await admin
        .from("customers")
        .select("id, company_name")
        .ilike("company_name", company)
        .limit(5)
      const rows = (data ?? []) as Record<string, unknown>[]
      if (rows.length > 0) {
        result.existing_customer_ids = rows.map((r) => asString(r.id)).filter(Boolean)
        result.existing_account_match = {
          matched: true,
          source: "public.customers",
          ids: result.existing_customer_ids,
          evidence: `Matched customers by company name (${company}).`,
        }
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (company && !result.existing_account_match.matched) {
      const { data } = await admin
        .from("prospects")
        .select("id, company_name")
        .ilike("company_name", company)
        .limit(5)
      const rows = (data ?? []) as Record<string, unknown>[]
      if (rows.length > 0) {
        result.existing_prospect_ids = rows.map((r) => asString(r.id)).filter(Boolean)
        result.existing_account_match = {
          matched: true,
          source: "public.prospects",
          ids: result.existing_prospect_ids,
          evidence: `Matched prospects by company name (${company}).`,
        }
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (domain && !result.existing_lead_match.matched) {
      const { data } = await admin
        .schema("growth")
        .from("leads")
        .select("id, website")
        .ilike("website", `%${domain}%`)
        .limit(5)
      const rows = (data ?? []) as Record<string, unknown>[]
      if (rows.length > 0) {
        result.existing_lead_ids = rows.map((r) => asString(r.id)).filter(Boolean)
        result.existing_lead_match = {
          matched: true,
          source: "growth.leads",
          ids: result.existing_lead_ids,
          evidence: `Matched growth.leads by domain (${domain}).`,
        }
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (phone.length >= 7 && !result.existing_lead_match.matched) {
      const { data } = await admin
        .schema("growth")
        .from("leads")
        .select("id, contact_phone")
        .ilike("contact_phone", `%${phone.slice(-7)}%`)
        .limit(5)
      const rows = (data ?? []) as Record<string, unknown>[]
      if (rows.length > 0) {
        result.existing_lead_ids = rows.map((r) => asString(r.id)).filter(Boolean)
        result.existing_lead_match = {
          matched: true,
          source: "growth.leads",
          ids: result.existing_lead_ids,
          evidence: `Matched growth.leads by phone suffix.`,
        }
      }
    }
  } catch {
    // fault isolated
  }

  try {
    if (input.intent_session_id) {
      const { data } = await admin
        .schema("growth")
        .from("intent_visitor_sessions")
        .select("id")
        .eq("id", input.intent_session_id)
        .maybeSingle()
      result.intent_session_seen = Boolean(data)
    }
  } catch {
    // fault isolated — intent pixel optional
  }

  if (result.existing_account_match.matched || result.existing_lead_match.matched) {
    // preserve both match objects
  }

  return result
}

export function validateInboxPiiPolicy(input: GrowthLeadInboxCreateInput): {
  ok: boolean
  sanitized: GrowthLeadInboxCreateInput
  warnings: string[]
} {
  const warnings: string[] = []
  const isAnonymous = input.candidate_type === "anonymous"

  const sanitized = { ...input }

  if (isAnonymous) {
    if (input.email || input.phone || input.contact_name || input.linkedin_url) {
      warnings.push("Anonymous candidate — PII fields cleared (no inferred identity).")
    }
    sanitized.email = null
    sanitized.phone = null
    sanitized.contact_name = null
    sanitized.linkedin_url = null
  }

  return { ok: true, sanitized, warnings }
}
