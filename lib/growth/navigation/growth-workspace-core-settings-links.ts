/**
 * Core workspace settings paths reused from Growth settings (GS-GROWTH-SETTINGS-8F).
 * Client-safe — links only; no duplicate UIs.
 */

import type { LucideIcon } from "lucide-react"
import { Building2, CreditCard, Plug, Users } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_CORE_SETTINGS_TEAM_PATH = "/settings/team" as const
export const GROWTH_CORE_SETTINGS_ORGANIZATION_PATH = "/settings/workspace" as const
export const GROWTH_CORE_SETTINGS_BILLING_PATH = "/settings/billing" as const
export const GROWTH_CORE_SETTINGS_INTEGRATIONS_PATH = "/settings/integrations" as const
export const GROWTH_CORE_SETTINGS_WORKSPACE_NOTIFICATIONS_PATH = "/settings/notifications" as const

export const GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/workspace` as const

export const GROWTH_WORKSPACE_SETTINGS_WORKSPACE_TEAM_PATH =
  `${GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH}/team` as const

export const GROWTH_WORKSPACE_SETTINGS_WORKSPACE_ORGANIZATION_PATH =
  `${GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH}/organization` as const

export const GROWTH_WORKSPACE_SETTINGS_WORKSPACE_BILLING_PATH =
  `${GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH}/billing` as const

export const GROWTH_WORKSPACE_SETTINGS_WORKSPACE_INTEGRATIONS_PATH =
  `${GROWTH_WORKSPACE_SETTINGS_WORKSPACE_PATH}/integrations` as const

export const GROWTH_WORKSPACE_SETTINGS_COMPLIANCE_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/compliance` as const

export const GROWTH_WORKSPACE_SETTINGS_ADVANCED_PATH =
  `${GROWTH_WORKSPACE_BASE_PATH}/settings/advanced` as const

export type GrowthCoreSettingsLinkCard = {
  id: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  growthSettingsPath: string
}

export const GROWTH_CORE_SETTINGS_LINK_CARDS: GrowthCoreSettingsLinkCard[] = [
  {
    id: "team",
    title: "Team",
    description: "Manage users, invites, roles, and permissions.",
    href: GROWTH_CORE_SETTINGS_TEAM_PATH,
    icon: Users,
    growthSettingsPath: GROWTH_WORKSPACE_SETTINGS_WORKSPACE_TEAM_PATH,
  },
  {
    id: "organization",
    title: "Organization",
    description: "Configure workspace profile, branding, and organization details.",
    href: GROWTH_CORE_SETTINGS_ORGANIZATION_PATH,
    icon: Building2,
    growthSettingsPath: GROWTH_WORKSPACE_SETTINGS_WORKSPACE_ORGANIZATION_PATH,
  },
  {
    id: "billing",
    title: "Billing",
    description: "Manage subscriptions, payment methods, invoices, and usage.",
    href: GROWTH_CORE_SETTINGS_BILLING_PATH,
    icon: CreditCard,
    growthSettingsPath: GROWTH_WORKSPACE_SETTINGS_WORKSPACE_BILLING_PATH,
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect and manage third-party services and platform integrations.",
    href: GROWTH_CORE_SETTINGS_INTEGRATIONS_PATH,
    icon: Plug,
    growthSettingsPath: GROWTH_WORKSPACE_SETTINGS_WORKSPACE_INTEGRATIONS_PATH,
  },
]
