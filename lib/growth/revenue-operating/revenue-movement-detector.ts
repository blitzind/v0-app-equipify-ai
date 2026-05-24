import type {
  GrowthOpportunityFingerprint,
  GrowthRevenueMovementType,
} from "@/lib/growth/revenue-operating/revenue-operating-types"

export type DetectedRevenueMovement = {
  movementType: GrowthRevenueMovementType
  opportunityId: string
  leadId: string
  title: string
  summary: string
  metadata: Record<string, unknown>
}

export function detectGrowthRevenueMovements(input: {
  previous: GrowthOpportunityFingerprint[]
  current: GrowthOpportunityFingerprint[]
}): DetectedRevenueMovement[] {
  const prevMap = new Map(input.previous.map((row) => [row.id, row]))
  const movements: DetectedRevenueMovement[] = []

  for (const curr of input.current) {
    const prev = prevMap.get(curr.id)
    if (!prev) {
      if (!curr.closedWon && !curr.closedLost) {
        movements.push({
          movementType: "new_opportunity",
          opportunityId: curr.id,
          leadId: curr.leadId,
          title: "New opportunity",
          summary: `${curr.companyName} added to pipeline (${curr.amount.toLocaleString()}).`,
          metadata: { amount: curr.amount, stageKey: curr.stageKey },
        })
      }
      continue
    }

    if (!prev.closedWon && curr.closedWon) {
      movements.push({
        movementType: "close_won",
        opportunityId: curr.id,
        leadId: curr.leadId,
        title: "Closed won",
        summary: `${curr.companyName} closed won (${curr.amount.toLocaleString()}).`,
        metadata: { amount: curr.amount },
      })
      continue
    }

    if (!prev.closedLost && curr.closedLost) {
      movements.push({
        movementType: "close_lost",
        opportunityId: curr.id,
        leadId: curr.leadId,
        title: "Closed lost",
        summary: `${curr.companyName} closed lost.`,
        metadata: { amount: curr.amount },
      })
      continue
    }

    if (curr.amount > prev.amount) {
      movements.push({
        movementType: "amount_increase",
        opportunityId: curr.id,
        leadId: curr.leadId,
        title: "Amount increased",
        summary: `${curr.companyName}: ${prev.amount.toLocaleString()} → ${curr.amount.toLocaleString()}.`,
        metadata: { fromAmount: prev.amount, toAmount: curr.amount },
      })
    } else if (curr.amount < prev.amount) {
      movements.push({
        movementType: "amount_decrease",
        opportunityId: curr.id,
        leadId: curr.leadId,
        title: "Amount decreased",
        summary: `${curr.companyName}: ${prev.amount.toLocaleString()} → ${curr.amount.toLocaleString()}.`,
        metadata: { fromAmount: prev.amount, toAmount: curr.amount },
      })
    }

    if (curr.stageOrder > prev.stageOrder && !curr.closedWon && !curr.closedLost) {
      movements.push({
        movementType: "stage_progression",
        opportunityId: curr.id,
        leadId: curr.leadId,
        title: "Stage progressed",
        summary: `${curr.companyName}: ${prev.stageKey.replace(/_/g, " ")} → ${curr.stageKey.replace(/_/g, " ")}.`,
        metadata: { fromStage: prev.stageKey, toStage: curr.stageKey },
      })
    } else if (curr.stageOrder < prev.stageOrder && !curr.closedWon && !curr.closedLost) {
      movements.push({
        movementType: "stage_regression",
        opportunityId: curr.id,
        leadId: curr.leadId,
        title: "Stage regressed",
        summary: `${curr.companyName}: ${prev.stageKey.replace(/_/g, " ")} → ${curr.stageKey.replace(/_/g, " ")}.`,
        metadata: { fromStage: prev.stageKey, toStage: curr.stageKey },
      })
    }

    if (curr.forecastCategory !== prev.forecastCategory) {
      movements.push({
        movementType: "forecast_category_change",
        opportunityId: curr.id,
        leadId: curr.leadId,
        title: "Forecast category changed",
        summary: `${curr.companyName}: ${prev.forecastCategory} → ${curr.forecastCategory}.`,
        metadata: { fromCategory: prev.forecastCategory, toCategory: curr.forecastCategory },
      })
    }

    if ((curr.expectedCloseDate ?? "") !== (prev.expectedCloseDate ?? "")) {
      movements.push({
        movementType: "close_date_moved",
        opportunityId: curr.id,
        leadId: curr.leadId,
        title: "Close date moved",
        summary: `${curr.companyName}: ${prev.expectedCloseDate ?? "none"} → ${curr.expectedCloseDate ?? "none"}.`,
        metadata: { fromDate: prev.expectedCloseDate, toDate: curr.expectedCloseDate },
      })
    }
  }

  return movements
}
