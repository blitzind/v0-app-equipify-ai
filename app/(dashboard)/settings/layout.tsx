"use client"

import { WorkspaceSettingsNav } from "@/components/settings/workspace-settings-nav"
import {
  WORKSPACE_SETTINGS_SHELL_BODY,
  WORKSPACE_SETTINGS_SHELL_CONTENT,
  WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER,
  WORKSPACE_SETTINGS_SHELL_ROOT,
} from "@/lib/settings/workspace-settings-shell-tokens"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={WORKSPACE_SETTINGS_SHELL_ROOT}
      data-qa-marker={WORKSPACE_SETTINGS_SHELL_LAYOUT_QA_MARKER}
    >
      <WorkspaceSettingsNav variant="mobile" />

      <div className={WORKSPACE_SETTINGS_SHELL_BODY}>
        <WorkspaceSettingsNav variant="desktop" />

        <div className={WORKSPACE_SETTINGS_SHELL_CONTENT}>{children}</div>
      </div>
    </div>
  )
}
