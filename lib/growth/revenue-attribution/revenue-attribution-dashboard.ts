import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  creditsFromPathSummaryOrCompute,
  isGrowthAttributionModel,
} from "@/lib/growth/revenue-attribution/attribution-credit-model"
import type { GrowthAttributionTouch } from "@/lib/growth/revenue-attribution/attribution-touch-types"
import { isGrowthAttributionTouchLedgerSchemaReady } from "@/lib/growth/revenue-attribution/attribution-touch-schema-health"
import {
  listAttributionPathsForLeads,
  listAttributionTouchesByIds,
  listAttributionTouchesInRange,
  listReplyLeadIdsInRange,
  listOpportunitiesForAttributionDashboard,
  loadLeadAttributionContexts,
  loadSenderLabels,
  loadSequenceLabels,
  loadSequenceStepLabels,
  type AttributionPathRow,
  type LeadAttributionContext,
  type OpportunityRow,
} from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-queries"
import {
  GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER,
  type GrowthAttributionDimensionRow,
  type GrowthAttributionFunnelStep,
  type GrowthAttributionModel,
  type GrowthRevenueAttributionDashboard,
  type GrowthRevenueAttributionDashboardFilters,
} from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

const TOP_N = 10

function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const to = new Date()
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() }
}

function parseFilters(input?: Partial<GrowthRevenueAttributionDashboardFilters>): GrowthRevenueAttributionDashboardFilters {
  const defaults = defaultDateRange()
  return {
    dateFrom: input?.dateFrom ?? defaults.dateFrom,
    dateTo: input?.dateTo ?? defaults.dateTo,
    channel: input?.channel?.trim() || null,
    repUserId: input?.repUserId?.trim() || null,
    sequenceId: input?.sequenceId?.trim() || null,
    attributionModel: isGrowthAttributionModel(input?.attributionModel)
      ? input.attributionModel
      : "first_touch",
  }
}

function conversionRate(from: number, to: number): number | null {
  if (from <= 0) return null
  return Math.round((to / from) * 1000) / 10
}

function inRange(iso: string | null, from: string, to: string): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  return t >= Date.parse(from) && t <= Date.parse(to)
}

type DimensionBucket = {
  touchCount: number
  leadIds: Set<string>
  opportunities: number
  wins: number
  attributedRevenue: number
}

function bumpBucket(
  buckets: Map<string, DimensionBucket>,
  key: string,
  patch: Partial<DimensionBucket> & { leadId?: string },
): void {
  const bucket = buckets.get(key) ?? {
    touchCount: 0,
    leadIds: new Set<string>(),
    opportunities: 0,
    wins: 0,
    attributedRevenue: 0,
  }
  if (patch.leadId) bucket.leadIds.add(patch.leadId)
  bucket.touchCount += patch.touchCount ?? 0
  bucket.opportunities += patch.opportunities ?? 0
  bucket.wins += patch.wins ?? 0
  bucket.attributedRevenue += patch.attributedRevenue ?? 0
  buckets.set(key, bucket)
}

function bucketsToRows(
  buckets: Map<string, DimensionBucket>,
  labelForKey: (key: string) => string,
): GrowthAttributionDimensionRow[] {
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: labelForKey(key),
      touchCount: bucket.touchCount,
      leadCount: bucket.leadIds.size,
      opportunities: bucket.opportunities,
      wins: bucket.wins,
      attributedRevenue: Math.round(bucket.attributedRevenue * 100) / 100,
    }))
    .sort((a, b) => b.attributedRevenue - a.attributedRevenue || b.touchCount - a.touchCount)
}

function campaignKeyForTouch(touch: GrowthAttributionTouch, lead: LeadAttributionContext | undefined): string {
  const metaCampaign = touch.metadata?.source_campaign
  if (typeof metaCampaign === "string" && metaCampaign.trim()) return metaCampaign.trim()
  if (lead?.sourceCampaign?.trim()) return lead.sourceCampaign.trim()
  if (touch.campaignId) return touch.campaignId
  return "unattributed"
}

