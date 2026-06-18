import { requireWorkspaceSettingsPlatformAdminAccess } from "@/lib/settings/require-workspace-settings-platform-admin-access"

export default async function GrowthOperatorSettingsLayout({ children }: { children: React.ReactNode }) {
  await requireWorkspaceSettingsPlatformAdminAccess()
  return children
}
