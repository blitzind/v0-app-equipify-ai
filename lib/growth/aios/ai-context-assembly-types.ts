/** GE-AIOS-2J — Context Assembly types. Delegates to @fuzor/context. */

import type { AiDecisionEvidenceRef } from "@/lib/growth/aios/ai-decision-record-types"
import type { AiWorkOrderAgent, AiWorkOrderStatus, AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

export {
  PLATFORM_CONTEXT_ASSEMBLY_QA_MARKER as GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER,
  PLATFORM_CONTEXT_ASSEMBLY_RUNTIME_RULE as AI_CONTEXT_ASSEMBLY_RUNTIME_RULE,
  PLATFORM_CONTEXT_ASSEMBLY_SCHEMA_MIGRATION as GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_MIGRATION,
  PLATFORM_CONTEXT_ASSEMBLY_VALIDATION_FAILURES as AI_CONTEXT_ASSEMBLY_VALIDATION_FAILURES,
  PLATFORM_CONTEXT_PACKAGE_SCHEMA_VERSION as AI_CONTEXT_PACKAGE_SCHEMA_VERSION,
} from "@fuzor/context"

export const GROWTH_AIOS_2J_PHASE = "GE-AIOS-2J" as const

export type {
  PlatformContextAssemblyInput as AiContextAssemblyInput,
  PlatformContextAssemblyResult as AiContextAssemblyResult,
  PlatformContextAssemblyRuntime as AiContextAssemblyRuntime,
  PlatformContextAssemblyValidationFailure as AiContextAssemblyValidationFailure,
  PlatformContextDecisionSummary as AiContextDecisionSummary,
  PlatformContextEntityMetadata as AiContextEntityMetadata,
  PlatformContextEventSummary as AiContextEventSummary,
  PlatformContextMemoryReference as AiContextMemoryReference,
  PlatformContextMissionSection as AiContextMissionSection,
  PlatformContextPackage as AiContextPackage,
  PlatformContextPackageContent as AiContextPackageContent,
  PlatformContextWorkOrderSection as AiContextWorkOrderSection,
} from "@fuzor/context"

export type { AiDecisionEvidenceRef, AiWorkOrderAgent, AiWorkOrderStatus, AiWorkOrderType }
