"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, Loader2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { GrowthAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { LeadResearchPilotObservation } from "@/lib/growth/aios/pilot/lead-research-pilot-types"
import type { GrowthAvaOutreachExecutionRequest } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import {
  buildAvaOperatorPackageActionApiPath,
  GROWTH_AVA_OPERATOR_SEQUENCE_APPROVAL_HREF,
  GROWTH_AVA_OPERATOR_SUCCESS_PIPELINE_STEPS,
  GROWTH_AVA_OPERATOR_WORKSPACE_1_QA_MARKER,
} from "@/lib/growth/mission-center/growth-ava-operator-workspace-contract"
import { GrowthHomeOpportunityIntelligencePanel } from "@/components/growth/workspace/executive-briefing/growth-home-opportunity-intelligence-panel"
import type { GrowthHomeOpportunityIntelligenceApiResponse } from "@/lib/growth/opportunity-intelligence/growth-home-opportunity-intelligence-api-contract"
import type { OpportunityIntelligenceViewModel } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-view-model-types"

type CommunicationStrategyResponse = {
  ok?: boolean
  enabled?: boolean
  display_summary?: string | null
  communication_strategy?: {
    headline?: string | null
    recommended_channel?: string | null
    recommended_sequence?: string | null
    rationale?: string | null
  } | null
  relationship_recommendation?: string | null
}

type DecisionMakersResponse = {
  decisionMakers?: Array<{ fullName: string; title?: string | null; status?: string }>
}

type CommandCenterResponse = {
  ok?: boolean
  commandCenter?: {
    autonomousOutreachPreparationPilot?: {
      recentRuns?: Array<{
        approvalPackage?: GrowthAutonomousOutreachApprovalPackage | null
      }>
    }
  }
}

type ExecutionRequestResponse = {
  ok?: boolean
  executionRequest?: GrowthAvaOutreachExecutionRequest | null
  error?: string
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 p-3 space-y-2">
      <p className="text-sm font-semibold">{title}</p>
      <div className="text-sm">{children}</div>
    </div>
  )
}

