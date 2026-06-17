"use client"

import { WorkspaceSearch } from "@/components/workspace/workspace-search"

type Props = {
  organizationId: string | null
  orgReady: boolean
}

/** @deprecated Prefer `WorkspaceSearch` with `workspace="core"`. */
export function GlobalSearchHeader({ organizationId, orgReady }: Props) {
  return <WorkspaceSearch workspace="core" organizationId={organizationId} orgReady={orgReady} />
}
