"use client"

import Link from "next/link"
import { ArrowRight, Bot, ListChecks, PlayCircle, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildOutboundApprovalChain,
  buildOutboundLaunchUrls,
  GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER,
  runOutboundLaunchPreflight,
} from "@/lib/growth/outbound-launch/outbound-launch-motion"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"

export function LeadInboxOutboundLaunchBar({
  row,
  buyingStage,
  decisionMakerConfidence,
}: {
  row: Pick<
    GrowthLeadInboxRow,
    "id" | "company_name" | "email" | "status" | "existing_lead_match" | "existing_account_match" | "metadata"
  >
  buyingStage?: string | null
  decisionMakerConfidence?: number | null
}) {
  const growthLeadId = row.existing_lead_match.matched ? row.existing_lead_match.ids[0] ?? null : null
  const companyLike = {
    is_suppressed: false,
    suppression_reason: null,
    existing_customer: row.existing_account_match.matched,
    existing_prospect: row.existing_lead_match.matched,
    decision_maker_coverage: decisionMakerConfidence ?? null,
    contact_intelligence: null,
    committee_completion: null,
    growth_lead_id: growthLeadId,
    lead_inbox_id: row.id,
    in_lead_inbox: true,
    buying_stage: buyingStage ?? null,
    lead_engine_score: null,
    lead_score: null,
  }

  const preflight = runOutboundLaunchPreflight({
    company: companyLike,
    contact_email: row.email,
  })
  const launchUrls = buildOutboundLaunchUrls({
    company: { growth_lead_id: growthLeadId, lead_inbox_id: row.id, company_name: row.company_name, id: row.id },
  })
  const chain = buildOutboundApprovalChain({ currentStepId: "draft", blocked: !preflight.can_launch })

  return (
    <div
      className="rounded-xl border border-sky-100 bg-sky-50/40 p-4"
      data-qa-marker={GROWTH_OUTBOUND_LAUNCH_MOTION_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ShieldCheck className="size-4 text-sky-700" />
        <p className="text-sm font-semibold text-sky-950">Launch outbound — operator controlled</p>
        <span className="text-[10px] text-muted-foreground">Draft → Review → Approve → Queue → Execute</span>
      </div>

      {!preflight.can_launch ? (
        <p className="mt-2 text-xs text-rose-800">
          {preflight.checks.find((c) => !c.passed && c.severity === "block")?.detail ??
            "Complete CRM lead linkage before outbound execution."}
        </p>
      ) : (
        <p className="mt-2 text-xs text-emerald-800">Preflight passed — human approval still required for every send.</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {chain.map((step) => (
          <span key={step.id} className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px]">
            {step.label}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {launchUrls.generate_draft ? (
          <Button asChild size="sm" variant="default">
            <Link href={launchUrls.generate_draft}>
              <Bot className="mr-1 size-3.5" />
              Generate draft
            </Link>
          </Button>
        ) : null}
        {launchUrls.queue_for_approval ? (
          <Button asChild size="sm" variant="outline">
            <Link href={launchUrls.queue_for_approval}>
              <ListChecks className="mr-1 size-3.5" />
              Approval queue
            </Link>
          </Button>
        ) : null}
        {launchUrls.guided_sequence ? (
          <Button asChild size="sm" variant="outline">
            <Link href={launchUrls.guided_sequence}>
              <PlayCircle className="mr-1 size-3.5" />
              Guided sequence
            </Link>
          </Button>
        ) : null}
        {!growthLeadId ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/admin/growth/leads/${row.id}`}>
              Qualify in inbox
              <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
