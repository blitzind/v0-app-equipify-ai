/**
 * Shared module visuals — use these exports so Maintenance Plans (and future modules)
 * stay consistent across sidebar, shell, mobile nav, and in-page CTAs.
 */
import type { LucideIcon } from "lucide-react"
import { IdCard } from "lucide-react"

export {
  MaintenancePlansBrandTile,
  MaintenancePlansLucideIcon,
  MAINTENANCE_PLANS_ICON_FG,
  MAINTENANCE_PLANS_TILE_BG,
} from "@/components/icons/maintenance-plans-brand"

/** Native memberships & recurring agreements — distinct from maintenance plans (`Repeat`). */
export const MembershipsLucideIcon: LucideIcon = IdCard
