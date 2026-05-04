import { Repeat } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** Module glyph for route meta / maps (Lucide `Repeat`). */
export const MaintenancePlansLucideIcon: LucideIcon = Repeat

export const MAINTENANCE_PLANS_ICON_FG = "#F59E0B" as const
export const MAINTENANCE_PLANS_TILE_BG = "#FEF3C7" as const

const TILE_SIZES = {
  /** Sidebar / compact list rows */
  xs: { box: "w-7 h-7", icon: "w-3.5 h-3.5" },
  /** KPI strips, customer cards, list leading tiles */
  sm: { box: "w-8 h-8", icon: "w-4 h-4" },
  /** Page hero, feature headers */
  md: { box: "w-9 h-9 sm:w-10 sm:h-10", icon: "w-4 h-4 sm:w-5 sm:h-5" },
  /** Dashboard stat cells (matches `w-10 h-10` metric tiles) */
  stat: { box: "w-10 h-10", icon: "w-5 h-5" },
} as const

export type MaintenancePlansBrandTileSize = keyof typeof TILE_SIZES

export function MaintenancePlansBrandTile({
  size = "md",
  className,
}: {
  size?: MaintenancePlansBrandTileSize
  className?: string
}) {
  const { box, icon } = TILE_SIZES[size]
  return (
    <span
      className={cn("inline-flex items-center justify-center shrink-0 rounded-xl", box, className)}
      style={{ backgroundColor: MAINTENANCE_PLANS_TILE_BG }}
    >
      <Repeat
        className={cn(icon, "shrink-0")}
        strokeWidth={2}
        style={{ color: MAINTENANCE_PLANS_ICON_FG }}
        aria-hidden
      />
    </span>
  )
}
