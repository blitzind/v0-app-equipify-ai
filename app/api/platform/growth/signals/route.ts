import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadGrowthSignals } from "@/lib/growth/signals/signal-repository"
import {
  GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
  GROWTH_SIGNAL_TYPES,
  GROWTH_SIGNAL_URGENCY_LEVELS,
  GROWTH_SIGNAL_WORKFLOW_STATES,
  type GrowthSignalType,
  type GrowthSignalUrgency,
  type GrowthSignalWorkflowState,
  type GrowthSignalSuppressionState,
} from "@/lib/growth/signals/signal-types"

export const runtime = "nodejs"

function parseEnumParam<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  if (!value) return undefined
  return allowed.includes(value as T) ? (value as T) : undefined
}

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const signal_type = parseEnumParam(url.searchParams.get("signal_type"), GROWTH_SIGNAL_TYPES)
  const workflow_state = parseEnumParam(
    url.searchParams.get("workflow_state"),
    GROWTH_SIGNAL_WORKFLOW_STATES,
  )
  const urgency = parseEnumParam(url.searchParams.get("urgency"), GROWTH_SIGNAL_URGENCY_LEVELS)
  const company = url.searchParams.get("company")?.trim() || undefined
  const company_id = url.searchParams.get("company_id")?.trim() || undefined
  const domain = url.searchParams.get("domain")?.trim() || undefined
  const occurred_from = url.searchParams.get("occurred_from")?.trim() || undefined
  const occurred_to = url.searchParams.get("occurred_to")?.trim() || undefined
  const category = url.searchParams.get("category")?.trim() || undefined
  const publisher = url.searchParams.get("publisher")?.trim() || url.searchParams.get("source")?.trim() || undefined
  const watchlist_id = url.searchParams.get("watchlist_id")?.trim() || undefined
  const suppression_state = parseEnumParam(
    url.searchParams.get("suppression_state"),
    ["active", "suppressed", "dismissed"] as const,
  ) as GrowthSignalSuppressionState | undefined
  const minimum_signal_score = Number(url.searchParams.get("minimum_signal_score") ?? "")
  const department = url.searchParams.get("department")?.trim() || undefined
  const hiring_intensity = url.searchParams.get("hiring_intensity")?.trim() || undefined
  const geography = url.searchParams.get("geography")?.trim() || undefined
  const seniority = url.searchParams.get("seniority")?.trim() || undefined
  const transition_type = url.searchParams.get("transition_type")?.trim() || undefined
  const previous_company_domain = url.searchParams.get("previous_company_domain")?.trim() || undefined
  const identity_confidence_min = Number(url.searchParams.get("identity_confidence_min") ?? "")
  const limit = Number(url.searchParams.get("limit") ?? "50")
  const offset = Number(url.searchParams.get("offset") ?? "0")

  const typeAlias = url.searchParams.get("type")?.trim() as GrowthSignalType | undefined
  const resolvedSignalType = signal_type ?? (typeAlias && GROWTH_SIGNAL_TYPES.includes(typeAlias) ? typeAlias : undefined)

  const result = await loadGrowthSignals(access.admin, {
    signal_type: resolvedSignalType,
    workflow_state: workflow_state as GrowthSignalWorkflowState | undefined,
    urgency: urgency as GrowthSignalUrgency | undefined,
    company,
    company_id,
    domain,
    occurred_from,
    occurred_to,
    category,
    publisher,
    watchlist_id,
    suppression_state,
    minimum_signal_score: Number.isFinite(minimum_signal_score) ? minimum_signal_score : undefined,
    department,
    hiring_intensity,
    geography,
    seniority,
    transition_type,
    previous_company_domain,
    identity_confidence_min: Number.isFinite(identity_confidence_min)
      ? identity_confidence_min
      : undefined,
    limit: Number.isFinite(limit) ? limit : 50,
    offset: Number.isFinite(offset) ? offset : 0,
  })

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
    filters: {
      signal_type: resolvedSignalType ?? null,
      workflow_state: workflow_state ?? null,
      urgency: urgency ?? null,
      company: company ?? null,
      company_id: company_id ?? null,
      domain: domain ?? null,
      occurred_from: occurred_from ?? null,
      occurred_to: occurred_to ?? null,
      category: category ?? null,
      publisher: publisher ?? null,
      watchlist_id: watchlist_id ?? null,
      suppression_state: suppression_state ?? null,
      minimum_signal_score: Number.isFinite(minimum_signal_score) ? minimum_signal_score : null,
      department: department ?? null,
      hiring_intensity: hiring_intensity ?? null,
      geography: geography ?? null,
      seniority: seniority ?? null,
      transition_type: transition_type ?? null,
      previous_company_domain: previous_company_domain ?? null,
      identity_confidence_min: Number.isFinite(identity_confidence_min)
        ? identity_confidence_min
        : null,
    },
    items: result.items,
    total: result.total,
  })
}
