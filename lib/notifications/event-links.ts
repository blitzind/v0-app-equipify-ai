import type { RelatedEntityType } from "@/lib/notifications/types"

/** Deep links into dashboard modules from notification rows. */
export function hrefForRelatedEntity(
  relatedEntityType: RelatedEntityType | string | null,
  relatedEntityId: string | null,
): string | null {
  if (!relatedEntityType || !relatedEntityId) return null
  switch (relatedEntityType) {
    case "work_order":
      return `/work-orders?open=${encodeURIComponent(relatedEntityId)}`
    case "quote":
      return `/quotes?open=${encodeURIComponent(relatedEntityId)}`
    case "invoice":
      return `/invoices?open=${encodeURIComponent(relatedEntityId)}`
    case "maintenance_plan":
      return `/maintenance-plans?open=${encodeURIComponent(relatedEntityId)}`
    case "customer":
      return `/customers/${encodeURIComponent(relatedEntityId)}`
    case "equipment":
      return `/equipment/${encodeURIComponent(relatedEntityId)}`
    default:
      return null
  }
}
