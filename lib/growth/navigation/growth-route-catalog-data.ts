/**
 * Canonical Growth Engine route catalog inputs — one entry per physical page URL (122 total).
 * Built into full metadata by `growth-route-metadata.ts`.
 */

import type {
  GrowthRouteMigrationStatus,
  GrowthRouteSection,
} from "@/lib/growth/navigation/growth-route-metadata-types"

export type GrowthRouteCatalogInput = {
  id: string
  path: string
  title: string
  section: GrowthRouteSection
  migrationStatus: GrowthRouteMigrationStatus
  breadcrumbLabel?: string
  adminPath?: string
  workspacePath?: string
  segment?: string
  migrated?: boolean
  placeholder?: boolean
  hidden?: boolean
  system?: boolean
  dynamic?: boolean
  deprecated?: boolean
  dynamicMatch?: RegExp
  futurePath?: string
  futureSection?: GrowthRouteSection
}

/** Routes flagged in the IA audit as easy to forget — diagnostics assert presence. */
export const GROWTH_ORPHAN_ROUTE_IDS = [
  "admin-knowledge",
  "admin-ownership",
  "admin-customer-lifecycle",
  "admin-sequences-builder",
  "admin-opportunities-workspace",
  "admin-revenue",
  "admin-revenue-operating",
  "admin-revenue-intelligence",
] as const

const ADMIN = "/admin/growth"
const WORKSPACE = "/growth"

function settingsFuture(suffix: string): Pick<GrowthRouteCatalogInput, "futurePath" | "futureSection"> {
  return {
    futurePath: `${WORKSPACE}/settings/${suffix}`,
    futureSection: "settings",
  }
}

function admin(
  id: string,
  suffix: string,
  title: string,
  section: GrowthRouteSection,
  migrationStatus: GrowthRouteMigrationStatus,
  flags: Partial<GrowthRouteCatalogInput> = {},
): GrowthRouteCatalogInput {
  return {
    id,
    path: suffix ? `${ADMIN}/${suffix}` : ADMIN,
    title,
    section,
    migrationStatus,
    ...flags,
  }
}

function workspace(
  id: string,
  suffix: string,
  title: string,
  section: GrowthRouteSection,
  migrationStatus: GrowthRouteMigrationStatus,
  flags: Partial<GrowthRouteCatalogInput> = {},
): GrowthRouteCatalogInput {
  return {
    id,
    path: suffix ? `${WORKSPACE}/${suffix}` : WORKSPACE,
    title,
    section,
    migrationStatus,
    ...flags,
  }
}

function adminDual(
  id: string,
  suffix: string,
  title: string,
  section: GrowthRouteSection,
  workspaceSuffix: string,
  flags: Partial<GrowthRouteCatalogInput> = {},
): GrowthRouteCatalogInput {
  return admin(id, suffix, title, section, "dual-route", {
    workspacePath: workspaceSuffix ? `${WORKSPACE}/${workspaceSuffix}` : WORKSPACE,
    ...flags,
  })
}

function workspaceDual(
  id: string,
  suffix: string,
  title: string,
  section: GrowthRouteSection,
  flags: Partial<GrowthRouteCatalogInput> = {},
): GrowthRouteCatalogInput {
  return workspace(id, suffix, title, section, "dual-route", {
    migrated: true,
    adminPath: suffix ? `${ADMIN}/${suffix}` : ADMIN,
    segment: suffix,
    ...flags,
  })
}

function workspaceSettingsSection(
  slug: string,
  title: string,
  breadcrumbLabel: string,
  flags: Partial<GrowthRouteCatalogInput> = {},
): GrowthRouteCatalogInput {
  return workspace(`workspace-settings-${slug}`, `settings/${slug}`, title, "settings", "workspace", {
    migrated: true,
    segment: `settings/${slug}`,
    breadcrumbLabel,
    ...flags,
  })
}

