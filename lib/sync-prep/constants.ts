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
    offlineReplayPlanned: true,
    requiresLiveNetwork: true,
    summary:
      "Work-order technician photos (JPEG/PNG/WebP/GIF only) can be queued on-device (IndexedDB) and uploaded with manual Sync now (Phase 59.2). PDFs, linked org documents, certificates, and portal releases stay online-only.",
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
    "Technician notes, problem text, JSON task checklists, starting the job (Open/Scheduled → In progress), and work-order photos (JPEG/PNG/WebP/GIF) can be saved on-device when offline — tap Sync when you have signal. PDFs/documents in the same uploader need a connection. Signatures, parts, inventory, invoices, and AI still need a live connection.",

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

  /** Save changes — desktop + mobile footer when offline */
  workOrderFullPageOfflineSaveButtonTooltip:
    "Saves problem text, diagnosis, technician notes, internal notes, and JSON tasks (when allowed) on this device. Labor, parts lines, and customer signatures need a connection and stay unsaved until you are online.",

  workOrderFullPageTechnicianSavedLocalTitle: "Technician fields saved locally",
  workOrderFullPageTechnicianSavedLocalBody:
    "Billing, inventory, file uploads, and AI still require a connection before they sync to your workspace.",

  /** Same session also had labor/parts/signature edits — those stay local-only in the form until online */
  workOrderFullPageSplitOfflineSaveTitle: "Technician fields saved locally",
  workOrderFullPageSplitOfflineSaveBody:
    "Labor, parts lines, and customer signatures were not saved offline. Stay in edit mode to keep working, then save those when you have a connection.",

  workOrderFullPageUnsafeOfflineTitle: "Online required",
  workOrderFullPageUnsafeOfflineBody:
    "Labor, parts lines, and signatures were not saved. Reconnect to save those changes, or use Sync now after saving technician fields locally.",

  /** Inline when offline + editing + labor/parts/signature differs from server */
  workOrderFullPageOfflineUnsafeEditingNote:
    "You have unsaved labor, parts, or signature changes. Those cannot be saved offline — they are only sent when you are online.",

  /** Phase 59.2 — offline technician photo queue */
  workOrderOfflinePhotoQueueHint:
    "Photos (JPEG, PNG, WebP, GIF) can be saved on this device while offline and upload when you tap Sync now. PDFs and other documents still need a connection. Queued photos are not on the server until sync completes.",
} as const
