"use client"

import { WorkspaceSettingsNav } from "@/components/settings/workspace-settings-nav"

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0 md:gap-5">
      <WorkspaceSettingsNav variant="mobile" />

      <div className="flex gap-8 items-start mt-3 md:mt-0">
        <WorkspaceSettingsNav variant="desktop" />

        <div className="flex-1 min-w-0 pb-24 md:pb-6">{children}</div>
      </div>
    </div>
  )
}
