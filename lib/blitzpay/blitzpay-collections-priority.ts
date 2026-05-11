import type { CollectionsPriorityQueueItem } from "@/lib/blitzpay/blitzpay-collections-copilot-types"
import { buildCollectionsPlaybook, type PlaybookSignals } from "@/lib/blitzpay/blitzpay-collections-playbooks"

export type PriorityInvoiceInput = PlaybookSignals & {
  invoiceId: string
  customerId: string | null
  balanceDueCents: number
  daysPastDue: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function urgencyFromInput(s: PriorityInvoiceInput): number {
  let u = 0
  u += clamp(s.daysPastDue * 2.2, 0, 55)
  u += clamp(s.balanceDueCents / 8000, 0, 35)
  if (s.abandonedCheckout) u += 12
  if (s.walletCreditAvailableCents > 0 && s.walletCreditAvailableCents < s.balanceDueCents) u += 4
  if (s.reminderDispatchesLast30d >= 4) u += 6
  if (s.hasScheduledPayment) u -= 25
  if (s.hasActiveInstallment) u -= 15
  if (s.workOrderScheduledWithin14d) u += 8
  return Math.round(clamp(u, 0, 100))
}

/**
 * Deterministic priority ordering for collections targets (no LLM).
 */
export function buildCollectionsPriorityQueue(rows: PriorityInvoiceInput[]): CollectionsPriorityQueueItem[] {
  const scored = rows.map((row) => {
    const pb = buildCollectionsPlaybook(row)
    const urgencyScore = urgencyFromInput(row)
    return {
      row,
      urgencyScore,
      pb,
    }
  })

  scored.sort((a, b) => {
    if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore
    if (b.row.balanceDueCents !== a.row.balanceDueCents) return b.row.balanceDueCents - a.row.balanceDueCents
    return a.row.invoiceId.localeCompare(b.row.invoiceId)
  })

  return scored.map((s) => ({
    invoiceId: s.row.invoiceId,
    customerId: s.row.customerId,
    balanceDueCents: s.row.balanceDueCents,
    daysPastDue: s.row.daysPastDue,
    urgencyScore: s.urgencyScore,
    collectionLikelihood: s.pb.collectionLikelihood,
    recommendedAction: s.pb.recommendedAction,
    recommendedChannel: s.pb.recommendedChannel,
    expectedRecoveryWindow: s.pb.expectedRecoveryWindow,
    riskFlags: s.pb.riskFlags,
  }))
}
