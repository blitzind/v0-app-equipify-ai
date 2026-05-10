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
  /** Mobile quick bar when browser reports online */
  technicianQuickBarLeadOnline:
    "Notes, problem text, tasks (when allowed), starting the job, and work-order photos can be saved on this device if signal drops — then tap Sync now. PDFs in the same picker need Wi‑Fi or data. Signatures, parts, labor, billing, and AI need a connection.",

  /** Mobile quick bar when browser reports offline */
  technicianQuickBarLeadOffline:
    "You’re offline. Technician-safe edits and photos save on this device; tap Sync now when you’re back online. Signatures, parts, labor, and billing still need a connection — those edits stay in the form until then.",

  workOrderDrawerBannerTitle: "Sync & offline",

  workOrderDrawerBannerBody:
    "Technician-safe fields can be saved on this device when you’re offline. When you’re online, tap Sync now to send them to the server — nothing syncs automatically.",

  /** `title` / tooltip on buttons that hit the network */
  saveRequiresNetwork: "Online required — saves go to your workspace immediately.",

  statusChangeRequiresNetwork: "Online required — status updates the live work order.",

  /** Desktop / hover */
  onlineRequiredTooltip:
    "This action talks to Equipify right away. Technician notes and similar fields support an offline draft on this work order instead.",

  offlineDraftSupportedLabel: "Offline draft supported",
  offlineDraftSupportedTooltip:
    "You can save these fields locally when offline, then use Sync now when you are online. Parts, photos, inventory, invoices, and AI stay online-only.",

  savedLocallyLabel: "Saved on device",
  savedLocallyTooltip:
    "Stored only on this phone or tablet (not on the server yet). When you have signal, open the sync bar and tap Sync now.",

  syncPendingLabel: "Needs sync",
  syncPendingTooltip:
    "This job has changes saved on the device that are not on the server yet. Tap Sync now when you’re online.",

  syncInProgressLabel: "Syncing…",
  syncInProgressTooltip: "Sending your draft to the server. Keep this screen open until it finishes.",

  reviewConflictLabel: "Compare versions",
  reviewConflictTooltip:
    "The server copy changed while you had a local draft. Open the dialog to compare — nothing is overwritten until you choose.",

  syncFailedLabel: "Sync paused",
  syncFailedTooltip:
    "Last send didn’t finish. Check the message in the sync bar, fix connection or access if needed, then tap Sync again. Your draft stays on this device.",

  /** Full work order profile page (`/work-orders/[id]`) — Phase 53C */
  workOrderFullPageOfflineHint:
    "While offline you can save technician notes, problem text, and JSON tasks (when your org allows) on this device. Labor, parts, billing totals, signatures, inventory, PDFs, and AI still need Wi‑Fi or data — those fields stay visible in the form but won’t reach the server until you reconnect.",

  /** Save changes — desktop + mobile footer when offline */
  workOrderFullPageOfflineSaveButtonTooltip:
    "Saves technician-safe fields on this device (not the server yet). Labor, parts, and signatures need a connection and remain unsaved until you’re online.",

  /** Primary button label when saving offline on full page */
  workOrderFullPageOfflineSaveButtonLabel: "Save on this device",

  workOrderFullPageTechnicianSavedLocalTitle: "Saved on this device",
  workOrderFullPageTechnicianSavedLocalBody:
    "Not on the server yet — use Sync now when you’re online. Labor, parts, signatures, billing, and AI still need a connection.",

  /** Same session also had labor/parts/signature edits — those stay local-only in the form until online */
  workOrderFullPageSplitOfflineSaveTitle: "Technician fields saved locally",
  workOrderFullPageSplitOfflineSaveBody:
    "Labor, parts, and signatures weren’t saved on the device — they’re still in the form. Reconnect to send them to the server.",

  workOrderFullPageUnsafeOfflineTitle: "Needs connection",
  workOrderFullPageUnsafeOfflineBody:
    "Labor, parts, and signatures need Wi‑Fi or data. Your technician edits can still be saved on this device; reconnect to save the rest.",

  /** Inline when offline + editing + labor/parts/signature differs from server */
  workOrderFullPageOfflineUnsafeEditingNote:
    "Labor, parts, or signature changes are still on screen but can’t be saved offline. They’ll send when you’re back online.",

  /** Phase 59.2 — offline technician photo queue */
  workOrderOfflinePhotoQueueHint:
    "Image photos (JPEG, PNG, WebP, GIF) can queue on this device and upload with Sync now. PDFs and documents need a connection. Queued photos are not in the cloud until sync succeeds.",

  /** Phase 59.4 — sync bar / conflict UX */
  workOrderSyncBarDiscardTooltip:
    "Remove the device-only draft and queued photos from this tablet or phone. The server copy is not deleted.",

  workOrderSyncBarSyncNowTooltip: "Send everything in this draft to the server (text, tasks, status, queued photos).",

  workOrderConflictDialogTitle: "Compare versions",
  workOrderConflictDialogIntro:
    "The server was updated after this draft started, so Equipify won’t overwrite it automatically. Review both sides, then sync again after aligning, or clear only the copy on this device.",

  workOrderConflictDialogFooterHint:
    "Closing keeps your draft on this device. Discard only removes the local copy and queued photos here — it does not delete the server work order.",

  workOrderConflictDiscardLabel: "Clear draft on this device",

  workOrderSyncConflictToastTitle: "Sync paused — versions differ",
  workOrderSyncConflictToastBody: "Compare the two copies in Review, then adjust the job or clear the device draft.",

  workOrderOfflineRemovePhotoConfirm:
    "Remove this photo from the queue on this device? It won’t be uploaded unless you add it again.",

  workOrderPendingPhotosSectionTitle: "On this device (not uploaded yet)",

  workOrderPendingPhotosBadge: "Pending upload",

  /** Phase 59.3 — queue blocked while another tab syncs or conflict is open */
  workOrderOfflineQueueBlockedSyncingTitle: "Sync in progress",
  workOrderOfflineQueueBlockedSyncingBody:
    "Another tab or window is applying this draft. Wait for Sync now to finish, then save again.",

  workOrderOfflineQueueBlockedConflictTitle: "Resolve conflict first",
  workOrderOfflineQueueBlockedConflictBody:
    "Open Review conflict on the sync bar and discard or fix the draft before adding more offline changes.",
} as const
