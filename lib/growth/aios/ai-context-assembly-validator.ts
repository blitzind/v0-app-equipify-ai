/** GE-AIOS-2J — Context Package validation (client-safe). */

import { verifyAiContextPackageChecksum } from "@/lib/growth/aios/ai-context-assembly-checksum"
import type {
  AiContextAssemblyValidationFailure,
  AiContextPackage,
  AiContextPackageContent,
  AiContextWorkOrderSection,
} from "@/lib/growth/aios/ai-context-assembly-types"

export type AiContextAssemblyValidationResult =
  | { valid: true; contextPackage: AiContextPackage }
  | { valid: false; failure: AiContextAssemblyValidationFailure; detail: string }

export function validateAiContextWorkOrderSection(
  section: AiContextWorkOrderSection,
): AiContextAssemblyValidationResult | { valid: true } {
  if (!section.workOrderId || !section.missionId) {
    return {
      valid: false,
      failure: "missing_work_order_context",
      detail: "Work Order context requires workOrderId and missionId",
    }
  }
  return { valid: true }
}

export function validateAiContextPackageContent(
  content: AiContextPackageContent,
  expectedChecksum?: string,
): { valid: true } | { valid: false; failure: AiContextAssemblyValidationFailure; detail: string } {
  const workOrderCheck = validateAiContextWorkOrderSection(content.workOrderContext)
  if (!workOrderCheck.valid && "failure" in workOrderCheck) {
    return workOrderCheck
  }

  if (expectedChecksum && !verifyAiContextPackageChecksum(content, expectedChecksum)) {
    return {
      valid: false,
      failure: "checksum_mismatch",
      detail: "Context Package checksum does not match content",
    }
  }

  if (content.sourceKeys.length === 0) {
    return {
      valid: false,
      failure: "missing_work_order_context",
      detail: "Context Package must reference at least one source",
    }
  }

  return { valid: true }
}

export function validateAiContextPackage(
  contextPackage: AiContextPackage,
): AiContextAssemblyValidationResult {
  const content: AiContextPackageContent = {
    contextVersion: contextPackage.contextVersion,
    workOrderContext: contextPackage.workOrderContext,
    missionContext: contextPackage.missionContext,
    decisionHistory: contextPackage.decisionHistory,
    memoryReferences: contextPackage.memoryReferences,
    relatedEvents: contextPackage.relatedEvents,
    evidenceBundle: contextPackage.evidenceBundle,
    entityMetadata: contextPackage.entityMetadata,
    sourceKeys: contextPackage.sourceKeys,
  }

  const result = validateAiContextPackageContent(content, contextPackage.checksum)
  if (!result.valid) {
    return result
  }

  if (contextPackage.missionId !== contextPackage.workOrderContext.missionId) {
    return {
      valid: false,
      failure: "work_order_mission_mismatch",
      detail: "Package missionId does not match Work Order missionId",
    }
  }

  if (contextPackage.workOrderId !== contextPackage.workOrderContext.workOrderId) {
    return {
      valid: false,
      failure: "work_order_mission_mismatch",
      detail: "Package workOrderId does not match Work Order context",
    }
  }

  return { valid: true, contextPackage }
}
