export const VENDOR_PAYABLE_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "paid",
  "failed",
] as const

export type VendorPayableStatus = (typeof VENDOR_PAYABLE_STATUSES)[number]

const STATUS_SET = new Set<string>(VENDOR_PAYABLE_STATUSES)

const OPEN_STATUSES = new Set<VendorPayableStatus>([
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
])

/** Valid status transitions (org workflow; enforced in API + tests). */
const ALLOWED: Readonly<Record<VendorPayableStatus, ReadonlySet<VendorPayableStatus>>> = {
  draft: new Set(["pending_approval", "failed"]),
  pending_approval: new Set(["approved", "draft", "failed"]),
  approved: new Set(["scheduled", "pending_approval", "failed"]),
  scheduled: new Set(["paid", "failed", "approved"]),
  paid: new Set([]),
  failed: new Set(["draft", "pending_approval"]),
}

export function isOpenVendorPayableStatus(status: string): boolean {
  return OPEN_STATUSES.has(status as VendorPayableStatus)
}

export function isValidVendorPayableTransition(from: string, to: string): boolean {
  const a = from as VendorPayableStatus
  const b = to as VendorPayableStatus
  if (!ALLOWED[a] || !STATUS_SET.has(a) || !STATUS_SET.has(b)) return false
  return ALLOWED[a].has(b)
}

export function assertValidVendorPayableTransition(from: string, to: string): void {
  if (!isValidVendorPayableTransition(from, to)) {
    throw new Error(`Invalid vendor payable transition: ${from} → ${to}`)
  }
}
