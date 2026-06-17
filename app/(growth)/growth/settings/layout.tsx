import type { ReactNode } from "react"
import { GrowthSettingsShell } from "@/components/growth/settings/growth-settings-shell"

export default function GrowthSettingsLayout({ children }: { children: ReactNode }) {
  return <GrowthSettingsShell>{children}</GrowthSettingsShell>
}
