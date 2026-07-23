/** GE-AIOS-2B — AI OS Event persistence (server-only). Delegates to @fuzor/event-bus. */

import "server-only"

export {
  appendPlatformEventArchiveRecord as appendAiOsEventArchiveRecord,
  fetchPlatformEventById as fetchAiOsEventById,
  insertPlatformEvent as insertAiOsEvent,
  insertPlatformEventDeliveries as insertAiOsEventDeliveries,
  listPendingPlatformEventDeliveries as listPendingAiOsEventDeliveries,
  listPlatformEventSubscriptions as listAiOsEventSubscriptions,
  listPlatformEvents as listAiOsEvents,
  markPlatformEventDeliveryConsumed as markAiOsEventDeliveryConsumed,
  platformEventSchemaCatalog as aiEventSchemaCatalog,
  replayPlatformEvents as replayAiOsEvents,
  upsertPlatformEventSubscription as upsertAiOsEventSubscription,
} from "@fuzor/event-bus"

export type {
  PlatformEvent as AiOsEvent,
  PlatformEventDelivery as AiOsEventDelivery,
  PlatformEventListFilter as AiOsEventListFilter,
  PlatformEventPublishInput as AiOsEventPublishInput,
  PlatformEventReplayFilter as AiOsEventReplayFilter,
  PlatformEventSubscription as AiOsEventSubscription,
  PlatformEventSubscriptionInput as AiOsEventSubscriptionInput,
} from "@fuzor/event-bus"
