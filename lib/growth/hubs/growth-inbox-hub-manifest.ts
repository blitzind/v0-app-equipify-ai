import { Mail } from "lucide-react"
import { GROWTH_INBOX_HUB_ACTION_CARDS } from "@/lib/growth/hubs/growth-inbox-hub-config"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthWorkspaceHubManifest } from "@/lib/growth/hubs/growth-workspace-hub-types"

export const GROWTH_INBOX_HUB_MANIFEST: GrowthWorkspaceHubManifest = {
  id: "inbox",
  title: "Inbox",
  description: "Unified communications workspace for email, SMS, calls, and workflow actions.",
  icon: Mail,
  iconClassName: "bg-sky-50 text-sky-700",
  overview: GROWTH_INBOX_HUB_ACTION_CARDS.map((card) => ({
    id: card.id,
    label: card.label,
    hint: card.helper,
  })),
  quickActions: [
    {
      id: "inbox-queue",
      label: "Thread Queue",
      description: "Open the primary inbox queue",
      href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
      icon: Mail,
    },
  ],
  sections: [
    {
      id: "thread-queue",
      title: "Thread Queue",
      description: "Primary operator triage workspace.",
      emptyHint: "No threads in this queue view.",
    },
    {
      id: "notifications",
      title: "Notifications",
      description: "Operator notification queue.",
      emptyHint: "No notifications requiring attention.",
    },
  ],
}
