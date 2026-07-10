"use client"

import Link from "next/link"
import { useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { buildGrowthPersonalizationWorkspaceHref } from "@/lib/growth/personalization/personalization-generation-ux"
import { approvePersonalizationGeneration } from "@/lib/growth/personalization/embedded/growth-personalization-embedded-runtime"
import type { GrowthPersonalizationEmbeddedSurface } from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"
import { GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER } from "@/lib/growth/personalization/embedded/growth-personalization-embedded-types"
import { useGrowthLeadPersonalization } from "@/lib/growth/personalization/embedded/use-growth-lead-personalization"
import { GrowthPersonalizationSummaryCard } from "@/components/growth/personalization/embedded/growth-personalization-summary-card"
import { buildGrowthSharePageWorkspaceHref, growthWorkspaceInboxHref, growthWorkspaceInboxWorkflowHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import {
  GROWTH_AVA_FOLLOW_UP_TITLE,
  GROWTH_AVA_PERSONALIZATION_TITLE,
} from "@/lib/growth/workspace/growth-workspace-ava-identity"
import { Button } from "@/components/ui/button"
import type { GrowthLead } from "@/lib/growth/types"
import { hasUsableLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { enqueueGrowthLeadResearchFromDrawer } from "@/lib/growth/research/growth-lead-research-drawer-client"

const SURFACE_TITLES: Record<GrowthPersonalizationEmbeddedSurface, string> = {
  lead: GROWTH_AVA_PERSONALIZATION_TITLE,
  inbox: "Suggested follow-up from Ava",
  call: "Follow-up package from Ava",
  opportunity: "Personalized follow-up from Ava",
  meeting: "Meeting personalization from Ava",
  conversation: GROWTH_AVA_FOLLOW_UP_TITLE,
  sendr: "Prospect personalization from Ava",
  share: "Share page personalization from Ava",
}

type Props = {
  lead?: GrowthLead | null
  leadId: string | null | undefined
  surface: GrowthPersonalizationEmbeddedSurface
  compact?: boolean
  className?: string
}

export function GrowthPersonalizationEmbeddedPanel({
  lead = null,
  leadId,
  surface,
  compact = false,
  className,
}: Props) {
  const { summary, loading, generating, error, generate, regenerate, refresh } =
    useGrowthLeadPersonalization(leadId)
  const [approving, setApproving] = useState(false)
  const [approveMessage, setApproveMessage] = useState<string | null>(null)
  const [packageEmail, setPackageEmail] = useState(true)
  const [packageSms, setPackageSms] = useState(false)
  const [packageShare, setPackageShare] = useState(false)

  const researched = lead ? hasUsableLeadResearch(lead) : true

  async function handleGenerate() {
    if (!leadId) return
    if (lead && !researched) {
      await enqueueGrowthLeadResearchFromDrawer(lead)
      return
    }
    await generate()
  }

  if (!leadId) return null

  async function handleApprove() {
    if (!summary?.generationId) return
    setApproving(true)
    setApproveMessage(null)
    try {
      await approvePersonalizationGeneration(summary.generationId)
      setApproveMessage("Draft approved — human send still required.")
      await refresh()
    } catch (approveError) {
      setApproveMessage(approveError instanceof Error ? approveError.message : "Approval failed.")
    } finally {
      setApproving(false)
    }
  }

  const showStage = surface === "opportunity" || surface === "sendr" || surface === "meeting"
  const showPreview = surface !== "call" || summary?.hasDraft
  const showApprove = surface === "inbox" || surface === "opportunity"
  const showEdit = surface === "inbox" || surface === "conversation" || surface === "call"

  return (
    <div className={className} data-qa={GROWTH_PERSONALIZATION_EMBEDDED_QA_MARKER} data-surface={surface}>
      {surface === "call" ? (
        <div className="mb-2 space-y-2 rounded-lg border border-border/60 bg-muted/10 p-2.5">
          <p className="text-xs font-medium">Follow-up package options</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <label className="flex items-center gap-2">
              <Checkbox checked={packageEmail} onCheckedChange={(v) => setPackageEmail(Boolean(v))} />
              Follow-up email
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={packageSms} onCheckedChange={(v) => setPackageSms(Boolean(v))} />
              SMS
            </label>
            <label className="flex items-center gap-2">
              <Checkbox checked={packageShare} onCheckedChange={(v) => setPackageShare(Boolean(v))} />
              Share Page
            </label>
          </div>
          <p className="text-[10px] text-muted-foreground">No auto-send — generate drafts only.</p>
          {packageSms ? (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
              <Link href={growthWorkspaceInboxHref({ leadId })}>
                Open SMS workflow
              </Link>
            </Button>
          ) : null}
          {packageShare ? (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
              <Link href={buildGrowthSharePageWorkspaceHref({ leadId })}>
                Open Share Pages
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      {surface === "meeting" && summary?.topInsight ? (
        <p className="mb-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Suggested opening:</span> {summary.topInsight}
        </p>
      ) : null}

      <GrowthPersonalizationSummaryCard
        leadId={leadId}
        summary={summary}
        loading={loading}
        generating={generating || approving}
        error={error}
        title={SURFACE_TITLES[surface]}
        compact={compact}
        showStage={showStage}
        showPreview={showPreview}
        showApprove={showApprove}
        showEdit={showEdit}
        onGenerate={() => void handleGenerate()}
        onRegenerate={() => void regenerate()}
        onApprove={() => void handleApprove()}
        onEdit={() => {
          if (typeof window !== "undefined" && summary?.generationId) {
            window.location.href = buildGrowthPersonalizationWorkspaceHref({
              leadId,
              generationId: summary.generationId,
            })
          }
        }}
      />

      {surface === "inbox" && summary?.generationId ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" asChild>
            <Link href={growthWorkspaceInboxWorkflowHref(leadId)}>Open to send reply</Link>
          </Button>
        </div>
      ) : null}

      {approveMessage ? <p className="mt-2 text-xs text-muted-foreground">{approveMessage}</p> : null}

      {surface === "sendr" ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          Email uses Stack B cold outreach. SMS and Share Page open their native workflows with this lead.
        </p>
      ) : null}
    </div>
  )
}
