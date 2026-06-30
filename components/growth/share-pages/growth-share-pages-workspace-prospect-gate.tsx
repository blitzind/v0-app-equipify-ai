"use client"

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GrowthSharePageRecipientPicker,
  type GrowthSharePageRecipientSelection,
} from "@/components/growth/share-pages/growth-share-page-recipient-picker"
import {
  GROWTH_SHARE_PAGES_CHOOSE_PROSPECT_CTA,
  GROWTH_SHARE_PAGES_NO_PROSPECT_MESSAGE,
  GROWTH_SHARE_PAGES_NO_PROSPECT_TITLE,
  GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-operator-simplification-1e"
import { buildGrowthSharePageWorkspaceHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { GROWTH_SHARE_PAGES_HUB_MANAGE_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"

export function GrowthSharePagesWorkspaceProspectGate() {
  const router = useRouter()
  const pathname = usePathname()

  function handleSelect(selection: GrowthSharePageRecipientSelection | null) {
    if (!selection?.leadId) return
    router.push(buildGrowthSharePageWorkspaceHref({ leadId: selection.leadId }))
  }

  return (
    <div
      className="rounded-xl border border-border bg-card p-6 shadow-sm"
      data-qa-marker={GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <UserRound className="size-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{GROWTH_SHARE_PAGES_NO_PROSPECT_TITLE}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{GROWTH_SHARE_PAGES_NO_PROSPECT_MESSAGE}</p>
        </div>
      </div>

      <GrowthSharePageRecipientPicker value={null} onChange={handleSelect} />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" asChild>
          <Link href={GROWTH_SHARE_PAGES_HUB_MANAGE_HREF}>Manage share pages</Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={pathname.replace(/\/workspace\/?$/, "")}>Back to Share Pages hub</Link>
        </Button>
      </div>
    </div>
  )
}