function creditDimensionsFromTouch(
  touch: GrowthAttributionTouch,
  lead: LeadAttributionContext | undefined,
  creditedRevenue: number,
  winCredit: number,
  stores: {
    campaign: Map<string, DimensionBucket>
    sequence: Map<string, DimensionBucket>
    step: Map<string, DimensionBucket>
    channel: Map<string, DimensionBucket>
    rep: Map<string, DimensionBucket>
    sender: Map<string, DimensionBucket>
    industry: Map<string, DimensionBucket>
    leadSource: Map<string, DimensionBucket>
  },
): void {
  const leadId = touch.leadId
  const patch = { leadId, wins: winCredit, attributedRevenue: creditedRevenue }

  const campaignKey = campaignKeyForTouch(touch, lead)
  bumpBucket(stores.campaign, campaignKey, patch)

  const sequenceKey = touch.sequenceId ?? "no_sequence"
  bumpBucket(stores.sequence, sequenceKey, patch)

  const stepKey = touch.sequenceStepId ?? "no_step"
  bumpBucket(stores.step, stepKey, patch)

  const channelKey = touch.channel ?? "unknown"
  bumpBucket(stores.channel, channelKey, patch)

  const repKey = touch.repUserId ?? "unassigned"
  bumpBucket(stores.rep, repKey, patch)

  const senderKey = touch.senderAccountId ?? "no_sender"
  bumpBucket(stores.sender, senderKey, patch)

  const industryKey = lead?.industry ?? "unknown"
  bumpBucket(stores.industry, industryKey, patch)

  const sourceKey = lead?.sourceChannel ?? lead?.sourceKind ?? "unknown"
  bumpBucket(stores.leadSource, sourceKey, patch)
}

function resolvePathForWonTouch(
  pathByLeadOpp: Map<string, AttributionPathRow>,
  wonTouch: GrowthAttributionTouch,
): AttributionPathRow | undefined {
  return (
    pathByLeadOpp.get(`${wonTouch.leadId}:${wonTouch.opportunityId ?? "lead"}:opportunity`) ??
    pathByLeadOpp.get(`${wonTouch.leadId}:${wonTouch.opportunityId ?? "lead"}:lead`) ??
    pathByLeadOpp.get(`${wonTouch.leadId}:lead:lead`)
  )
}

function orderedPathTouches(
  path: AttributionPathRow | undefined,
  wonTouch: GrowthAttributionTouch,
  touchById: Map<string, GrowthAttributionTouch>,
  pathTouchById: Map<string, GrowthAttributionTouch>,
  leadTouches: GrowthAttributionTouch[],
): GrowthAttributionTouch[] {
  const ids = path?.touchIds ?? []
  const fromPath = ids
    .map((id) => pathTouchById.get(id) ?? touchById.get(id))
    .filter((t): t is GrowthAttributionTouch => Boolean(t))
    .sort((a, b) => a.touchedAt.localeCompare(b.touchedAt))

  if (fromPath.length > 0) return fromPath

  const anchorMs = Date.parse(wonTouch.touchedAt)
  return leadTouches
    .filter((t) => t.leadId === wonTouch.leadId && Date.parse(t.touchedAt) <= anchorMs)
    .sort((a, b) => a.touchedAt.localeCompare(b.touchedAt))
}

