import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

/** Logical bucket for marketing taxonomy / future automation filters. */
export type ScreenshotSurfaceCategory =
  | "dashboard"
  | "equipment"
  | "work_orders"
  | "pm_schedule"
  | "inspections"
  | "financial"
  | "ai_insights"

/**
 * One capture target. Paths are in-app only (leading slash). The runner appends
 * `?equipifyShot=1` for deterministic chrome (see `ScreenshotModeGate` + globals.css).
 */
export type ScreenshotScenarioDefinition = {
  id: string
  category: ScreenshotSurfaceCategory
  path: string
  /** File slug per industry: `{industry}/{fileSlug}.png` */
  fileSlug: string
  title: string
  description: string
  viewport: { width: number; height: number }
  /** When true, capture scrollable document (slower, larger files). */
  fullPage?: boolean
  /** Extra settle time after `domcontentloaded` (ms). */
  waitMs?: number
}

export type ResolvedScreenshotScenario = ScreenshotScenarioDefinition & {
  industry: WorkspaceIndustryKey
}

export const SCREENSHOT_QUERY_FLAG = "equipifyShot=1" as const