export function GrowthAvaOperatorApprovalWorkspace({
  leadId,
  packageId,
  observation,
}: {
  leadId: string
  packageId: string
  observation: LeadResearchPilotObservation
}) {
  const [approvalPackage, setApprovalPackage] = useState<GrowthAutonomousOutreachApprovalPackage | null>(null)
  const [executionRequest, setExecutionRequest] = useState<GrowthAvaOutreachExecutionRequest | null>(null)
  const [oiPayload, setOiPayload] = useState<GrowthHomeOpportunityIntelligenceApiResponse | null>(null)
  const [commStrategy, setCommStrategy] = useState<CommunicationStrategyResponse | null>(null)
  const [decisionMakers, setDecisionMakers] = useState<DecisionMakersResponse["decisionMakers"]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setActionError(null)
    try {
      const [commandCenterRes, executionRes, oiRes, commRes, dmRes] = await Promise.all([
        fetch("/api/platform/growth/ai-os/command-center", { cache: "no-store" }),
        fetch(`${buildAvaOperatorPackageActionApiPath(packageId)}?leadId=${encodeURIComponent(leadId)}`, {
          cache: "no-store",
        }),
        fetch(`/api/platform/growth/leads/${encodeURIComponent(leadId)}/opportunity-intelligence`, {
          cache: "no-store",
        }),
        fetch(`/api/platform/growth/leads/${encodeURIComponent(leadId)}/communication-strategy`, {
          cache: "no-store",
        }),
        fetch(`/api/platform/growth/leads/${encodeURIComponent(leadId)}/decision-makers`, {
          cache: "no-store",
        }),
      ])

      const commandBody = (await commandCenterRes.json()) as CommandCenterResponse
      const runs = commandBody.commandCenter?.autonomousOutreachPreparationPilot?.recentRuns ?? []
      const matched = runs.find((run) => run.approvalPackage?.packageId === packageId)?.approvalPackage ?? null
      setApprovalPackage(matched)

      const executionBody = (await executionRes.json()) as ExecutionRequestResponse
      setExecutionRequest(executionBody.executionRequest ?? null)

      if (oiRes.ok) {
        setOiPayload((await oiRes.json()) as GrowthHomeOpportunityIntelligenceApiResponse)
      } else {
        setOiPayload(null)
      }

      if (commRes.ok) {
        setCommStrategy((await commRes.json()) as CommunicationStrategyResponse)
      } else {
        setCommStrategy(null)
      }

      if (dmRes.ok) {
        const dmBody = (await dmRes.json()) as DecisionMakersResponse
        setDecisionMakers(dmBody.decisionMakers ?? [])
      } else {
        setDecisionMakers([])
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not load approval workspace.")
    } finally {
      setLoading(false)
    }
  }, [leadId, packageId])

  useEffect(() => {
    void load()
  }, [load])

  const approved =
    Boolean(executionRequest) || approvalPackage?.packageApprovalDecision === "approved"

  const submitDecision = useCallback(
    async (decision: "approve" | "reject") => {
      setBusy(decision)
      setActionError(null)
      try {
        const response = await fetch(buildAvaOperatorPackageActionApiPath(packageId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, leadId }),
        })
        const body = (await response.json()) as {
          ok?: boolean
          error?: string
          message?: string
          result?: { executionRequest?: GrowthAvaOutreachExecutionRequest | null }
        }
        if (!response.ok || !body.ok) {
          throw new Error(body.error ?? body.message ?? "Package action failed.")
        }
        if (decision === "approve") {
          setExecutionRequest(body.result?.executionRequest ?? null)
        }
        await load()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "Package action failed.")
      } finally {
        setBusy(null)
      }
    },
    [leadId, load, packageId],
  )

  const oiViewModel = oiPayload?.viewModel as OpportunityIntelligenceViewModel | undefined
  const committeeStatus = oiViewModel?.fields?.workflowSignals?.value?.decisionMakerStatus ?? null

  const draftAssets = useMemo(
    () => approvalPackage?.generatedAssets ?? [],
    [approvalPackage?.generatedAssets],
  )

  if (loading && !approvalPackage && !executionRequest) {
    return (
      <Card data-qa-marker={GROWTH_AVA_OPERATOR_WORKSPACE_1_QA_MARKER}>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading approval workspace…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className="border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-background to-background dark:border-indigo-900/40 dark:from-indigo-950/20"
      data-qa-marker={GROWTH_AVA_OPERATOR_WORKSPACE_1_QA_MARKER}
      data-package-id={packageId}
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="size-5 text-indigo-600" aria-hidden />
          Approval workspace
        </CardTitle>
        <CardDescription>
          Review research and outreach draft, approve the package, then continue in Sequence Execution for transport
          approval. No send occurs on this screen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Section title="Research Summary">
          <p>
            <span className="text-muted-foreground">Company:</span> {observation.companyName ?? "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Workflow:</span>{" "}
            <Badge variant="outline">{observation.workflowStatus.replaceAll("_", " ")}</Badge>
          </p>
          {observation.qualification ? (
            <p>
              Fit {observation.qualification.fitScore} · confidence{" "}
              {Math.round(observation.qualification.confidence * 100)}% ·{" "}
              {observation.qualification.recommendedNextAction}
            </p>
          ) : (
            <p className="text-muted-foreground">Qualification pending — refresh after research completes.</p>
          )}
        </Section>

        <Section title="Opportunity Assessment">
          {observation.opportunityAssessment ? (
            <div className="space-y-1">
              <p>Score {observation.opportunityAssessment.opportunityScore}</p>
              <p>{observation.opportunityAssessment.recommendation.replaceAll("_", " ")}</p>
              <p className="text-muted-foreground">{observation.opportunityAssessment.summary}</p>
            </div>
          ) : null}
          {oiViewModel ? (
            <div className="mt-3">
              <GrowthHomeOpportunityIntelligencePanel
                viewModel={oiViewModel}
                researchStatus={oiPayload?.researchStatus}
              />
            </div>
          ) : !observation.opportunityAssessment ? (
            <p className="text-muted-foreground">Opportunity intelligence will appear after research assessment.</p>
          ) : null}
        </Section>

        <Section title="Buying Committee">
          <p>
            <span className="text-muted-foreground">Status:</span>{" "}
            {committeeStatus ? String(committeeStatus).replaceAll("_", " ") : "Not assessed"}
          </p>
          {decisionMakers.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {decisionMakers.slice(0, 5).map((dm) => (
                <li key={`${dm.fullName}-${dm.title ?? ""}`}>
                  {dm.fullName}
                  {dm.title ? ` · ${dm.title}` : ""}
                  {dm.status ? ` (${dm.status})` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No decision makers recorded yet.</p>
          )}
        </Section>

        <Section title="Communication Strategy">
          {commStrategy?.enabled && commStrategy.communication_strategy ? (
            <div className="space-y-1">
              {commStrategy.communication_strategy.headline ? (
                <p className="font-medium">{commStrategy.communication_strategy.headline}</p>
              ) : null}
              {commStrategy.communication_strategy.recommended_channel ? (
                <p>Channel: {commStrategy.communication_strategy.recommended_channel}</p>
              ) : null}
              {commStrategy.communication_strategy.recommended_sequence ? (
                <p>Cadence: {commStrategy.communication_strategy.recommended_sequence}</p>
              ) : null}
              {commStrategy.communication_strategy.rationale ? (
                <p className="text-muted-foreground">{commStrategy.communication_strategy.rationale}</p>
              ) : null}
            </div>
          ) : commStrategy?.display_summary ? (
            <p>{commStrategy.display_summary}</p>
          ) : (
            <p className="text-muted-foreground">Communication strategy not available for this lead yet.</p>
          )}
        </Section>

        <Section title="Draft Preview">
          {draftAssets.length > 0 ? (
            <ul className="space-y-2">
              {draftAssets.map((asset) => (
                <li key={`${asset.channel}-${asset.label}`} className="rounded-md border bg-background/80 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{asset.channel}</Badge>
                    <span className="font-medium">{asset.label}</span>
                    {asset.draftOnly ? (
                      <Badge variant="outline" className="text-xs">
                        draft only
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{asset.preview}</p>
                </li>
              ))}
            </ul>
          ) : approvalPackage ? (
            <p className="text-muted-foreground">Package loaded — no draft assets in preview.</p>
          ) : (
            <p className="text-muted-foreground">
              Draft package not in current session — approve using package id if preparation completed elsewhere.
            </p>
          )}
          {approvalPackage ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Recommended channel: {approvalPackage.recommendedChannel} · Expected: {approvalPackage.expectedOutcome}
            </p>
          ) : null}
        </Section>

        {approved || executionRequest ? (
          <div className="space-y-4 rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <Check className="size-5" aria-hidden />
              <p className="font-semibold">Package Approved</p>
            </div>
            <p className="text-sm">
              Execution Request {executionRequest?.executionStatus === "queued" ? "queued" : "recorded"}.
              {executionRequest?.sequenceJobId ? (
                <>
                  {" "}
                  Sequence job <span className="font-mono text-xs">{executionRequest.sequenceJobId.slice(0, 8)}…</span>{" "}
                  created.
                </>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">
              Transport still requires approval in the existing Sequence Execution dashboard — no send from this screen.
            </p>
            <Button type="button" asChild>
              <Link href={GROWTH_AVA_OPERATOR_SEQUENCE_APPROVAL_HREF}>Approve Sequence Job</Link>
            </Button>
            <ol className="space-y-2 border-t border-emerald-200/60 pt-3 text-sm dark:border-emerald-900/40">
              {GROWTH_AVA_OPERATOR_SUCCESS_PIPELINE_STEPS.map((step) => (
                <li key={step} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy !== null || observation.workflowStatus !== "assessed"}
              onClick={() => void submitDecision("approve")}
            >
              {busy === "approve" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Approve Package
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => void submitDecision("reject")}
            >
              {busy === "reject" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Reject
            </Button>
            {observation.workflowStatus !== "assessed" ? (
              <p className="w-full text-xs text-muted-foreground">
                Approve is enabled when research workflow reaches assessed.
              </p>
            ) : null}
          </div>
        )}

        {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
            Refresh workspace
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href="/growth/os/approvals">Ava&apos;s completed work</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