function buildFunnel(
  touches: GrowthAttributionTouch[],
  opportunities: OpportunityRow[],
  filters: GrowthRevenueAttributionDashboardFilters,
  supplementaryReplyLeadIds: string[] = [],
): GrowthAttributionFunnelStep[] {
  const leadIds = new Set(touches.map((t) => t.leadId))
  const replyLeads = new Set(touches.filter((t) => t.touchType === "reply").map((t) => t.leadId))
  for (const leadId of supplementaryReplyLeadIds) {
    replyLeads.add(leadId)
    leadIds.add(leadId)
  }
  const meetingLeads = new Set(touches.filter((t) => t.touchType === "meeting").map((t) => t.leadId))
  const oppLeads = new Set(
    touches.filter((t) => t.touchType === "opportunity_created").map((t) => t.leadId),
  )
  const wonTouches = touches.filter((t) => t.touchType === "opportunity_won")
  const wonLeads = new Set(wonTouches.map((t) => t.leadId))

  const oppCreatedInRange = opportunities.filter((o) => inRange(o.createdAt, filters.dateFrom, filters.dateTo))
  for (const o of oppCreatedInRange) oppLeads.add(o.leadId)

  const wonRevenue = wonTouches.reduce((sum, t) => {
    const opp = opportunities.find((o) => o.id === t.opportunityId)
    return sum + (opp?.amount ?? 0)
  }, 0)

  const leadCount = Math.max(leadIds.size, 1)
  const replyCount = replyLeads.size
  const meetingCount = meetingLeads.size
  const oppCount = oppLeads.size
  const wonCount = wonLeads.size

  return [
    { stage: "lead", label: "Lead", count: leadIds.size, conversionRatePct: null, revenue: 0 },
    {
      stage: "reply",
      label: "Reply",
      count: replyCount,
      conversionRatePct: conversionRate(leadIds.size, replyCount),
      revenue: 0,
    },
    {
      stage: "meeting",
      label: "Meeting",
      count: meetingCount,
      conversionRatePct: conversionRate(replyCount || leadCount, meetingCount),
      revenue: 0,
    },
    {
      stage: "opportunity",
      label: "Opportunity",
      count: oppCount,
      conversionRatePct: conversionRate(meetingCount || replyCount || leadCount, oppCount),
      revenue: 0,
    },
    {
      stage: "closed_won",
      label: "Closed Won",
      count: wonCount,
      conversionRatePct: conversionRate(oppCount || 1, wonCount),
      revenue: Math.round(wonRevenue),
    },
  ]
}

