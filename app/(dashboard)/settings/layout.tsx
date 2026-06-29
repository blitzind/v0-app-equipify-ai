"use client"

import { WorkspaceSettingsNavShell } from "@/components/settings/workspace-settings-nav-shell"
import { WorkspaceSettingsNavRuntimeObserver } from "@/components/settings/workspace-settings-nav-runtime-observer"
import { WorkspaceSettingsShellInstrumentation } from "@/components/settings/workspace-settings-shell-instrumentation"
import { GrowthSettingsPostMountObserver } from "@/lib/settings/growth-settings-post-mount-observer"
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
      data-workspace-settings-layout-root
    >
      <GrowthSettingsPostMountObserver />
      <WorkspaceSettingsNavRuntimeObserver />
      <WorkspaceSettingsShellInstrumentation />

      <WorkspaceSettingsNavShell variant="mobile" />

      <div className={WORKSPACE_SETTINGS_SHELL_BODY} data-workspace-settings-body>
        <WorkspaceSettingsNavShell variant="desktop" />

        <div className={WORKSPACE_SETTINGS_SHELL_CONTENT} data-workspace-settings-content>
          {children}
        </div>
      </div>
    </div>
  )
}
