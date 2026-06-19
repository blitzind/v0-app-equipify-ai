"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  GROWTH_INBOX_HONEST_EMPTY_STATE_QA_MARKER,
  buildGrowthInboxSetupEmptyState,
  type GrowthInboxSetupPhase,
} from "@/lib/growth/inbox/inbox-runtime-types"

export function GrowthInboxSetupEmptyState({ phase }: { phase: GrowthInboxSetupPhase }) {
  const pathname = usePathname()
  const providersHref = growthFeaturePath(pathname, "settings/connected-mailboxes")
  const state = buildGrowthInboxSetupEmptyState(phase)
  if (!state) return null

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm text-amber-950"
      data-equipify-qa-marker={GROWTH_INBOX_HONEST_EMPTY_STATE_QA_MARKER}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <GrowthBadge label={GROWTH_INBOX_HONEST_EMPTY_STATE_QA_MARKER} tone="attention" />
      </div>
      <p className="font-medium">{state.title}</p>
      <p className="mt-1">{state.message}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">
        {state.actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      {phase === "no_mailbox_providers" ? (
        <Button asChild size="sm" variant="outline" className="mt-3">
          <Link href={providersHref}>Connect provider</Link>
        </Button>
      ) : null}
    </div>
  )
}
