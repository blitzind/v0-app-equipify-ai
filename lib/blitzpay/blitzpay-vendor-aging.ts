export type VendorBillAgingRow = {
  remaining_balance_cents: number
  due_date: string
}

export type VendorAgingBuckets = {
  currentDueCents: number
  days30Cents: number
  days60Cents: number
  days90Cents: number
  days120PlusCents: number
  totalOutstandingCents: number
}

/** Deterministic aging from due date vs as-of date (integer cents only). */
export function bucketVendorBillAging(rows: VendorBillAgingRow[], asOfYmd: string): VendorAgingBuckets {
  const asOf = new Date(`${asOfYmd.slice(0, 10)}T12:00:00.000Z`).getTime()
  const out: VendorAgingBuckets = {
    currentDueCents: 0,
    days30Cents: 0,
    days60Cents: 0,
    days90Cents: 0,
    days120PlusCents: 0,
    totalOutstandingCents: 0,
  }
  for (const r of rows) {
    const rem = Math.max(0, Math.round(Number(r.remaining_balance_cents)))
    if (rem <= 0) continue
    const due = new Date(`${String(r.due_date).slice(0, 10)}T12:00:00.000Z`).getTime()
    if (!Number.isFinite(due)) continue
    const daysPast = Math.max(0, Math.floor((asOf - due) / 86400000))
    out.totalOutstandingCents += rem
    if (daysPast <= 0) out.currentDueCents += rem
    else if (daysPast <= 30) out.days30Cents += rem
    else if (daysPast <= 60) out.days60Cents += rem
    else if (daysPast <= 90) out.days90Cents += rem
    else out.days120PlusCents += rem
  }
  return out
}
