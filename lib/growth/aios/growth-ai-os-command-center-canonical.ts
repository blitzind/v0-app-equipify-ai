/** GE-AIOS-23 — Canonical operator command experience (client-safe). */

export const GROWTH_AI_OS_COMMAND_CENTER_CANONICAL_QA_MARKER =
  "ge-aios-23-canonical-command-center-v1" as const

/**
 * Canonical production operator command surface:
 *   GET /api/platform/growth/ai-os/command-center
 *   fetchAiOsCommandCenterReadModel (ai-os-command-center-service)
 *
 * Section views (not separate command centers):
 *   - Human Approval Center → ai-os/approvals
 *   - Recommendations → ai-os/recommendations
 *   - Engagement dashboard metrics → engagement-dashboard (read-only section)
 *   - Admin command unification → legacy admin shell; converging into AI OS home
 */
export const GROWTH_CANONICAL_COMMAND_CENTER_API =
  "/api/platform/growth/ai-os/command-center" as const

export const GROWTH_COMMAND_CENTER_SECTION_APIS = [
  "/api/platform/growth/ai-os/approvals",
  "/api/platform/growth/ai-os/recommendations",
  "/api/platform/growth/engagement-dashboard/command-center",
] as const

export const GROWTH_DEPRECATED_COMMAND_CENTER_SURFACES = [
  "standalone engagement command center UX duplicate",
  "admin/growth/command duplicate navigation",
] as const
