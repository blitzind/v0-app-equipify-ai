/** GE-AIOS-2J — Context package collectors. Delegates to @fuzor/context. */

export {
  assemblePlatformContextPackageContent as assembleAiContextPackageContent,
  buildPlatformContextDecisionSummaries as buildAiContextDecisionSummaries,
  buildPlatformContextEvidenceBundle as buildAiContextEvidenceBundle,
  buildPlatformContextEventSummaries as buildAiContextEventSummaries,
  buildPlatformContextMemoryReferences as buildAiContextMemoryReferences,
  buildPlatformContextMissionSection as buildAiContextMissionSection,
  buildPlatformContextWorkOrderSection as buildAiContextWorkOrderSection,
} from "@fuzor/context"

export { collectPlatformDecisionEngineEvidence as collectAiDecisionEngineEvidence } from "@fuzor/context"
