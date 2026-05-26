import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchIndexCompany,
  GrowthProspectSearchParsedQuery,
  GrowthProspectSearchPersonResult,
} from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchIndexPerson } from "@/lib/growth/prospect-search/prospect-search-index"

function textMatchScore(query: string, blob: string): number {
  const q = query.trim().toLowerCase()
  const b = blob.toLowerCase()
  if (!q || !b) return 0
  if (b === q) return 1
  if (b.includes(q)) return 0.85
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  const hits = tokens.filter((t) => b.includes(t)).length
  return hits / tokens.length
}

export function rankProspectSearchCompanies(
  rows: GrowthProspectSearchIndexCompany[],
  query: string,
  parsed: GrowthProspectSearchParsedQuery,
  limit = 100,
): GrowthProspectSearchCompanyResult[] {
  const scored = rows.map((row) => {
    const blob = [
      row.company_name,
      row.website,
      row.industry,
      row.location,
      row.city,
      row.state,
      row.notes,
      ...row.keywords,
      ...parsed.industry_hints,
      ...parsed.location_hints,
    ]
      .filter(Boolean)
      .join(" ")

    let rank = textMatchScore(query, blob)
    if (parsed.keywords.length) {
      rank = Math.max(rank, textMatchScore(parsed.keywords.join(" "), blob))
    }
    if (row.intent_score != null) rank += Math.min(0.15, row.intent_score / 200)
    if (row.lead_score != null) rank += Math.min(0.12, row.lead_score / 120)
    if (row.company_match_confidence != null) rank += row.company_match_confidence * 0.08
    if (row.buying_stage === "purchase_ready" || row.buying_stage === "active_opportunity") {
      rank += 0.06
    }

    const reasoning: string[] = []
    if (rank > 0.5) reasoning.push("Strong text match to search query.")
    if (row.intent_score != null && row.intent_score >= 12) {
      reasoning.push(`Intent score ${row.intent_score} from observable traffic.`)
    }
    if (row.buying_stage) reasoning.push(`Buying stage candidate: ${row.buying_stage}.`)
    if (row.signals.length) reasoning.push(row.signals[0]!)

    return {
      id: row.id,
      source_type: row.source_type,
      company_name: row.company_name,
      website: row.website,
      industry: row.industry,
      subindustry: row.subindustry,
      employees: row.employees,
      revenue_range: row.revenue_range,
      location: row.location,
      intent_score: row.intent_score,
      buying_stage: row.buying_stage,
      lead_score: row.lead_score,
      confidence: Number(Math.min(0.95, 0.35 + rank).toFixed(3)),
      company_match_confidence: row.company_match_confidence,
      decision_maker_coverage:
        row.decision_maker_count != null && row.decision_maker_count > 0
          ? Math.min(1, row.decision_maker_count / 5)
          : null,
      verification_status: row.verification_status,
      signals: row.signals,
      search_intent_category: row.search_intent_category,
      lead_inbox_id: row.lead_inbox_id,
      growth_lead_id: row.growth_lead_id,
      prospect_id: row.prospect_id,
      customer_id: row.customer_id,
      rank_score: Number(rank.toFixed(4)),
      match_reasoning: reasoning,
    }
  })

  return scored
    .filter((r) => r.rank_score > 0.05 || query.trim().length < 3)
    .sort((a, b) => b.rank_score - a.rank_score)
    .slice(0, limit)
}

export function rankProspectSearchPeople(
  rows: GrowthProspectSearchIndexPerson[],
  query: string,
  limit = 100,
): GrowthProspectSearchPersonResult[] {
  const scored = rows.map((row) => {
    const blob = [row.company_name, row.full_name, row.title, row.role, row.email].join(" ")
    const rank = textMatchScore(query, blob)
    return {
      id: row.id,
      source_type: row.source_type,
      company_id: row.company_id,
      company_name: row.company_name,
      full_name: row.full_name,
      title: row.title,
      email: row.email,
      phone: row.phone,
      role: row.role,
      verification_status: row.verification_status,
      rank_score: Number(rank.toFixed(4)),
    }
  })

  return scored
    .filter((r) => r.rank_score > 0.05 || query.trim().length < 3)
    .sort((a, b) => b.rank_score - a.rank_score)
    .slice(0, limit)
}
