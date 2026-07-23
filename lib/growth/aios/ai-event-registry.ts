/** GE-AIOS-2B — Canonical AI OS event type registry (client-safe). Delegates to @fuzor/event-bus. */

export {
  PLATFORM_EVENT_REGISTRY as AI_EVENT_REGISTRY,
  eventTypeMatchesPrefix,
  isRegisteredPlatformEventType as isRegisteredAiEventType,
  lookupPlatformEventRegistryEntry as lookupAiEventRegistryEntry,
  platformEventRegistryCatalog as aiEventRegistryCatalog,
  subscriptionMatchesEvent,
} from "@fuzor/event-bus"

export type { PlatformEventRegistryEntry as AiEventRegistryEntry } from "@fuzor/event-bus"
