import { ArrowRight, Kanban, Sparkles, Target, TrendingUp, Zap } from "lucide-react"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"

const BASE = GROWTH_WORKSPACE_BASE_PATH

export const GROWTH_OPPORTUNITIES_HUB_MANIFEST: GrowthWorkspaceHubManifest = {
  id: "opportunities",
  title: "Opportunities",
  description:
    "Opportunity operating hub — pipeline snapshot, priority accounts, and readiness intelligence without autonomous deal progression.",
  icon: Target,
  iconClassName: "bg-violet-50 text-violet-600",
  overview: [
    { id: "open-pipeline", label: "Open pipeline", hint: "Open pipeline", emptyValue: "Qualify leads to begin" },
    { id: "priority-accounts", label: "Priority accounts", hint: "Open workspace", emptyValue: "No priority accounts" },
    { id: "readiness-hot", label: "Readiness hot", hint: "Open workspace", emptyValue: "No hot leads" },
    { id: "follow-ups-due", label: "Follow-ups due", hint: "Open pipeline", emptyValue: "No follow-ups due" },
  ],
  quickActions: [
    {
      id: "pipeline",
      label: "Pipeline",
      description: "Pipeline tab — stages, forecast, and deals needing your attention.",
      href: `${BASE}/opportunities/pipeline`,
      icon: Kanban,
    },
    {
      id: "workspace",
      label: "Opportunity workspace",
      description: "Evidence-backed signals, committee intelligence, and operator recommendations.",
      href: `${BASE}/opportunities/workspace`,
      icon: Sparkles,
    },
    {
      id: "readiness",
      label: "Opportunity readiness",
      description: "Readiness tab — blockers, accelerators, and executive close candidates.",
      href: `${BASE}/opportunities/readiness`,
      icon: Zap,
    },
    {
      id: "relationships",
      label: "Relationships",
      description: "Relationship memory and committee context for active deals.",
      href: `${BASE}/relationships`,
      icon: TrendingUp,
      variant: "outline",
    },
    {
      id: "conversations",
      label: "Conversations",
      description: "Reply and conversation intelligence tied to opportunities.",
      href: `${BASE}/conversations`,
      icon: ArrowRight,
      variant: "outline",
    },
  ],
  sections: [
    {
      id: "pipeline-snapshot",
      title: "Pipeline Snapshot",
      description: "Weighted pipeline and stage health — open the Pipeline tab for full management.",
      drilldowns: [
        {
          id: "pipeline",
          label: "Open pipeline",
          description: "Pipeline tab — canonical pipeline surface (not in primary sidebar).",
          href: `${BASE}/opportunities/pipeline`,
        },
      ],
    },
    {
      id: "open-opportunities",
      title: "Open Opportunities",
      description: "Active deals requiring operator attention.",
      drilldowns: [
        {
          id: "pipeline-all",
          label: "All pipeline",
          description: "Browse all open opportunities in the pipeline dashboard.",
          href: `${BASE}/opportunities/pipeline`,
        },
        {
          id: "workspace",
          label: "Opportunity workspace",
          description: "Signal-backed opportunity operator dashboard.",
          href: `${BASE}/opportunities/workspace`,
        },
      ],
    },
    {
      id: "priority-accounts",
      title: "Priority Accounts",
      description: "Executive-close candidates and high-momentum accounts.",
      drilldowns: [
        {
          id: "readiness",
          label: "Opportunity readiness",
          description: "Readiness tab — scoring dashboard for executive-close candidates.",
          href: `${BASE}/opportunities/readiness`,
        },
        {
          id: "workspace",
          label: "Opportunity workspace",
          description: "Signal-backed opportunity operator dashboard.",
          href: `${BASE}/opportunities/workspace`,
        },
      ],
      emptyHint: "Import prospects or qualify leads to begin building your pipeline.",
    },
    {
      id: "next-best-actions",
      title: "Next Best Actions",
      description: "Operator recommendations for the next human-controlled move.",
      drilldowns: [
        {
          id: "workspace",
          label: "Workspace recommendations",
          description: "Evidence-backed next steps in the opportunity workspace.",
          href: `${BASE}/opportunities/workspace`,
        },
        {
          id: "inbox",
          label: "Inbox follow-ups",
          description: "Threads requiring human replies tied to deals.",
          href: `${BASE}/inbox`,
        },
      ],
    },
    {
      id: "recent-activity",
      title: "Recent Activity",
      description: "Recent opportunity and pipeline views from this browser.",
      emptyHint: "Activity appears after visiting pipeline or workspace destinations.",
    },
    {
      id: "quick-actions",
      title: "Quick Actions",
      description: "Fast paths into pipeline and intelligence surfaces.",
    },
  ],
}
