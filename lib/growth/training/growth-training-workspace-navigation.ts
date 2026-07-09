/** GE-AIOS-19C-2E — Training workspace section navigation (client-safe). */

import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Brain,
  Building2,
  Compass,
  Download,
  GraduationCap,
  Lightbulb,
  MessageSquareText,
  Sparkles,
} from "lucide-react"
import {
  GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
  GROWTH_TRAINING_BUSINESS_STRATEGY_TITLE,
  GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
  GROWTH_TRAINING_COMPANY_PROFILE_TITLE,
  GROWTH_TRAINING_CONVERSATION_REVIEW_ROUTE,
  GROWTH_TRAINING_IMPORTS_ROUTE,
  GROWTH_TRAINING_LEARNED_ROUTE,
  GROWTH_TRAINING_LEARNED_TITLE,
  GROWTH_TRAINING_OVERVIEW_ROUTE,
  GROWTH_TRAINING_OVERVIEW_TITLE,
  GROWTH_TRAINING_RUNBOOK_ROUTE,
  GROWTH_TRAINING_RUNBOOK_TITLE,
  GROWTH_TRAINING_TEACHING_SESSIONS_ROUTE,
  GROWTH_TRAINING_WORKSPACE_19C_QA_MARKER,
} from "@/lib/growth/training/growth-training-workspace-types"

export const GROWTH_TRAINING_NAV_QA_MARKER = GROWTH_TRAINING_WORKSPACE_19C_QA_MARKER

export type GrowthTrainingNavItem = {
  id: string
  label: string
  href: string
  icon: LucideIcon
  future?: boolean
}

export const GROWTH_TRAINING_NAV_ITEMS: GrowthTrainingNavItem[] = [
  { id: "overview", label: GROWTH_TRAINING_OVERVIEW_TITLE, href: GROWTH_TRAINING_OVERVIEW_ROUTE, icon: GraduationCap },
  {
    id: "company-profile",
    label: GROWTH_TRAINING_COMPANY_PROFILE_TITLE,
    href: GROWTH_TRAINING_COMPANY_PROFILE_ROUTE,
    icon: Building2,
  },
  {
    id: "business-strategy",
    label: GROWTH_TRAINING_BUSINESS_STRATEGY_TITLE,
    href: GROWTH_TRAINING_BUSINESS_STRATEGY_ROUTE,
    icon: Compass,
  },
  { id: "runbook", label: GROWTH_TRAINING_RUNBOOK_TITLE, href: GROWTH_TRAINING_RUNBOOK_ROUTE, icon: BookOpen },
  {
    id: "learned",
    label: GROWTH_TRAINING_LEARNED_TITLE,
    href: GROWTH_TRAINING_LEARNED_ROUTE,
    icon: Lightbulb,
  },
  {
    id: "conversation-review",
    label: "Conversation Review",
    href: GROWTH_TRAINING_CONVERSATION_REVIEW_ROUTE,
    icon: MessageSquareText,
    future: true,
  },
  {
    id: "teaching-sessions",
    label: "Teaching Sessions",
    href: GROWTH_TRAINING_TEACHING_SESSIONS_ROUTE,
    icon: Sparkles,
    future: true,
  },
  { id: "imports", label: "Imports", href: GROWTH_TRAINING_IMPORTS_ROUTE, icon: Download, future: true },
]

export function isGrowthTrainingNavItemActive(pathname: string, item: GrowthTrainingNavItem): boolean {
  if (item.href === GROWTH_TRAINING_OVERVIEW_ROUTE) {
    return pathname === GROWTH_TRAINING_OVERVIEW_ROUTE
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
