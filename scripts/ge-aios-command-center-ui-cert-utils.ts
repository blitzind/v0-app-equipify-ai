/** Shared Command Center UI paths for GE-AIOS certification scripts. */

import fs from "node:fs"
import path from "node:path"

export const GE_AIOS_COMMAND_CENTER_PANEL_PATH =
  "components/growth/ai-os/command-center/growth-ai-os-command-center-panel.tsx"

export const GE_AIOS_COMMAND_CENTER_DIAGNOSTICS_PATH =
  "components/growth/ai-os/command-center/growth-ai-os-command-center-diagnostics-sections.tsx"

export const GE_AIOS_OPERATIONS_DASHBOARD_PATH =
  "components/growth/ai-os/operations/growth-ai-os-operations-dashboard.tsx"

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

/** Operator panel + diagnostics sections + operations dashboard (Consolidation-1B). */
export function readGeAiOsCommandCenterUiBundle(): string {
  return [
    GE_AIOS_COMMAND_CENTER_PANEL_PATH,
    GE_AIOS_COMMAND_CENTER_DIAGNOSTICS_PATH,
    GE_AIOS_OPERATIONS_DASHBOARD_PATH,
  ]
    .map(read)
    .join("\n")
}
