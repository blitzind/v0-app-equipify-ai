/**
 * Data & Administration placeholder copy — admin/support tone (not phase migration).
 */

export const WORKSPACE_SETTINGS_DATA_ADMIN_PLACEHOLDER_DEFAULT = {
  title: "Administrative Tools",
  description:
    "This admin-only area provides diagnostics, support workflows, governance tools, and operational oversight for the platform.",
} as const

export const WORKSPACE_SETTINGS_DATA_ADMIN_PLACEHOLDER_OVERRIDES: Partial<
  Record<string, { title: string; description: string }>
> = {
  "deliverability-operations": {
    title: "Deliverability Operations",
    description:
      "Monitor sender health, deliverability diagnostics, and operational workflows for AI OS communications.",
  },
}

export function resolveWorkspaceSettingsDataAdminPlaceholderCopy(sectionId: string): {
  title: string
  description: string
} {
  const override = WORKSPACE_SETTINGS_DATA_ADMIN_PLACEHOLDER_OVERRIDES[sectionId]
  return {
    title: override?.title ?? WORKSPACE_SETTINGS_DATA_ADMIN_PLACEHOLDER_DEFAULT.title,
    description: override?.description ?? WORKSPACE_SETTINGS_DATA_ADMIN_PLACEHOLDER_DEFAULT.description,
  }
}
