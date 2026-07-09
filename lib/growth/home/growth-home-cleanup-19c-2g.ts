/** GE-AIOS-19C-2G — Home daily briefing cleanup (client-safe audit + constants). */

import { GROWTH_HOME_STARTUP_STEP_PATHS } from "@/lib/growth/home/growth-home-canonical-startup-experience-18d"
import { GROWTH_SALES_OPERATIONS_CENTER_ROUTE } from "@/lib/growth/operations-center/growth-sales-operations-center-types"
import { GROWTH_AVA_ABOUT_WORKSPACE_ROUTE } from "@/lib/growth/ava-about/growth-ava-about-workspace-types"
import { GROWTH_TRAINING_WORKSPACE_ROUTE } from "@/lib/growth/training/growth-training-workspace-types"
import {
  GROWTH_CUSTOMER_CROSS_LINK_APPROVALS_DESCRIPTION,
  GROWTH_CUSTOMER_CROSS_LINK_APPROVALS_LABEL,
} from "@/lib/growth/customer-experience/growth-zero-assistance-adoption-19c-4a"

export const GROWTH_HOME_CLEANUP_19C_2G_QA_MARKER = "ge-aios-19c-2g-home-cleanup-v1" as const

export const GROWTH_HOME_BRIEFING_CROSS_LINKS = [
  {
    id: "training",
    label: "Teach me in Training",
    href: GROWTH_TRAINING_WORKSPACE_ROUTE,
    description: "Company profile, strategy, and runbook",
  },
  {
    id: "operations",
    label: "Watch why in Operations",
    href: GROWTH_SALES_OPERATIONS_CENTER_ROUTE,
    description: "Decision reasoning and queue depth",
  },
  {
    id: "approvals",
    label: GROWTH_CUSTOMER_CROSS_LINK_APPROVALS_LABEL,
    href: GROWTH_HOME_STARTUP_STEP_PATHS.approvals,
    description: GROWTH_CUSTOMER_CROSS_LINK_APPROVALS_DESCRIPTION,
  },
  {
    id: "about-ai",
    label: "About Your AI",
    href: GROWTH_AVA_ABOUT_WORKSPACE_ROUTE,
    description: "Who I am and how I work",
  },
] as const

export type GrowthHomeCleanupSectionDisposition =
  | "keep_primary"
  | "compact_teaser"
  | "move_training"
  | "move_operations"
  | "move_about"
  | "move_settings"
  | "advanced_collapsed"

export type GrowthHomeCleanupSectionAudit = {
  id: string
  label: string
  disposition: GrowthHomeCleanupSectionDisposition
  rationale: string
}

/** Authoritative GE-AIOS-19C-2G Home section audit. */
export const GROWTH_HOME_CLEANUP_SECTION_AUDIT: GrowthHomeCleanupSectionAudit[] = [
  {
    id: "ava-hero",
    label: "Daily activity report",
    disposition: "keep_primary",
    rationale: "Answers accomplish / working / waiting / learned / next in one narrative.",
  },
  {
    id: "training-setup-cta",
    label: "Training setup CTA",
    disposition: "compact_teaser",
    rationale: "Compact CTA when setup incomplete — full wizard lives in Training.",
  },
  {
    id: "briefing-cross-links",
    label: "Briefing cross-links",
    disposition: "keep_primary",
    rationale: "Training, Operations, Approvals, About Your AI.",
  },
  {
    id: "first-week-guide",
    label: "First-week guide",
    disposition: "compact_teaser",
    rationale: "Post-launch checklist linking to Training, Operations, Approvals — not duplicate onboarding.",
  },
  {
    id: "ava-work",
    label: "Today's Work",
    disposition: "keep_primary",
    rationale: "Active queue from Work Manager — what I am working on.",
  },
  {
    id: "waiting-on-you",
    label: "What I need from you",
    disposition: "keep_primary",
    rationale: "Operator decisions and approvals.",
  },
  {
    id: "ava-memory",
    label: "What I've Learned",
    disposition: "compact_teaser",
    rationale: "Top insights only — full view in Training.",
  },
  {
    id: "get-ava-ready",
    label: "Get me ready wizard",
    disposition: "move_training",
    rationale: "Full setup wizard removed from primary Home.",
  },
  {
    id: "ava-specialist-team",
    label: "What I'm handling",
    disposition: "move_about",
    rationale: "Capability handling belongs on About Your AI.",
  },
  {
    id: "ava-operating-rhythm",
    label: "Today's Progress",
    disposition: "advanced_collapsed",
    rationale: "Operating rhythm detail — not daily briefing headline.",
  },
  {
    id: "executive-snapshot",
    label: "Where things stand",
    disposition: "advanced_collapsed",
    rationale: "KPI dashboard demoted — Home is not a metrics wall.",
  },
  {
    id: "research-growth-strategy",
    label: "Research & Growth Strategy editors",
    disposition: "move_training",
    rationale: "Company Profile, BI, Find Companies editing belongs in Training.",
  },
  {
    id: "advanced-operations",
    label: "Advanced operations",
    disposition: "advanced_collapsed",
    rationale: "Research loop, missions, extended activity.",
  },
  {
    id: "setup-diagnostics",
    label: "Setup & diagnostics",
    disposition: "advanced_collapsed",
    rationale: "Legacy wizard, readiness, AI activity diagnostics.",
  },
]

export const GROWTH_HOME_PRIMARY_BRIEFING_SECTION_IDS = GROWTH_HOME_CLEANUP_SECTION_AUDIT.filter(
  (row) => row.disposition === "keep_primary" || row.disposition === "compact_teaser",
).map((row) => row.id)
