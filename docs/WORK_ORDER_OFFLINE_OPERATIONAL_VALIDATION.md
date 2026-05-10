# Work order offline — operational validation (Phase 59.3)

This document describes **validation and hardening** for the technician offline bundle (Phase 53+), full-page parity (59.1), and offline photo queue (59.2). It is not a product spec for new offline features.

## Intended behavior

- **Manual Sync now** only — no background or auto-sync on reconnect.
- **Conflict review** preserved when server baseline diverges from the draft’s frozen baseline.
- **Scope:** `organizationId | userId | workOrderId` — no cross-org leakage from the client store; server RLS still enforces access on replay.
- **Photos:** Blobs live in IndexedDB (`pendingPhotoBlobs`); metadata on the outbox payload. Text-only bundle may persist via **localStorage fallback** if the outbox IDB write fails — blobs are never written to localStorage.

## Failure modes

| Situation | Expected behavior |
|-----------|-------------------|
| Double-click **Sync now** (same tab) | Second click ignored via ref guard; replay serialized. |
| **Sync now** in two tabs | `navigator.locks` serializes replay per scope when supported; otherwise ref still helps same tab. |
| Edit bundle while another tab **syncing** | `putOfflineBundleMergePatch` returns blocked; user sees “Sync in progress…” toast. |
| Edit while **conflict** | Merge blocked; user told to resolve conflict first. |
| Stale tab overwrites newer bundle | Merge re-reads and retries (limited attempts) before put. |
| Partial **photo** upload failure | Row marked `failed` with remaining `pendingPhotos`; blobs for failed item retained; retry with Sync now. |
| **IndexedDB** unavailable for outbox | JSON record falls back to localStorage (small payload only). |
| **IndexedDB** photo store broken | Queue append fails closed; blobs rolled back. |
| **Assignment / RLS** error on replay | Friendly message; draft stays on device; no cross-org data exposed. |
| **Discard** | Deletes outbox row + all blobs for scope; bump propagates to other tabs via `storage` event. |

## Known limitations (by design)

- No offline billing, labor totals, invoices, QuickBooks, AI, signatures, or inventory.
- No service worker / background sync.
- Same logical user on two devices still has **two** independent drafts (scope is per device/browser profile).

## Manual QA checklist

1. **Offline text + photo:** Airplane mode → edit notes → queue photo → refresh page → draft and preview still present.
2. **Multi-tab:** Two tabs same WO → edit in tab A → tab B shows updated pending state after bump (no manual refresh required in many browsers).
3. **Double Sync now:** Rapid double-click → single replay; no duplicate attachments (verify server photo count).
4. **Conflict:** Change server WO while draft exists → Sync now → conflict UI; resolve/discard paths work.
5. **Photo failure:** Simulate upload error → `failed` state, photos still queued, retry succeeds after fix.
6. **Syncing gate:** Start sync in tab A → in tab B try Save offline / queue photo → blocked with clear copy.
7. **Discard:** Discard in one tab → other tab loses pending UI after storage bump.
8. **Online-only:** Confirm labor/parts/signature flows still refuse offline (unchanged).

## Key files

- `lib/work-orders/offline/concurrency-put.ts` — merge-with-retry; syncing/conflict gates.
- `lib/work-orders/offline/sync-lock.ts` — replay lock wrapper.
- `lib/work-orders/offline/replay-drawer.ts` — replay + fresh reads on failure paths.
- `lib/work-orders/offline/broadcast.ts` — cross-tab bump.
- `components/work-orders/work-order-offline-sync-bar.tsx` — sync UX + diagnostics.
