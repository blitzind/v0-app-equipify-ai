import type { SyncPrepFlowReadiness } from "./types"

/** Shown on badges and compact UI. */
export const ONLINE_REQUIRED_LABEL = "Online required"

/**
 * Technician / work-order flow audit — reflects current architecture (direct Supabase + APIs).
 * Update when a flow gains true offline replay; do not mark offline-ready without product sign-off.
 */
export const WORK_ORDER_TECHNICIAN_SYNC_PREP_AUDIT = {
  workOrderStatusUpdate: {
    offlineReplayPlanned: false,
    requiresLiveNetwork: true,
    summary: "Status changes write to Supabase and may emit workflow events.",
  },
  repairLogNotes: {
    offlineReplayPlanned: false,
    requiresLiveNetwork: true,
    summary: "Notes and repair log fields save through authenticated Supabase updates.",
  },
  tasks: {
    offlineReplayPlanned: false,
    requiresLiveNetwork: true,
    summary: "Task lists sync via work order task persistence (server-backed).",
  },
  partsAndMaterials: {
    offlineReplayPlanned: false,
    requiresLiveNetwork: true,
    summary: "Parts lines and catalog actions require server validation and RLS.",
  },
  photosAndFiles: {
    offlineReplayPlanned: false,
    requiresLiveNetwork: true,
    summary: "Attachments upload to storage with signed/authenticated requests.",
  },
  customerSignature: {
    offlineReplayPlanned: false,
    requiresLiveNetwork: true,
    summary: "Signatures upload and may transition work order state on the server.",
  },
  certificates: {
    offlineReplayPlanned: false,
    requiresLiveNetwork: true,
    summary: "Certificate steps depend on server-backed equipment and template data.",
  },
  inventoryTruckConsume: {
    offlineReplayPlanned: false,
    requiresLiveNetwork: true,
    summary: "Inventory moves require live authorization and stock checks.",
  },
} as const satisfies Record<string, SyncPrepFlowReadiness>

/** User-facing copy (centralized; no fake offline promises). */
export const SYNC_PREP_COPY = {
  technicianQuickBarLead:
    "Saving jobs, photos, signatures, tasks, and parts requires a connection. Offline queue is not active yet — if signal drops, reopen this job when online and retry any failed save.",

  workOrderDrawerBannerTitle: "Sync & offline",

  workOrderDrawerBannerBody:
    "Work order changes still need an active session and network today. A future update will queue edits safely when you are offline; nothing is auto-synced in the background yet.",

  /** `title` / tooltip on buttons that hit the network */
  saveRequiresNetwork: "Online required — saves go to your workspace immediately.",

  statusChangeRequiresNetwork: "Online required — status updates the live work order.",

  /** Desktop / hover */
  onlineRequiredTooltip:
    "This action talks to Equipify right away. Offline queuing and background sync are planned but not enabled.",
} as const
