import "server-only"

/** GE-AIOS-2J — Context Assembly service. Delegates to @fuzor/context. */

export {
  assemblePlatformContextForWorkOrder as assembleAiContextForWorkOrder,
  getPlatformContextAssemblyRuntimeSummary as getAiContextAssemblyRuntimeSummary,
} from "@fuzor/context"