export const GROWTH_ROUTE_CATALOG_INPUTS: GrowthRouteCatalogInput[] = [
  admin("admin-root", "", "Growth Root Redirect", "workspace", "admin-only", {
    deprecated: true,
    breadcrumbLabel: "Growth",
  }),
  admin("admin-leads-redirect", "leads", "Leads Legacy Redirect", "workspace", "admin-only", {
    deprecated: true,
    workspacePath: `${WORKSPACE}/leads`,
  }),
  admin("admin-calls-redirect", "calls", "Calls Legacy Redirect", "workspace", "admin-only", {
    deprecated: true,
    workspacePath: `${WORKSPACE}/calls`,
  }),

  workspace("workspace-dashboard", "", "Dashboard", "workspace", "workspace", {
    migrated: true,
    segment: "",
    breadcrumbLabel: "Dashboard",
  }),
  workspaceDual("workspace-share-pages", "share-pages", "Share Pages", "content", {
    breadcrumbLabel: "Share Pages",
  }),
  workspaceDual("workspace-share-pages-manage", "share-pages/manage", "Manage Share Pages", "content", {
    breadcrumbLabel: "Manage",
  }),
  workspaceDual("workspace-share-pages-workspace", "share-pages/workspace", "Share Page Workspace", "content", {
    breadcrumbLabel: "Workspace",
  }),
  workspaceDual("workspace-share-pages-detail", "share-pages/[id]", "Share Page Detail", "content", {
    breadcrumbLabel: "Edit",
    dynamic: true,
    dynamicMatch: /^share-pages\/[^/]+$/,
  }),
  workspaceDual("workspace-share-pages-templates", "share-pages/templates", "Templates", "content", {
    breadcrumbLabel: "Templates",
  }),
  workspaceDual("workspace-share-pages-templates-new", "share-pages/templates/new", "New Share Page Template", "content", {
    breadcrumbLabel: "New",
  }),
  workspaceDual("workspace-share-pages-templates-edit", "share-pages/templates/[id]", "Edit Share Page Template", "content", {
    breadcrumbLabel: "Edit",
    dynamic: true,
    dynamicMatch: /^share-pages\/templates\/[^/]+$/,
  }),
  workspaceDual(
    "workspace-share-pages-templates-preview",
    "share-pages/templates/[id]/preview",
    "Template Preview",
    "content",
    {
      breadcrumbLabel: "Preview",
      dynamic: true,
      dynamicMatch: /^share-pages\/templates\/[^/]+\/preview$/,
    },
  ),
  workspaceDual("workspace-automation", "automation", "Automation Flows", "automation", {
    breadcrumbLabel: "Automation",
  }),
  workspaceDual("workspace-automation-new", "automation/new", "New Automation Flow", "automation", {
    breadcrumbLabel: "New Flow",
  }),
  workspaceDual("workspace-automation-edit", "automation/[id]", "Edit Automation Flow", "automation", {
    breadcrumbLabel: "Edit Flow",
    dynamic: true,
    dynamicMatch: /^automation\/[^/]+$/,
  }),
  workspaceDual("workspace-personalized-videos", "videos/personalized", "Personalized Videos", "content", {
    breadcrumbLabel: "Personalized Videos",
  }),
  workspaceDual("workspace-personalized-videos-new", "videos/personalized/new", "New Personalized Video Page", "content", {
    breadcrumbLabel: "New Page",
  }),
  workspaceDual("workspace-personalized-videos-detail", "videos/personalized/[pageId]", "Personalized Video Page", "content", {
    breadcrumbLabel: "Page Detail",
    dynamic: true,
    dynamicMatch: /^videos\/personalized\/[^/]+$/,
  }),
  workspaceDual("workspace-activity", "activity", "Activity", "content", {
    breadcrumbLabel: "Activity",
  }),
  workspaceDual("workspace-personalized-videos-analytics", "videos/personalized/analytics", "Personalized Videos Analytics", "content", {
    breadcrumbLabel: "Analytics",
  }),
  workspaceDual("workspace-personalized-videos-launch", "videos/personalized/launch", "Personalized Videos Launch", "content", {
    breadcrumbLabel: "Launch",
  }),
  workspace("workspace-personalized-videos-legacy-root", "sendr", "Personalized Videos Legacy Redirect", "content", "workspace", {
    deprecated: true,
    migrated: true,
    segment: "sendr",
    workspacePath: `${WORKSPACE}/videos/personalized`,
  }),
  workspace("workspace-personalized-videos-legacy-new", "sendr/new", "New Personalized Video Page Legacy Redirect", "content", "workspace", {
    deprecated: true,
    migrated: true,
    segment: "sendr/new",
    workspacePath: `${WORKSPACE}/videos/personalized/new`,
  }),
  workspace("workspace-personalized-videos-legacy-detail", "sendr/[pageId]", "Personalized Video Page Legacy Redirect", "content", "workspace", {
    deprecated: true,
    migrated: true,
    segment: "sendr/[pageId]",
    dynamic: true,
    dynamicMatch: /^sendr\/[^/]+$/,
    workspacePath: `${WORKSPACE}/videos/personalized/[pageId]`,
  }),
  workspace("workspace-personalized-videos-legacy-activity", "sendr/activity", "Activity Legacy Redirect", "content", "workspace", {
    deprecated: true,
    migrated: true,
    segment: "sendr/activity",
    workspacePath: `${WORKSPACE}/activity`,
  }),
  workspace("workspace-personalized-videos-legacy-analytics", "sendr/analytics", "Personalized Videos Analytics Legacy Redirect", "content", "workspace", {
    deprecated: true,
    migrated: true,
    segment: "sendr/analytics",
    workspacePath: `${WORKSPACE}/videos/personalized/analytics`,
  }),
  workspace("workspace-personalized-videos-legacy-launch", "sendr/launch", "Personalized Videos Launch Legacy Redirect", "content", "workspace", {
    deprecated: true,
    migrated: true,
    segment: "sendr/launch",
    workspacePath: `${WORKSPACE}/videos/personalized/launch`,
  }),
  workspaceDual("workspace-videos", "videos", "Videos", "content", {
    breadcrumbLabel: "Videos",
  }),
  workspaceDual("workspace-videos-library", "videos/library", "Video Library", "content", {
    breadcrumbLabel: "Library",
  }),
  workspaceDual("workspace-videos-library-detail", "videos/library/[id]", "Video Asset Detail", "content", {
    breadcrumbLabel: "Detail",
    dynamic: true,
    dynamicMatch: /^videos\/library\/[^/]+$/,
  }),
  workspaceDual("workspace-videos-pages", "videos/pages", "Video Pages", "content", {
    breadcrumbLabel: "Pages",
  }),
  workspaceDual("workspace-videos-pages-new", "videos/pages/new", "New Video Page", "content", {
    breadcrumbLabel: "New Page",
  }),
  workspaceDual("workspace-videos-pages-detail", "videos/pages/[id]", "Video Page Detail", "content", {
    breadcrumbLabel: "Page Detail",
    dynamic: true,
    dynamicMatch: /^videos\/pages\/[^/]+$/,
  }),
  workspaceDual("workspace-videos-record", "videos/record", "Record Video", "content", {
    breadcrumbLabel: "Record",
  }),
  workspaceDual("workspace-videos-templates", "videos/templates", "Video Templates", "content", {
    breadcrumbLabel: "Templates",
  }),
  workspaceDual("workspace-videos-analytics", "videos/analytics", "Video Analytics", "content", {
    breadcrumbLabel: "Analytics",
  }),
  workspaceDual("workspace-videos-settings", "videos/settings", "Video Settings", "content", {
    breadcrumbLabel: "Settings",
  }),
  workspaceDual("workspace-engagement", "engagement", "Engagement", "intelligence", {
    breadcrumbLabel: "Engagement",
  }),

  workspace("workspace-leads", "leads", "Leads", "workspace", "dual-route", {
    migrated: true,
    segment: "leads",
    placeholder: false,
    breadcrumbLabel: "Leads",
    adminPath: `${ADMIN}/queue`,
  }),
  workspace("workspace-campaigns", "campaigns", "Campaigns", "workspace", "dual-route", {
    migrated: true,
    segment: "campaigns",
    placeholder: false,
    breadcrumbLabel: "Campaigns",
    adminPath: `${ADMIN}/multichannel`,
  }),
  workspaceDual("workspace-campaigns-sequences", "campaigns/sequences", "Sequence Execution", "workspace", {
    breadcrumbLabel: "Sequence Execution",
    adminPath: `${ADMIN}/sequences/execution`,
  }),
  workspaceDual("workspace-campaigns-bookings", "campaigns/bookings", "Booking Intelligence", "workspace", {
    breadcrumbLabel: "Booking Intelligence",
    adminPath: `${ADMIN}/booking-intelligence`,
  }),
  workspace("workspace-inbox", "inbox", "Inbox", "workspace", "dual-route", {
    // Phase 7F: canonical unified operator inbox — threads, channels, action center.
    migrated: true,
    segment: "inbox",
    placeholder: false,
    breadcrumbLabel: "Inbox",
    adminPath: `${ADMIN}/inbox`,
  }),
  workspace("workspace-inbox-workflow", "inbox/workflow", "Reply Workflow", "workspace", "dual-route", {
    // Phase 7F: Inbox child route — workflow actions, not a separate Replies surface.
    migrated: true,
    segment: "inbox/workflow",
    placeholder: false,
    breadcrumbLabel: "Reply Workflow",
    adminPath: `${ADMIN}/replies/workflow`,
  }),
  workspace("workspace-inbox-operations", "inbox/operations", "Inbox Operations", "workspace", "workspace", {
    // Phase 8A: orchestration and diagnostics — not a separate sidebar destination.
    migrated: true,
    segment: "inbox/operations",
    placeholder: false,
    breadcrumbLabel: "Operations",
  }),
  workspace("workspace-calls", "calls", "Calls", "workspace", "dual-route", {
    migrated: true,
    segment: "calls",
    placeholder: false,
    breadcrumbLabel: "Calls",
    adminPath: `${ADMIN}/calls/workspace`,
  }),
  workspace("workspace-meetings", "meetings", "Meetings", "workspace", "dual-route", {
    migrated: true,
    segment: "meetings",
    placeholder: false,
    breadcrumbLabel: "Meetings",
    adminPath: `${ADMIN}/meetings`,
  }),
  workspaceDual("workspace-media", "media", "Media Assets", "content", {
    breadcrumbLabel: "Media Assets",
    adminPath: `${ADMIN}/copilot/content-library`,
  }),
  workspaceDual("workspace-calls-live", "calls/live", "Live Calls", "workspace", { breadcrumbLabel: "Live" }),
  workspace("workspace-calls-workspace", "calls/workspace", "Call Workspace", "workspace", "workspace", {
    migrated: true,
    segment: "calls/workspace",
    breadcrumbLabel: "Workspace",
  }),
  workspace("workspace-calls-coaching", "calls/coaching", "Live Coaching", "workspace", "dual-route", {
    migrated: true,
    segment: "calls/coaching",
    placeholder: false,
    breadcrumbLabel: "Coaching",
    adminPath: `${ADMIN}/calls/live-coaching`,
  }),
  workspaceDual("workspace-calls-voice-drops", "calls/voice-drops", "Voice Drops", "workspace", {
    breadcrumbLabel: "Voice Drops",
  }),
  workspaceDual("workspace-leads-crm", "leads/crm", "CRM Leads", "workspace", { breadcrumbLabel: "CRM" }),
  workspaceDual("workspace-leads-queue", "leads/queue", "Call Queue", "workspace", { breadcrumbLabel: "Call Queue" }),
  workspaceDual("workspace-leads-captured", "leads/captured", "Recently Captured", "workspace", {
    breadcrumbLabel: "Captured",
  }),
  workspaceDual("workspace-leads-lead-engine", "leads/lead-engine", "Lead Pipeline", "workspace", {
    breadcrumbLabel: "Pipeline",
  }),
  workspaceDual("workspace-leads-research", "leads/research", "Revenue Queue", "workspace", {
    breadcrumbLabel: "Research Queue",
  }),
  workspaceDual("workspace-leads-prospect-search", "leads/prospect-search", "Prospect Search", "workspace", {
    breadcrumbLabel: "Prospect Search",
    adminPath: `${ADMIN}/search`,
  }),
  workspaceDual(
    "workspace-leads-prospect-search-discover",
    "leads/prospect-search/discover",
    "Discover Companies",
    "workspace",
    {
      breadcrumbLabel: "Discover",
      adminPath: `${ADMIN}/search`,
    },
  ),
  workspaceDual("workspace-leads-detail", "leads/[leadId]", "Lead Detail", "workspace", {
    breadcrumbLabel: "Lead",
    dynamic: true,
    dynamicMatch: /^leads\/[^/]+$/,
  }),
  workspace("workspace-settings", "settings", "Settings", "settings", "placeholder", {
    migrated: true,
    segment: "settings",
    breadcrumbLabel: "Settings",
  }),
  workspaceSettingsSection("profile", "Profile", "Profile"),
  workspaceSettingsSection("notifications", "Notifications", "Notifications"),
  workspaceSettingsSection("personal-preferences", "Personal Preferences", "Personal Preferences"),
  workspaceSettingsSection("connected-mailboxes", "Connected Mailboxes", "Connected Mailboxes"),
  workspaceSettingsSection("calling-preferences", "Calling Preferences", "Calling Preferences"),
  workspaceSettingsSection("signatures", "Signatures", "Signatures"),
  workspaceSettingsSection("calendar-preferences", "Calendar Preferences", "Calendar Preferences"),
  workspaceSettingsSection("sidebar-preferences", "Sidebar Preferences", "Sidebar Preferences"),
  workspaceSettingsSection("command-center-preferences", "Command Center Preferences", "Command Center Preferences"),
  workspaceSettingsSection("ai-preferences", "AI Preferences", "AI Preferences"),
  workspaceSettingsSection("default-views", "Default Views", "Default Views"),
  workspaceSettingsSection("gmail", "Gmail", "Gmail"),
  workspaceSettingsSection("microsoft-365", "Microsoft 365", "Microsoft 365"),
  workspaceSettingsSection("calendar", "Calendar", "Calendar"),
  workspaceSettingsSection("browser-notifications", "Browser Notifications", "Browser Notifications"),

  adminDual("admin-share-pages", "share-pages", "Share Pages", "content", "share-pages", {
    breadcrumbLabel: "Share Pages",
  }),
  adminDual("admin-share-pages-detail", "share-pages/[id]", "Share Page Detail", "content", "share-pages/[id]", {
    breadcrumbLabel: "Edit",
    dynamic: true,
  }),
  adminDual("admin-share-pages-workspace", "share-pages/workspace", "Share Page Workspace", "content", "share-pages/workspace", {
    breadcrumbLabel: "Workspace",
  }),
  adminDual("admin-share-pages-templates", "share-pages/templates", "Templates", "content", "share-pages/templates", {
    breadcrumbLabel: "Templates",
  }),
  adminDual(
    "admin-share-pages-templates-new",
    "share-pages/templates/new",
    "New Share Page Template",
    "content",
    "share-pages/templates/new",
    { breadcrumbLabel: "New" },
  ),
  adminDual(
    "admin-share-pages-templates-edit",
    "share-pages/templates/[id]",
    "Edit Share Page Template",
    "content",
    "share-pages/templates/[id]",
    { breadcrumbLabel: "Edit", dynamic: true },
  ),
  adminDual(
    "admin-share-pages-templates-preview",
    "share-pages/templates/[id]/preview",
    "Template Preview",
    "content",
    "share-pages/templates/[id]/preview",
    { breadcrumbLabel: "Preview", dynamic: true },
  ),
  adminDual("admin-automation", "automation", "Automation Flows", "automation", "automation", {
    breadcrumbLabel: "Automation",
  }),
  adminDual("admin-automation-new", "automation/new", "New Automation Flow", "automation", "automation/new", {
    breadcrumbLabel: "New Flow",
  }),
  adminDual("admin-automation-edit", "automation/[id]", "Edit Automation Flow", "automation", "automation/[id]", {
    breadcrumbLabel: "Edit Flow",
    dynamic: true,
  }),
  adminDual("admin-videos", "videos", "Videos", "content", "videos", {
    breadcrumbLabel: "Videos",
  }),
  adminDual("admin-videos-library", "videos/library", "Video Library", "content", "videos/library", {
    breadcrumbLabel: "Library",
  }),
  adminDual(
    "admin-videos-library-detail",
    "videos/library/[id]",
    "Video Asset Detail",
    "content",
    "videos/library/[id]",
    { breadcrumbLabel: "Detail", dynamic: true },
  ),
  adminDual("admin-videos-pages", "videos/pages", "Video Pages", "content", "videos/pages", {
    breadcrumbLabel: "Pages",
  }),
  adminDual("admin-videos-pages-new", "videos/pages/new", "New Video Page", "content", "videos/pages/new", {
    breadcrumbLabel: "New Page",
  }),
  adminDual(
    "admin-videos-pages-detail",
    "videos/pages/[id]",
    "Video Page Detail",
    "content",
    "videos/pages/[id]",
    { breadcrumbLabel: "Page Detail", dynamic: true },
  ),
  adminDual("admin-videos-record", "videos/record", "Record Video", "content", "videos/record", {
    breadcrumbLabel: "Record",
  }),
  adminDual("admin-videos-templates", "videos/templates", "Video Templates", "content", "videos/templates", {
    breadcrumbLabel: "Templates",
  }),
  adminDual("admin-videos-analytics", "videos/analytics", "Video Analytics", "content", "videos/analytics", {
    breadcrumbLabel: "Analytics",
  }),
  adminDual("admin-videos-settings", "videos/settings", "Video Settings", "content", "videos/settings", {
    breadcrumbLabel: "Settings",
  }),
  adminDual("admin-video-templates", "video-templates", "Video Templates", "content", "videos/templates", {
    breadcrumbLabel: "Templates",
  }),
  adminDual("admin-video-analytics", "video-analytics", "Video Analytics", "content", "videos/analytics", {
    breadcrumbLabel: "Analytics",
  }),
  adminDual("admin-engagement", "engagement", "Engagement", "intelligence", "engagement", {
    breadcrumbLabel: "Engagement",
  }),

  admin("admin-command", "command", "Command Center", "workspace", "admin-only", {
    breadcrumbLabel: "Command Center",
  }),
  admin("admin-notifications", "notifications", "Notifications", "workspace", "admin-only"),
  admin("admin-aiden", "aiden", "Aiden", "workspace", "admin-only"),
  adminDual("admin-queue", "queue", "Queue", "workspace", "leads", { breadcrumbLabel: "Queue" }),
  adminDual("admin-lead-detail", "leads/[leadId]", "Lead Detail", "workspace", "leads/[leadId]", {
    dynamic: true,
    breadcrumbLabel: "Lead",
  }),
  adminDual("admin-leads-queue", "leads/queue", "Call Queue", "workspace", "leads/queue", { breadcrumbLabel: "Call Queue" }),
  adminDual("admin-leads-crm", "leads/crm", "CRM Leads", "workspace", "leads/crm", { breadcrumbLabel: "CRM" }),
  adminDual("admin-leads-captured", "leads/captured", "Recently Captured", "workspace", "leads/captured", {
    breadcrumbLabel: "Captured",
  }),
  adminDual("admin-leads-lead-engine", "leads/lead-engine", "Lead Pipeline", "workspace", "leads/lead-engine", {
    breadcrumbLabel: "Pipeline",
  }),
  adminDual("admin-inbox", "inbox", "Inbox", "workspace", "inbox", { breadcrumbLabel: "Inbox" }),
  adminDual("admin-calls-workspace", "calls/workspace", "Calls Workspace", "workspace", "calls", {
    breadcrumbLabel: "Calls",
  }),
  adminDual("admin-calls-live", "calls/live", "Live Calls", "workspace", "calls/live"),
  adminDual("admin-calls-live-coaching", "calls/live-coaching", "Live Coaching", "workspace", "calls/coaching", {
    breadcrumbLabel: "Coaching",
  }),
  adminDual("admin-calls-voice-drops", "calls/voice-drops", "Voice Drops", "workspace", "calls/voice-drops"),
  adminDual("admin-meetings", "meetings", "Meetings", "workspace", "meetings", { breadcrumbLabel: "Meetings" }),
  workspace("workspace-opportunities", "opportunities", "Opportunities", "workspace", "dual-route", {
    migrated: true,
    segment: "opportunities",
    placeholder: false,
    breadcrumbLabel: "Opportunities",
    adminPath: `${ADMIN}/opportunities`,
  }),
  workspace("workspace-opportunities-pipeline", "opportunities/pipeline", "Pipeline", "workspace", "dual-route", {
    migrated: true,
    segment: "opportunities/pipeline",
    placeholder: false,
    breadcrumbLabel: "Pipeline",
    adminPath: `${ADMIN}/opportunities/pipeline`,
  }),
  workspace("workspace-opportunities-workspace", "opportunities/workspace", "Opportunity Workspace", "workspace", "dual-route", {
    migrated: true,
    segment: "opportunities/workspace",
    placeholder: false,
    breadcrumbLabel: "Workspace",
    adminPath: `${ADMIN}/opportunities/workspace`,
  }),
  workspaceDual("workspace-opportunities-readiness", "opportunities/readiness", "Opportunity Readiness", "intelligence", {
    breadcrumbLabel: "Readiness",
  }),
  workspace("workspace-conversations", "conversations", "Conversations", "intelligence", "dual-route", {
    migrated: true,
    segment: "conversations",
    placeholder: false,
    breadcrumbLabel: "Conversations",
    adminPath: `${ADMIN}/conversations`,
  }),
  workspace("workspace-relationships", "relationships", "Relationships", "intelligence", "dual-route", {
    migrated: true,
    segment: "relationships",
    placeholder: false,
    breadcrumbLabel: "Relationships",
    adminPath: `${ADMIN}/relationships`,
  }),
  adminDual("admin-opportunities-pipeline", "opportunities/pipeline", "Pipeline", "workspace", "opportunities/pipeline", {
    breadcrumbLabel: "Pipeline",
  }),
  adminDual("admin-opportunities", "opportunities", "Opportunities", "workspace", "opportunities", {
    breadcrumbLabel: "Opportunities",
  }),
  adminDual("admin-opportunities-workspace", "opportunities/workspace", "Opportunity Workspace", "workspace", "opportunities/workspace", {
    breadcrumbLabel: "Workspace",
  }),
  admin("admin-search", "search", "Prospect Search", "workspace", "admin-only"),
  admin("admin-imports", "imports", "Imports", "workspace", "admin-only"),
  admin("admin-imports-batch", "imports/[batchId]", "Import Batch Detail", "workspace", "admin-only", {
    dynamic: true,
  }),
  admin("admin-acquisition", "acquisition", "Acquisition Runs", "workspace", "admin-only"),
  admin("admin-acquisition-run", "acquisition/[runId]", "Acquisition Run Detail", "workspace", "admin-only", {
    dynamic: true,
  }),
  admin("admin-customer-lifecycle", "customer-lifecycle", "Customer Lifecycle", "workspace", "admin-only"),
  admin("admin-executive", "executive", "Executive", "intelligence", "admin-only"),
  admin("admin-capacity", "capacity", "Capacity", "intelligence", "admin-only"),

  admin("admin-copilot", "copilot", "Copilot", "content", "admin-only"),
  admin("admin-copilot-playbooks", "copilot/playbooks", "Playbooks", "content", "admin-only"),
  adminDual("admin-copilot-content-library", "copilot/content-library", "Media Assets", "content", "media", {
    breadcrumbLabel: "Media Assets",
  }),
  admin("admin-copilot-reply-drafts", "copilot/reply-drafts", "Reply Drafts", "content", "admin-only"),
  admin("admin-copilot-personalization", "copilot/personalization", "Personalization", "content", "dual-route", {
    deprecated: true,
    workspacePath: `${WORKSPACE}/personalization`,
    segment: "personalization",
  }),
  workspaceDual("workspace-personalization", "personalization", "Personalization", "content", {
    adminPath: `${ADMIN}/copilot/personalization`,
  }),
  admin("admin-knowledge", "knowledge", "Knowledge Center", "content", "admin-only"),

  admin("admin-sequences", "sequences", "Sequences", "automation", "admin-only"),
  admin("admin-sequences-builder", "sequences/builder", "Sequence Builder", "automation", "admin-only"),
  adminDual("admin-sequences-execution", "sequences/execution", "Sequence Execution", "automation", "campaigns/sequences", {
    breadcrumbLabel: "Execution",
  }),
  admin("admin-sequences-enrollment", "sequences/enrollments/[enrollmentId]", "Enrollment Detail", "automation", "admin-only", {
    dynamic: true,
  }),
  admin("admin-outreach", "outreach", "Outreach", "automation", "admin-only"),
  admin("admin-outreach-approval", "outreach/approval", "Outreach Approval", "automation", "admin-only"),
  admin("admin-outreach-legacy-queue", "outreach/legacy-queue", "Legacy Outreach Queue", "automation", "hidden", {
    hidden: true,
    system: true,
    deprecated: true,
  }),
  admin("admin-execution", "execution", "Human Execution", "automation", "admin-only"),
  adminDual("admin-booking-intelligence", "booking-intelligence", "Booking Intelligence", "automation", "campaigns/bookings", {
    breadcrumbLabel: "Bookings",
  }),
  adminDual("admin-multichannel", "multichannel", "Multi-Channel", "automation", "campaigns", {
    breadcrumbLabel: "Campaigns",
  }),

  admin("admin-intent-pixel", "intent-pixel", "Intent Signals", "intelligence", "admin-only"),
  adminDual("admin-conversations", "conversations", "Conversations", "intelligence", "conversations", {
    breadcrumbLabel: "Conversations",
  }),
  admin("admin-replies", "replies", "Reply Inbox", "intelligence", "admin-only"), // Phase 7F: admin-only until workspace port (7G).
  adminDual("admin-replies-workflow", "replies/workflow", "Reply Workflow", "intelligence", "inbox/workflow", {
    breadcrumbLabel: "Reply Workflow",
  }),
  adminDual("admin-relationships", "relationships", "Relationships", "intelligence", "relationships", {
    breadcrumbLabel: "Relationships",
  }),
  admin("admin-relationship-memory", "intelligence/relationship-memory", "Relationship Memory", "intelligence", "admin-only"),
  admin("admin-experiments", "experiments", "Experiments", "system", "hidden", {
    hidden: true,
    system: true,
  }),
  admin("admin-revenue-execution", "revenue-execution", "Revenue Execution", "intelligence", "admin-only"),
  admin("admin-revenue-execution-review", "revenue-execution/review", "Revenue Execution Review", "intelligence", "admin-only"),
  admin("admin-revenue-intelligence", "revenue-intelligence", "Revenue Intelligence", "intelligence", "admin-only"),
  admin("admin-revenue-attribution", "revenue-attribution", "Revenue Attribution", "intelligence", "admin-only"),
  admin("admin-revenue-operating", "revenue-operating", "Revenue Forecast", "intelligence", "admin-only"),
  admin("admin-revenue", "revenue", "Revenue Forecast Intelligence", "intelligence", "admin-only"),
  admin("admin-opportunity-intelligence", "opportunity-intelligence", "Opportunity Readiness", "intelligence", "admin-only"),

  admin("admin-providers", "providers", "Provider Diagnostics", "settings", "admin-only", {
    ...settingsFuture("providers"),
  }),
  admin("admin-providers-setup", "providers/setup", "Provider Setup", "settings", "admin-only", {
    ...settingsFuture("providers/setup"),
  }),
  admin("admin-providers-delivery", "providers/delivery", "Send Routing", "settings", "admin-only", {
    ...settingsFuture("providers/delivery"),
  }),
  admin("admin-providers-deliverability-ops", "providers/deliverability-ops", "Outbound Readiness", "settings", "admin-only", {
    ...settingsFuture("providers/deliverability-ops"),
  }),
  admin("admin-providers-sender-pools", "providers/sender-pools", "Sender Pools", "settings", "admin-only", {
    ...settingsFuture("providers/sender-pools"),
  }),
  admin("admin-providers-compliance", "providers/compliance", "Compliance", "settings", "admin-only", {
    ...settingsFuture("compliance"),
  }),
  admin("admin-providers-webhooks", "providers/webhooks", "Webhooks", "settings", "admin-only", {
    ...settingsFuture("providers/webhooks"),
  }),
  admin("admin-infrastructure", "infrastructure", "Sender Management", "settings", "admin-only", {
    ...settingsFuture("infrastructure"),
  }),
  admin("admin-infrastructure-mailboxes", "infrastructure/mailboxes", "Mailbox Connections", "settings", "admin-only", {
    ...settingsFuture("mailboxes"),
  }),
  admin("admin-infrastructure-mailboxes-onboard", "infrastructure/mailboxes/onboard", "Mailbox Onboarding", "settings", "admin-only", {
    ...settingsFuture("mailboxes"),
  }),
  admin("admin-infrastructure-deliverability", "infrastructure/deliverability", "Deliverability", "settings", "admin-only", {
    ...settingsFuture("deliverability"),
  }),
  admin("admin-infrastructure-warmup", "infrastructure/warmup", "Warmup", "settings", "admin-only", {
    ...settingsFuture("warmup"),
  }),
  admin("admin-infrastructure-outbound-ops", "infrastructure/outbound-operations", "Send Infrastructure", "settings", "admin-only", {
    ...settingsFuture("outbound-operations"),
  }),
  admin("admin-operations-outbound", "operations/outbound", "Outbound Console", "settings", "admin-only", {
    ...settingsFuture("outbound-console"),
  }),
  admin("admin-deliverability", "deliverability", "Deliverability Protection", "settings", "admin-only", {
    ...settingsFuture("deliverability-protection"),
  }),
  admin("admin-settings", "settings", "Settings Root", "settings", "admin-only", { deprecated: true }),
  admin("admin-settings-growth", "settings/growth", "Growth Settings", "settings", "dual-route", {
    workspacePath: `${WORKSPACE}/settings`,
    breadcrumbLabel: "Growth",
  }),
  admin("admin-settings-communications", "settings/communications", "Communication Settings", "settings", "dual-route", {
    workspacePath: `${WORKSPACE}/settings/connected-mailboxes`,
    breadcrumbLabel: "Communications",
  }),
  admin("admin-settings-governance", "settings/governance", "Governance", "settings", "admin-only", {
    ...settingsFuture("governance"),
  }),
  admin("admin-settings-provider-health", "settings/provider-health", "Provider Health", "settings", "hidden", {
    hidden: true,
    system: true,
    ...settingsFuture("provider-health"),
  }),
  admin("admin-ownership", "ownership", "Sales Ownership", "settings", "admin-only", {
    ...settingsFuture("ownership"),
  }),
  admin("admin-calls-providers", "calls/providers", "Call Providers", "settings", "admin-only", {
    ...settingsFuture("call-providers"),
  }),
  admin("admin-voice-readiness", "voice/readiness", "Voice Readiness", "settings", "admin-only", {
    ...settingsFuture("voice/readiness"),
  }),
  admin("admin-inbox-diagnostics", "inbox/diagnostics", "Inbox Diagnostics", "settings", "hidden", {
    hidden: true,
    system: true,
    ...settingsFuture("inbox-diagnostics"),
  }),

  admin("admin-browser-intake-test", "browser-intake-test", "Browser Intake Test", "system", "hidden", {
    hidden: true,
    system: true,
  }),
  admin("admin-dogfood", "dogfood", "Dogfood Validation Center", "system", "hidden", {
    hidden: true,
    system: true,
  }),
  admin("admin-identity-evidence", "identity-evidence", "Human Identity Evidence Review", "system", "hidden", {
    hidden: true,
    system: true,
  }),
]
