/** GE-AIOS-2D — Canonical decision key registry (client-safe). Delegates to @fuzor/decision-records. */

export {
  PLATFORM_DECISION_REGISTRY as AI_DECISION_REGISTRY,
  isRegisteredPlatformDecisionKey as isRegisteredAiDecisionKey,
  lookupPlatformDecisionRegistryEntry as lookupAiDecisionRegistryEntry,
  platformDecisionRegistryCatalog as aiDecisionRegistryCatalog,
} from "@fuzor/decision-records"

export type { PlatformDecisionRegistryEntry as AiDecisionRegistryEntry } from "@fuzor/decision-records"
