import { WORKSPACE_INDUSTRY_KEYS, type WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import type {
  ResolvedScreenshotScenario,
  ScreenshotScenarioDefinition,
} from "@/lib/screenshots/scenario-types"

export const SCREENSHOT_REGISTRY_VERSION = 1 as const

const VIEWPORT_DESKTOP_WIDE = { width: 1600, height: 900 } as const

/**
 * Standard product surfaces seeded demo workspaces should populate.
 * Industry-specific *content* comes from `organizations.industry` + demo seed — routes stay stable.
 */
export function standardVerticalScenarios(): ScreenshotScenarioDefinition[] {
  return [
    {
      id: "executive_dashboard",
      category: "dashboard",
      path: "/",
      fileSlug: "01-executive-dashboard",
      title: "Executive dashboard",
      description: "Snapshot, charts, and operational widgets.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1500,
    },
    {
      id: "work_orders_board",
      category: "work_orders",
      path: "/work-orders",
      fileSlug: "02-work-orders",
      title: "Work orders",
      description: "Dispatchable work list for the vertical.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1500,
    },
    {
      id: "equipment_register",
      category: "equipment",
      path: "/equipment",
      fileSlug: "03-equipment",
      title: "Equipment register",
      description: "Customer-linked assets and service history entry points.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1500,
    },
    {
      id: "service_schedule",
      category: "pm_schedule",
      path: "/service-schedule",
      fileSlug: "04-service-schedule",
      title: "Service schedule",
      description: "PM and scheduled service density.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1500,
    },
    {
      id: "maintenance_plans",
      category: "pm_schedule",
      path: "/maintenance-plans",
      fileSlug: "05-maintenance-plans",
      title: "Maintenance plans",
      description: "Contracts and recurring PM coverage.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1200,
    },
    {
      id: "dispatch_inspections",
      category: "inspections",
      path: "/dispatch",
      fileSlug: "06-dispatch",
      title: "Dispatch",
      description: "Technician workload and routing context.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1200,
    },
    {
      id: "invoices_financial",
      category: "financial",
      path: "/invoices",
      fileSlug: "07-invoices",
      title: "Invoices",
      description: "Billing and collections pipeline.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1500,
    },
    {
      id: "reports_financial",
      category: "financial",
      path: "/reports",
      fileSlug: "08-reports",
      title: "Reports",
      description: "Revenue and operational reporting.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1200,
    },
    {
      id: "ai_ops_insights",
      category: "ai_insights",
      path: "/ai-ops",
      fileSlug: "09-ai-ops",
      title: "AI Operations",
      description: "AI lifecycle and ops digest surfaces.",
      viewport: { ...VIEWPORT_DESKTOP_WIDE },
      fullPage: true,
      waitMs: 1200,
    },
  ]
}

export function parseIndustryFilter(raw: string | undefined): WorkspaceIndustryKey[] | null {
  if (!raw?.trim()) return null
  const want = new Set(
    raw
      .split(/[, ]+/)
      .map((s) => s.trim().toLowerCase().replace(/-/g, "_"))
      .filter(Boolean),
  )
  const keys = WORKSPACE_INDUSTRY_KEYS.filter((k) => want.has(k))
  return keys.length ? keys : null
}

/** Flatten `{ industry × scenario }` rows for runners and manifest builders. */
export function expandIndustryScenarios(industries: WorkspaceIndustryKey[]): ResolvedScreenshotScenario[] {
  const std = standardVerticalScenarios()
  return industries.flatMap((industry) => std.map((s) => ({ ...s, industry })))
}

export function defaultScreenshotIndustries(): WorkspaceIndustryKey[] {
  const raw = process.env.EQUIPIFY_SCREENSHOT_INDUSTRIES
  const parsed = parseIndustryFilter(raw)
  if (parsed) return parsed
  return ["hvac_r", "equipment_rental", "commercial_equipment", "refrigeration_service", "material_handling"]
}
