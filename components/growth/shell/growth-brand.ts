import { Bot } from "lucide-react"
import { AI_OS_WORKSPACE_LABEL } from "@/lib/workspace/ai-os-workspace-branding"

export const GROWTH_BRAND = {
  name: AI_OS_WORKSPACE_LABEL,
  shortName: AI_OS_WORKSPACE_LABEL,
  workspaceLabel: "Workspace",
  icon: Bot,
  accent: "blue",
  sidebarBackground: "#0F172A",
  activeBackground: "#13233F",
  activeText: "#6EA8FF",
  activeGlow: "0 0 20px -8px rgba(41,108,255,0.45)",
} as const

export const GROWTH_WORKSPACE_SHELL_QA_MARKER = "growth-workspace-shell-v2" as const
export const GROWTH_WORKSPACE_SHELL_MOBILE_QA_MARKER = "growth-workspace-shell-mobile-v2" as const
