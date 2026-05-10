import type { SyncPrepFlowReadiness } from "./types"

/** Shown on badges and compact UI. */
export const ONLINE_REQUIRED_LABEL = "Online required"

/**
 * Technician / work-order flow audit — reflects current architecture (direct Supabase + APIs).
 * Update when a flow gains true offline replay; do not mark offline-ready without product sign-off.
 */
export const WORK_ORDER_TECHNICIAN_SYNC_PREP_AUDIT = {
  workOrderStatusUpdate: {
    offlineReplayPlanned: true,
    requiresLiveNetwork: false,
    summary:
      "Open/Scheduled → In progress can be queued offline (Phase 53B) and replayed with manual Sync now when online.",
  },
  repairLogNotes: {
    offlineReplayPlanned: true,
    requiresLiveNetwork: false,
    summary:
      "Problem reported, diagnosis, technician notes, and internal notes can be drafted offline and replayed manually.",
  },
  tasks: {
    offlineReplayPlanned: true,
    requiresLiveNetwork: true,
    summary:
      "JSON repair_log tasks can be drafted offline when this job does not use server-backed task rows; otherwise online only.",
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
    "Technician notes, problem text, JSON task checklists, and starting the job (Open/Scheduled → In progress) can be saved locally when offline — tap Sync when you have signal. Photos, signatures, parts, inventory, invoices, and AI still need a live connection.",

  workOrderDrawerBannerTitle: "Sync & offline",

  workOrderDrawerBannerBody:
    "Technician-safe fields can be drafted offline and replayed with Sync now when you are back online. Nothing auto-syncs without your confirmation in this phase.",

  /** `title` / tooltip on buttons that hit the network */
  saveRequiresNetwork: "Online required — saves go to your workspace immediately.",

  statusChangeRequiresNetwork: "Online required — status updates the live work order.",

  /** Desktop / hover */
  onlineRequiredTooltip:
    "This action talks to Equipify right away. Technician notes and similar fields support an offline draft on this work order instead.",

  offlineDraftSupportedLabel: "Offline draft supported",
  offlineDraftSupportedTooltip:
    "You can save these fields locally when offline, then use Sync now when you are online. Parts, photos, inventory, invoices, and AI stay online-only.",

  savedLocallyLabel: "Saved locally",
  savedLocallyTooltip: "Draft is stored on this device only (IndexedDB or small local fallback). Sync when online to apply it.",

  syncPendingLabel: "Sync pending",
  syncPendingTooltip: "A local technician draft is waiting. Use Sync now when you have a connection.",

  reviewConflictLabel: "Review conflict",
  reviewConflictTooltip:
    "The server work order changed since this draft started. Open the sync bar to compare and discard or resolve.",

  syncFailedLabel: "Sync failed",
  syncFailedTooltip: "Replay failed — check the error on the sync bar and try again, or discard the local draft.",

  /** Full work order profile page (`/work-orders/[id]`) — Phase 53C */
  workOrderFullPageOfflineHint:
    "Technician notes, problem text, and JSON tasks (when allowed) can be saved on this device while offline. Billing, labor/parts totals, inventory, file uploads, and AI still require a connection.",

  workOrderFullPageTechnicianSavedLocalTitle: "Technician fields saved locally",
  workOrderFullPageTechnicianSavedLocalBody:
    "Billing, inventory, file uploads, and AI still require a connection before they sync to your workspace.",

  workOrderFullPageUnsafeOfflineTitle: "Online required",
  workOrderFullPageUnsafeOfflineBody:
    "Labor, parts lines, and signatures were not saved. Reconnect to save those changes, or use Sync now after saving technician fields locally.",
} as const
