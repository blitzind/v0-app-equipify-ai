/**
 * AI Operational Assistant Phase 1 — UI metadata for recommendation
 * categories. Pure constants only (icons + Tailwind classes) so the
 * file can be imported from server and client alike.
 */

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CalendarClock,
  ClipboardList,
  FileBadge2,
  Receipt,
  UserPlus,
  Warehouse,
  Workflow,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type {
  RecommendationCategory,
  RecommendationPriority,
} from "@/lib/ai-ops/types"

export const CATEGORY_ICON: Record<RecommendationCategory, LucideIcon> = {
  prospect: UserPlus,
  financial: Receipt,
  dispatch: ClipboardList,
  equipment: Wrench,
  certificate: FileBadge2,
  inventory: Warehouse,
  communications: Bell,
  automation: Workflow,
  maintenance: CalendarClock,
}

export const CATEGORY_LABEL: Record<RecommendationCategory, string> = {
  prospect: "Prospects",
  financial: "Invoices",
  dispatch: "Dispatch",
  equipment: "Equipment",
  certificate: "Certificates",
  inventory: "Inventory",
  communications: "Communications",
  automation: "Automations",
  maintenance: "Maintenance",
}

export const PRIORITY_BADGE: Record<RecommendationPriority, string> = {
  high: "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30",
  low: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30",
}

export const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
  high: "High priority",
  medium: "Medium",
  low: "Low",
}

export const PRIORITY_ICON: Record<RecommendationPriority, LucideIcon> = {
  high: AlertCircle,
  medium: AlertTriangle,
  low: Bell,
}