export async function fetchGrowthRevenueAttributionDashboard(
  admin: SupabaseClient,
  input?: Partial<GrowthRevenueAttributionDashboardFilters>,
): Promise<GrowthRevenueAttributionDashboard> {
  const filters = parseFilters(input)
  const attributionModel = filters.attributionModel

  if (!(await isGrowthAttributionTouchLedgerSchemaReady(admin))) {
    return emptyDashboard(filters, attributionModel)
  }

  const [touches, opportunities, replyLeadIds, sequenceLabels, stepLabels, senderLabels] = await Promise.all([
    listAttributionTouchesInRange(admin, filters),
    listOpportunitiesForAttributionDashboard(admin),
    listReplyLeadIdsInRange(admin, filters),
    loadSequenceLabels(admin),
    loadSequenceStepLabels(admin),
    loadSenderLabels(admin),
  ])

  const leadIds = [...new Set(touches.map((t) => t.leadId))]
  const [leadContexts, paths] = await Promise.all([
    loadLeadAttributionContexts(admin, leadIds),
    listAttributionPathsForLeads(admin, leadIds),
  ])

  const pathTouchIds = [...new Set(paths.flatMap((p) => p.touchIds))]
  const pathTouchesLoaded = await listAttributionTouchesByIds(admin, pathTouchIds)
  const pathTouchById = new Map(pathTouchesLoaded.map((t) => [t.id, t]))

  const touchById = new Map([...touches, ...pathTouchesLoaded].map((t) => [t.id, t]))
  const touchesByLead = new Map<string, GrowthAttributionTouch[]>()
  for (const touch of touchById.values()) {
    const list = touchesByLead.get(touch.leadId) ?? []
    list.push(touch)
    touchesByLead.set(touch.leadId, list)
  }
  const pathByLeadOpp = new Map<string, AttributionPathRow>()
  for (const path of paths) {
    const key = `${path.leadId}:${path.opportunityId ?? "lead"}:${path.pathScope}`
    pathByLeadOpp.set(key, path)
  }

  const stores = {
    campaign: new Map<string, DimensionBucket>(),
    sequence: new Map<string, DimensionBucket>(),
    step: new Map<string, DimensionBucket>(),
    channel: new Map<string, DimensionBucket>(),
    rep: new Map<string, DimensionBucket>(),
    sender: new Map<string, DimensionBucket>(),
    industry: new Map<string, DimensionBucket>(),
    leadSource: new Map<string, DimensionBucket>(),
  }

  for (const touch of touches) {
    const lead = leadContexts.get(touch.leadId)
    bumpBucket(stores.campaign, campaignKeyForTouch(touch, lead), { leadId: touch.leadId, touchCount: 1 })
    bumpBucket(stores.sequence, touch.sequenceId ?? "no_sequence", { leadId: touch.leadId, touchCount: 1 })
    bumpBucket(stores.step, touch.sequenceStepId ?? "no_step", { leadId: touch.leadId, touchCount: 1 })
    bumpBucket(stores.channel, touch.channel ?? "unknown", { leadId: touch.leadId, touchCount: 1 })
    bumpBucket(stores.rep, touch.repUserId ?? "unassigned", { leadId: touch.leadId, touchCount: 1 })
    bumpBucket(stores.sender, touch.senderAccountId ?? "no_sender", { leadId: touch.leadId, touchCount: 1 })
    bumpBucket(stores.industry, lead?.industry ?? "unknown", { leadId: touch.leadId, touchCount: 1 })
    bumpBucket(stores.leadSource, lead?.sourceChannel ?? lead?.sourceKind ?? "unknown", {
      leadId: touch.leadId,
      touchCount: 1,
    })

    if (touch.touchType === "opportunity_created") {
      bumpBucket(stores.sequence, touch.sequenceId ?? "no_sequence", { opportunities: 1 })
    }
  }

  const wonTouches = touches.filter((t) => t.touchType === "opportunity_won")
  let attributedRevenue = 0

  for (const wonTouch of wonTouches) {
    const opp =
      opportunities.find((o) => o.id === wonTouch.opportunityId) ??
      opportunities.find((o) => o.leadId === wonTouch.leadId && o.closedWonAt)
    const amount = opp?.amount ?? 0
    attributedRevenue += amount

    const path = resolvePathForWonTouch(pathByLeadOpp, wonTouch)
    const pathTouchList = orderedPathTouches(
      path,
      wonTouch,
      touchById,
      pathTouchById,
      touchesByLead.get(wonTouch.leadId) ?? [],
    )

    const credits = creditsFromPathSummaryOrCompute(
      attributionModel,
      pathTouchList.length > 0 ? pathTouchList : [wonTouch],
      wonTouch.touchedAt,
      path?.pathSummary,
    )

    for (const credit of credits) {
      if (credit.attributionWeight <= 0) continue
      const creditTouch = touchById.get(credit.touchId) ?? pathTouchById.get(credit.touchId)
      if (!creditTouch) continue
      const lead = leadContexts.get(creditTouch.leadId)
      const weight = credit.attributionWeight * credit.attributionConfidence
      creditDimensionsFromTouch(creditTouch, lead, amount * weight, credit.attributionWeight, stores)
    }
  }

  const openOpps = opportunities.filter((o) => !o.closedWonAt && !o.closedLostAt)
  const pipelineRevenue = openOpps.reduce((sum, o) => sum + o.amount, 0)

  const closedWonInRange = opportunities.filter((o) => inRange(o.closedWonAt, filters.dateFrom, filters.dateTo))
  const closedWonRevenue = closedWonInRange.reduce((sum, o) => sum + o.amount, 0)
  const winCount = closedWonInRange.length
  const opportunityCount = opportunities.filter((o) =>
    inRange(o.createdAt, filters.dateFrom, filters.dateTo),
  ).length

  const funnel = buildFunnel(touches, opportunities, filters, replyLeadIds)

  const touchVolumeByType = [...new Set(touches.map((t) => t.touchType))].map((touchType) => ({
    touchType,
    count: touches.filter((t) => t.touchType === touchType).length,
  }))

  const byCampaign = bucketsToRows(stores.campaign, (k) => (k === "unattributed" ? "Unattributed" : k))
  const bySequence = bucketsToRows(stores.sequence, (k) =>
    k === "no_sequence" ? "No sequence" : (sequenceLabels.get(k) ?? k.slice(0, 8)),
  )
  const bySequenceStep = bucketsToRows(stores.step, (k) =>
    k === "no_step" ? "No step" : (stepLabels.get(k) ?? k.slice(0, 8)),
  )
  const byChannel = bucketsToRows(stores.channel, (k) => k)
  const byRep = bucketsToRows(stores.rep, (k) => (k === "unassigned" ? "Unassigned" : k.slice(0, 8)))
  const bySenderMailbox = bucketsToRows(stores.sender, (k) =>
    k === "no_sender" ? "No mailbox" : (senderLabels.get(k) ?? k.slice(0, 8)),
  )
  const byIndustry = bucketsToRows(stores.industry, (k) => (k === "unknown" ? "Unknown" : k))
  const byLeadSource = bucketsToRows(stores.leadSource, (k) => k)

  return {
    qa_marker: GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER,
    filters,
    attributionModel,
    revenue: {
      pipelineRevenue: Math.round(pipelineRevenue),
      closedWonRevenue: Math.round(closedWonRevenue),
      attributedRevenue: Math.round(attributedRevenue || closedWonRevenue),
      averageDealSize: winCount > 0 ? Math.round(closedWonRevenue / winCount) : 0,
      winRatePct: conversionRate(opportunityCount, winCount) ?? 0,
      opportunityCount,
      winCount,
    },
    funnel,
    byCampaign,
    bySequence,
    bySequenceStep,
    byChannel,
    byRep,
    bySenderMailbox,
    byIndustry,
    byLeadSource,
    topPerformers: {
      campaigns: byCampaign.slice(0, TOP_N),
      sequences: bySequence.slice(0, TOP_N),
      reps: byRep.slice(0, TOP_N),
      senderMailboxes: bySenderMailbox.slice(0, TOP_N),
      industries: byIndustry.slice(0, TOP_N),
      leadSources: byLeadSource.slice(0, TOP_N),
    },
    touchVolumeByType: touchVolumeByType.sort((a, b) => b.count - a.count),
    pathsIndexed: paths.length,
    touchesAnalyzed: touches.length,
    lastCalculatedAt: new Date().toISOString(),
  }
}

