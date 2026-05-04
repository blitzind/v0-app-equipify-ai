import type { Part } from "@/lib/mock-data"

export function cloneParts(parts: Part[]): Part[] {
  return parts.map((p) => ({ ...p }))
}

/** Deep-enough compare for draft vs saved line items (order-sensitive). */
export function partsEqual(a: Part[], b: Part[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (x.name.trim() !== y.name.trim()) return false
    if (x.partNumber.trim() !== y.partNumber.trim()) return false
    if (Math.abs(x.quantity - y.quantity) > 1e-9) return false
    if (Math.abs(x.unitCost - y.unitCost) > 1e-6) return false
    if ((x.vendorId ?? null) !== (y.vendorId ?? null)) return false
    if ((x.purchaseOrderId ?? null) !== (y.purchaseOrderId ?? null)) return false
  }
  return true
}
