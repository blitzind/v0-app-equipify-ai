/** Growth Engine S5-C — canvas diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_CANVAS_QA_MARKER,
  GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-canvas-types"

export { GROWTH_AUTOMATION_CANVAS_QA_MARKER, GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_CANVAS_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-canvas-types.ts",
  "lib/growth/automation/growth-automation-canvas-utils.ts",
  "lib/growth/automation/growth-automation-canvas-layout.ts",
  "lib/growth/automation/growth-automation-canvas-history.ts",
  "lib/growth/automation/growth-automation-canvas-selection.ts",
  "lib/growth/automation/growth-automation-canvas-serialization.ts",
  "lib/growth/automation/growth-automation-canvas-diagnostics.ts",
  "lib/growth/automation/growth-automation-canvas-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_REACT_FLOW_MODULE_PATHS = [
  "components/growth/automation/growth-automation-react-flow.tsx",
  "components/growth/automation/growth-automation-node.tsx",
  "components/growth/automation/growth-automation-edge.tsx",
  "components/growth/automation/growth-automation-mini-map.tsx",
  "components/growth/automation/growth-automation-controls.tsx",
  "components/growth/automation/growth-automation-background.tsx",
  "components/growth/automation/growth-automation-history-provider.tsx",
  "components/growth/automation/growth-automation-node-toolbar.tsx",
  "components/growth/automation/growth-automation-node-creation-menu.tsx",
  "components/growth/automation/growth-automation-edge-toolbar.tsx",
  "components/growth/automation/growth-automation-empty-state.tsx",
  "components/growth/automation/growth-automation-canvas-layout.tsx",
] as const

export function automationCanvasSafetyPayload(): typeof GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS }
}
