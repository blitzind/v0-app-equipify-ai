/**
 * Inbound browser offer resolver — newest offerable voice call wins.
 * Run: pnpm test:inbound-browser-offer-resolver
 */
import assert from "node:assert/strict"
import {
  compareVoiceCallRecency,
  isVoiceCallOfferable,
  reconcileBrowserSyncInboundSelection,
} from "../lib/voice/browser-calling/call-lifecycle-reconciliation"
import type { VoiceInboundBrowserOfferView } from "../lib/voice/browser-calling/types"

assert.equal(
  isVoiceCallOfferable({ status: "ringing", answeredAt: null }),
  true,
)
assert.equal(
  isVoiceCallOfferable({ status: "completed", answeredAt: null }),
  false,
)
assert.equal(
  isVoiceCallOfferable({ status: "ringing", answeredAt: "2026-06-02T22:18:44.000Z" }),
  false,
)
assert.equal(
  isVoiceCallOfferable({ status: "in_progress", answeredAt: null }),
  false,
)

assert.ok(
  compareVoiceCallRecency(
    "2026-06-02T22:18:44.000Z",
    "2026-06-02T22:32:03.000Z",
  ) > 0,
)
assert.ok(
  compareVoiceCallRecency(
    "2026-06-02T22:32:03.000Z",
    "2026-06-02T22:18:44.000Z",
  ) < 0,
)

const staleOffer: VoiceInboundBrowserOfferView = {
  voiceCallId: "908585c9-d949-495e-9b59-821d8d44777a",
  workspaceSessionId: "sess-stale",
  fromNumber: "+14155550100",
  toNumber: "+14155550200",
  contactLabel: "Stale",
  offeredAt: "2026-06-02T22:18:44.000Z",
  voiceCallCreatedAt: "2026-06-02T22:18:44.000Z",
}

const freshOffer: VoiceInboundBrowserOfferView = {
  voiceCallId: "vc-new",
  workspaceSessionId: "sess-new",
  fromNumber: "+14155550199",
  toNumber: "+14155550200",
  contactLabel: "Fresh",
  offeredAt: "2026-06-02T22:32:03.000Z",
  voiceCallCreatedAt: "2026-06-02T22:32:03.000Z",
}

assert.deepEqual(
  reconcileBrowserSyncInboundSelection({
    activeVoiceCallId: staleOffer.voiceCallId,
    workspaceSessionId: staleOffer.workspaceSessionId,
    sessionStatusForSync: "ringing",
    activeVoiceCallCreatedAt: staleOffer.voiceCallCreatedAt,
    inboundOffer: freshOffer,
    baseSelectionReason: "client_pinned_session",
    inboundSelectionReason: "newest_offerable_voice_call",
  }),
  {
    activeVoiceCallId: freshOffer.voiceCallId,
    workspaceSessionId: freshOffer.workspaceSessionId,
    sessionStatusForSync: "ringing",
    selectionReason: "inbound_offer_supersedes_stale_pin",
  },
)

assert.deepEqual(
  reconcileBrowserSyncInboundSelection({
    activeVoiceCallId: staleOffer.voiceCallId,
    workspaceSessionId: staleOffer.workspaceSessionId,
    sessionStatusForSync: "active",
    activeVoiceCallCreatedAt: staleOffer.voiceCallCreatedAt,
    inboundOffer: freshOffer,
    baseSelectionReason: "client_pinned_session",
    inboundSelectionReason: "newest_offerable_voice_call",
  }),
  {
    activeVoiceCallId: staleOffer.voiceCallId,
    workspaceSessionId: staleOffer.workspaceSessionId,
    sessionStatusForSync: "active",
    selectionReason: "client_pinned_session",
  },
)

assert.deepEqual(
  reconcileBrowserSyncInboundSelection({
    activeVoiceCallId: null,
    workspaceSessionId: null,
    sessionStatusForSync: null,
    activeVoiceCallCreatedAt: null,
    inboundOffer: freshOffer,
    baseSelectionReason: "none",
    inboundSelectionReason: "newest_offerable_voice_call",
  }),
  {
    activeVoiceCallId: freshOffer.voiceCallId,
    workspaceSessionId: freshOffer.workspaceSessionId,
    sessionStatusForSync: "ringing",
    selectionReason: "newest_offerable_voice_call",
  },
)

console.log("inbound-browser-offer-resolver checks passed")
