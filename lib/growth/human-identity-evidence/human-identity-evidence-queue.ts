import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  isGenericIdentityName,
  resolveCompanyContactSourceUrl,
} from "@/lib/growth/human-identity-evidence/human-identity-evidence-evidence"
import type { HumanIdentityEvidenceQueueItem } from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

function asNumber(v: unknown): number {
  return typeof v === "number" ? v : Number(v ?? 0)
}

function scoreQueuePriority(row: {
  full_name: string
  contact_status: string
  phone_status: string
  source_type: string
}): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  if (isGenericIdentityName(row.full_name)) {
    score += 100
    reasons.push("generic_full_name")
  }
  if (row.contact_status === "candidate") {
    score += 50
    reasons.push("contact_status_candidate")
  }
  if (row.phone_status === "unknown") {
    score += 30
    reasons.push("phone_status_unknown")
  }
  if (row.source_type === "team_page") {
    score += 20
    reasons.push("source_type_team_page")
  }
  return { score, reasons }
}

export async function loadHumanIdentityEvidenceQueue(
  admin: SupabaseClient,
  input?: { company_ids?: string[]; limit?: number },
): Promise<HumanIdentityEvidenceQueueItem[]> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200)

  let query = admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, canonical_company_id, canonical_person_id, full_name, title, phone, email, contact_status, phone_status, source_type, source_evidence, confidence_score, metadata",
    )
    .eq("contact_status", "candidate")
    .not("canonical_person_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit * 3)

  if (input?.company_ids?.length) {
    query = query.or(
      `canonical_company_id.in.(${input.company_ids.join(",")}),company_id.in.(${input.company_ids.join(",")})`,
    )
  }

  const { data, error } = await query
  if (error) throw new Error(`loadHumanIdentityEvidenceQueue: ${error.message}`)

  const companyNameById = new Map<string, string>()
  const companyIds = [
    ...new Set(
      (data ?? []).flatMap((row) => {
        const r = row as Record<string, unknown>
        return [asString(r.canonical_company_id), asString(r.company_id)].filter(Boolean)
      }),
    ),
  ]
  if (companyIds.length) {
    const { data: companies } = await admin
      .schema("growth")
      .from("companies")
      .select("id, display_name")
      .in("id", companyIds)
    for (const c of companies ?? []) {
      companyNameById.set(asString(c.id), asString(c.display_name) || "Company")
    }
  }

  const items: HumanIdentityEvidenceQueueItem[] = []
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>
    const metadata =
      r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {}
    const source_evidence = Array.isArray(r.source_evidence) ? r.source_evidence : []
    const { score, reasons } = scoreQueuePriority({
      full_name: asString(r.full_name),
      contact_status: asString(r.contact_status),
      phone_status: asString(r.phone_status),
      source_type: asString(r.source_type),
    })
    if (score < 50) continue

    items.push({
      company_contact_id: asString(r.id),
      company_id: asString(r.company_id),
      canonical_company_id: asString(r.canonical_company_id) || null,
      canonical_person_id: asString(r.canonical_person_id) || null,
      company_name:
        companyNameById.get(asString(r.canonical_company_id)) ||
        companyNameById.get(asString(r.company_id)) ||
        "Company",
      full_name: asString(r.full_name),
      title: asString(r.title) || null,
      phone: asString(r.phone) || null,
      email: asString(r.email) || null,
      contact_status: asString(r.contact_status),
      phone_status: asString(r.phone_status),
      source_type: asString(r.source_type),
      source_url: resolveCompanyContactSourceUrl({
        source_evidence: source_evidence as Array<{ page_url?: string | null }>,
        metadata,
      }),
      confidence_score: asNumber(r.confidence_score),
      priority_score: score,
      priority_reasons: reasons,
    })
  }

  return items.sort((a, b) => b.priority_score - a.priority_score).slice(0, limit)
}