function emptyDashboard(
  filters: GrowthRevenueAttributionDashboardFilters,
  attributionModel: GrowthAttributionModel,
): GrowthRevenueAttributionDashboard {
  const emptyFunnel: GrowthAttributionFunnelStep[] = [
    { stage: "lead", label: "Lead", count: 0, conversionRatePct: null, revenue: 0 },
    { stage: "reply", label: "Reply", count: 0, conversionRatePct: null, revenue: 0 },
    { stage: "meeting", label: "Meeting", count: 0, conversionRatePct: null, revenue: 0 },
    { stage: "opportunity", label: "Opportunity", count: 0, conversionRatePct: null, revenue: 0 },
    { stage: "closed_won", label: "Closed Won", count: 0, conversionRatePct: null, revenue: 0 },
  ]
  return {
    qa_marker: GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER,
    filters,
    attributionModel,
    revenue: {
      pipelineRevenue: 0,
      closedWonRevenue: 0,
      attributedRevenue: 0,
      averageDealSize: 0,
      winRatePct: 0,
      opportunityCount: 0,
      winCount: 0,
    },
    funnel: emptyFunnel,
    byCampaign: [],
    bySequence: [],
    bySequenceStep: [],
    byChannel: [],
    byRep: [],
    bySenderMailbox: [],
    byIndustry: [],
    byLeadSource: [],
    topPerformers: {
      campaigns: [],
      sequences: [],
      reps: [],
      senderMailboxes: [],
      industries: [],
      leadSources: [],
    },
    touchVolumeByType: [],
    pathsIndexed: 0,
    touchesAnalyzed: 0,
    lastCalculatedAt: new Date().toISOString(),
  }
}
