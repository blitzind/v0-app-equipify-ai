"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Headphones, Mic, Phone, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  growthWorkspaceCallWorkspaceHref,
  growthWorkspaceCallsCoachingHref,
} from "@/lib/growth/inbox/inbox-call-communication-read-model"
import { useGrowthInboxLeadContext } from "@/components/growth/inbox/growth-inbox-lead-context-provider"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"

export const GROWTH_INBOX_CALL_ACTION_LINKS_QA_MARKER = "growth-inbox-call-action-links-v1" as const

type GrowthInboxCallActionLinksProps = {
  /** utilities: callback + coaching only (workspace link lives under Actions) */
  variant?: "all" | "utilities"
}

export function GrowthInboxCallActionLinks({ variant = "all" }: GrowthInboxCallActionLinksProps) {
  const pathname = usePathname()
  const { selectedThread } = useGrowthInboxWorkspace()
  const { leadId } = useGrowthInboxLeadContext()

  if (!selectedThread || !leadId) return null

  const callWorkspaceHref = growthWorkspaceCallWorkspaceHref({ leadId })
  const callbackHref = growthWorkspaceCallWorkspaceHref({ leadId, dialMode: "callback" })
  const voicemailHref = growthWorkspaceCallWorkspaceHref({ leadId, dialMode: "missed_callback" })
  const coachingHref = growthWorkspaceCallsCoachingHref({ leadId })
  const callsHubHref = growthFeaturePath(pathname, "calls")

  const showWorkspace = variant === "all"
  const showUtilities = variant === "all" || variant === "utilities"

  return (
    <div className="grid grid-cols-2 gap-2" data-qa-marker={GROWTH_INBOX_CALL_ACTION_LINKS_QA_MARKER}>
      {showWorkspace ? (
        <Button type="button" size="sm" variant="outline" className="justify-start" asChild>
          <Link href={callWorkspaceHref}>
            <Headphones className="mr-1.5 size-3.5" />
            Open Call Workspace
          </Link>
        </Button>
      ) : null}
      {showUtilities ? (
        <>
          <Button type="button" size="sm" variant="outline" className="justify-start" asChild>
            <Link href={callbackHref}>
              <Phone className="mr-1.5 size-3.5" />
              Start Callback
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" className="justify-start" asChild>
            <Link href={voicemailHref}>
              <Mic className="mr-1.5 size-3.5" />
              Review Voicemail
            </Link>
          </Button>
          <Button type="button" size="sm" variant="outline" className="justify-start" asChild>
            <Link href={coachingHref}>
              <Sparkles className="mr-1.5 size-3.5" />
              Review Coaching
            </Link>
          </Button>
        </>
      ) : null}
      {showWorkspace ? (
        <Button type="button" size="sm" variant="ghost" className="col-span-2 justify-start text-xs" asChild>
          <Link href={callsHubHref}>Calls hub</Link>
        </Button>
      ) : null}
    </div>
  )
}
