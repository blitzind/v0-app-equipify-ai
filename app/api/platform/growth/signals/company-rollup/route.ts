import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  buildCompanySignalRollup,
  GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
} from "@/lib/growth/signals/company-signal-rollup"
import { buildCompanySignalTimeline } from "@/lib/growth/signals/integrations/company-signal-timeline"
import { loadGrowthSignals } from "@/lib/growth/signals/signal-repository"
import { GROWTH_SIGNAL_FOUNDATION_QA_MARKER } from "@/lib/growth/signals/signal-types"

export const runtime = "nodejs"

function sanitizeRollup(rollup: ReturnType<typeof buildCompanySignalRollup>) {
  return {
    qa_marker: rollup.qa_marker,
    total_signal_count: rollup.total_signal_count,
    high_urgency_count: rollup.high_urgency_count,
    news_count: rollup.news_count,
    job_posting_count: rollup.job_posting_count,
    hiring_signal_count: rollup.hiring_signal_count,
    watchlist_match_count: rollup.watchlist_match_count,
    average_signal_score: rollup.average_signal_score,
    max_signal_score: rollup.max_signal_score,
    latest_signal_at: rollup.latest_signal_at,
    latest_signal_summary: rollup.latest_signal_summary,
    top_signal_types: rollup.top_signal_types,
    top_categories: rollup.top_categories,
    hiring_intensity: rollup.hiring_intensity,
    momentum_score: rollup.momentum_score,
    momentum_label: rollup.momentum_label,
    momentum_base_score: rollup.momentum_base_score,
    watchlist_boost: rollup.watchlist_boost,
    evidence_count: rollup.evidence_count,
    signal_ids: rollup.signal_ids,
    counts_24h: rollup.counts_24h,
    counts_7d: rollup.counts_7d,
    counts_30d: rollup.counts_30d,
    counts_90d: rollup.counts_90d,
    watchlist_matches: rollup.watchlist_matches,
  }
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const domain = url.searchParams.get("domain")?.trim() || undefined
  const company_name = url.searchParams.get("company_name")?.trim() || undefined
  const company_id = url.searchParams.get("company_id")?.trim() || undefined
  const include_timeline = url.searchParams.get("include_timeline") === "1"

  if (!domain && !company_name && !company_id) {
    return NextResponse.json(
      { ok: false, error: "missing_target", message: "Provide domain, company_name, or company_id." },
      { status: 400 },
    )
  }

  const occurredFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const loaded = await loadGrowthSignals(access.admin, {
    domain,
    company: company_name,
    company_id,
    occurred_from: occurredFrom,
    suppression_state: "active",
    limit: 200,
    offset: 0,
  })

  const rollup = buildCompanySignalRollup({
    domain,
    company_id,
    company_name,
    signals: loaded.items,
  })

  const timeline = include_timeline
    ? buildCompanySignalTimeline({
        domain,
        company_id,
        company_name,
        signals: loaded.items,
      })
    : null

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
    foundation_qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
    rollup: sanitizeRollup(rollup),
    timeline,
  })
}
