/** GE-AIOS-2B — In-process subscriber handler registry (server-only). Delegates to @fuzor/event-bus. */

import "server-only"

export {
  clearPlatformEventHandlersForTests as clearAiOsEventHandlersForTests,
  invokeRegisteredPlatformEventHandlers as invokeRegisteredAiOsEventHandlers,
  listRegisteredPlatformEventHandlers as listRegisteredAiOsEventHandlers,
  registerPlatformEventHandler as registerAiOsEventHandler,
} from "@fuzor/event-bus"

export type {
  PlatformEventHandler as AiOsEventSubscriberHandler,
  PlatformEventHandlerRunRecord as AiOsEventHandlerRunRecord,
} from "@fuzor/event-bus"
