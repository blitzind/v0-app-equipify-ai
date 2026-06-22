import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthAudiences } from "@/lib/growth/audiences/growth-audience-repository"
import { fetchGrowthCalendarConnectionSummary } from "@/lib/growth/calendar/calendar-sync-readiness-server"
import { listGrowthBookingPagesForOwner } from "@/lib/growth/booking/booking-page-repository"
import { isGrowthEngineEnabledEnv } from "@/lib/growth/access"
import { buildConnectedMailboxesDashboard } from "@/lib/growth/mailboxes/connected-mailboxes-dashboard"
import {
  GROWTH_OPERATOR_SETUP_HEALTH_PATHS,
  GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER,
  type GrowthOperatorSetupHealthItem,
  type GrowthOperatorSetupHealthPayload,
  type GrowthOperatorSetupHealthStatus,
} from "@/lib/growth/operational/ge-v1-2-operator-setup-health-types"
import { listProspectSearchSavedSearches } from "@/lib/growth/prospect-search/saved-searches"
import { getGrowthOutboundMode, growthOutboundModeLabel } from "@/lib/growth/runtime/outbound-mode"
import { listSendrAssetPickerItems } from "@/lib/growth/sendr/growth-sendr-asset-picker-service"
import { fetchGrowthSequenceSafeExecutionDashboard } from "@/lib/growth/sequences/execution/sequence-execution-dashboard"
import { listSenderProfiles } from "@/lib/growth/signatures/sender-profile-repository"

function statusFromCount(count: number, warnBelow: number, errorBelow = 0): GrowthOperatorSetupHealthStatus {
  if (count <= errorBelow) return "error"
  if (count < warnBelow) return "warn"
  return "ok"
}

export async function buildGrowthOperatorSetupHealth(
  admin: SupabaseClient,
  input: { organizationId: string; userId: string },
): Promise<GrowthOperatorSetupHealthPayload> {
  const [
    mailboxesResult,
    senderProfilesResult,
    calendarResult,
    bookingPagesResult,
    pagesResult,
    audiencesResult,
    savedSearchesResult,
    executionResult,
  ] = await Promise.allSettled([
    buildConnectedMailboxesDashboard(admin),
    listSenderProfiles(admin),
    fetchGrowthCalendarConnectionSummary(admin, input.userId),
    listGrowthBookingPagesForOwner(admin, input.userId),
    listSendrAssetPickerItems(admin, {
      organizationId: input.organizationId,
      kind: "landing_page",
      limit: 100,
    }),
    listGrowthAudiences(admin, { organizationId: input.organizationId, limit: 100 }),
    listProspectSearchSavedSearches(admin),
    fetchGrowthSequenceSafeExecutionDashboard(admin),
  ])

  const mailboxSummary =
    mailboxesResult.status === "fulfilled" ? mailboxesResult.value.summary : null
  const connectedMailboxes = mailboxSummary?.connectedMailboxes ?? 0
  const senderProfiles =
    senderProfilesResult.status === "fulfilled"
      ? senderProfilesResult.value.filter((row) => row.active).length
      : 0
  const calendar =
    calendarResult.status === "fulfilled" ? calendarResult.value : null
  const bookingPages =
    bookingPagesResult.status === "fulfilled" ? bookingPagesResult.value.filter((page) => page.enabled).length : 0
  const publishedPages =
    pagesResult.status === "fulfilled"
      ? pagesResult.value.filter((item) => item.status === "published").length
      : 0
  const audiences =
    audiencesResult.status === "fulfilled" ? audiencesResult.value.items.length : 0
  const savedSearches =
    savedSearchesResult.status === "fulfilled" ? savedSearchesResult.value.length : 0
  const pendingApprovals =
    executionResult.status === "fulfilled" ? executionResult.value.pendingApproval : 0

  const engineEnabled = isGrowthEngineEnabledEnv()
  const outboundMode = getGrowthOutboundMode()

  const items: GrowthOperatorSetupHealthItem[] = [
    {
      id: "connected-mailboxes",
      label: "Connected mailboxes",
      value: connectedMailboxes,
      status: statusFromCount(connectedMailboxes, 1),
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.mailboxes,
      detail: connectedMailboxes === 0 ? "Connect at least one sender mailbox." : null,
    },
    {
      id: "sender-profiles",
      label: "Sender profiles",
      value: senderProfiles,
      status: statusFromCount(senderProfiles, 1),
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.signatures,
      detail: senderProfiles === 0 ? "Add sender identity for outbound email." : null,
    },
    {
      id: "google-calendar",
      label: "Google Calendar",
      value: calendar?.connected ? "Connected" : "Not connected",
      status: calendar?.connected ? "ok" : calendar?.configured ? "warn" : "neutral",
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.calendar,
      detail: calendar?.setupMessage ?? null,
    },
    {
      id: "booking-pages",
      label: "Booking pages",
      value: bookingPages,
      status: statusFromCount(bookingPages, 1),
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.booking,
      detail: bookingPages === 0 ? "Publish a booking page for demo CTAs." : null,
    },
    {
      id: "published-pv-pages",
      label: "Published PV pages",
      value: publishedPages,
      status: statusFromCount(publishedPages, 1),
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.personalizedVideos,
      detail: publishedPages === 0 ? "Publish a personalized video page before launch." : null,
    },
    {
      id: "audiences",
      label: "Audiences",
      value: audiences,
      status: statusFromCount(audiences, 1),
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.audiences,
      detail: audiences === 0 ? "Create an audience for campaign launch." : null,
    },
    {
      id: "saved-searches",
      label: "Saved searches",
      value: savedSearches,
      status: savedSearches > 0 ? "ok" : "neutral",
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.prospectSearch,
      detail: savedSearches === 0 ? "Optional — save ICP searches for repeat prospecting." : null,
    },
    {
      id: "pending-approvals",
      label: "Pending approvals",
      value: pendingApprovals,
      status: pendingApprovals > 0 ? "warn" : "ok",
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.approvals,
      detail: pendingApprovals > 0 ? "Review and approve queued sends." : null,
    },
    {
      id: "growth-engine",
      label: "Growth Engine",
      value: engineEnabled ? "Enabled" : "Disabled",
      status: engineEnabled ? "ok" : "error",
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.settings,
      detail: engineEnabled ? null : "GROWTH_ENGINE_ENABLED must be true in production.",
    },
    {
      id: "outbound-mode",
      label: "Outbound mode",
      value: growthOutboundModeLabel(outboundMode),
      status: "neutral",
      href: GROWTH_OPERATOR_SETUP_HEALTH_PATHS.settings,
      detail: null,
    },
  ]

  const blockerCount = items.filter((item) => item.status === "error").length
  const warningCount = items.filter((item) => item.status === "warn").length

  return {
    qaMarker: GE_V1_2_OPERATOR_SETUP_HEALTH_QA_MARKER,
    generatedAt: new Date().toISOString(),
    items,
    blockerCount,
    warningCount,
  }
}
