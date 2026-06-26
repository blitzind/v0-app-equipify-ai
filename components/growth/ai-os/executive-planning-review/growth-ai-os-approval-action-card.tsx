"use client"

import { ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { AiOsExecutPlanningReport } from "@/lib/growth/aios/ai-executive-planning-report-types"
import {
  GrowthAiOsKpiCard,
  GrowthAiOsLevelChip,
} from "@/components/growth/ai-os/executive-planning-review/growth-ai-os-executive-planning-ux-utils"

export function GrowthAiOsApprovalActionCard({
  report,
  workOrderCount,
  prepareDecision,
  enableAiEvidence,
  onPrepareDecisionChange,
  onEnableAiEvidenceChange,
  onApprove,
  onRunPreview,
  busy,
  previewReady,
}: {
  report: AiOsExecutPlanningReport | null
  workOrderCount: number
  prepareDecision: boolean
  enableAiEvidence: boolean
  onPrepareDecisionChange: (checked: boolean) => void
  onEnableAiEvidenceChange: (checked: boolean) => void
  onApprove: () => void
  onRunPreview?: () => void
  busy: "preview" | "approve" | null
  previewReady: boolean
}) {
  return (
    <Card
      className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-card to-card shadow-md"
      data-qa-section="approval-panel"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Approval</CardTitle>
        <CardDescription>
          What happens if you approve — explicit operator control before any Work Orders are created.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <GrowthAiOsKpiCard label="Work Orders to create" value={workOrderCount} />
          <GrowthAiOsKpiCard
            label="Decision preparation"
            value={prepareDecision ? "Enabled" : "Off"}
            badge={
              prepareDecision ? (
                <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
              ) : null
            }
          />
          <GrowthAiOsKpiCard
            label="AI evidence"
            value={enableAiEvidence ? "Enabled" : "Off"}
            badge={
              enableAiEvidence ? <Sparkles className="size-4 text-indigo-600" aria-hidden /> : null
            }
          />
          {report ? (
            <>
              <GrowthAiOsKpiCard
                label="Estimated execution cost"
                value={
                  <GrowthAiOsLevelChip label="Cost" level={report.estimatedCost} />
                }
              />
              <GrowthAiOsKpiCard
                label="Estimated timeline"
                value={`${report.estimatedTimeline.days} days`}
                hint={report.estimatedTimeline.summary}
                className="sm:col-span-2"
              />
            </>
          ) : null}
        </div>

        <div className="rounded-lg border border-border/60 bg-background/80 p-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Checkbox
                id="prepare-decision"
                checked={prepareDecision}
                onCheckedChange={(checked) => onPrepareDecisionChange(checked === true)}
              />
              <Label htmlFor="prepare-decision">Prepare Decision Records on create</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="enable-ai-evidence"
                checked={enableAiEvidence}
                disabled={!prepareDecision}
                onCheckedChange={(checked) => onEnableAiEvidenceChange(checked === true)}
              />
              <Label htmlFor="enable-ai-evidence">Enable optional AI evidence (requires DR prep)</Label>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {!previewReady && onRunPreview ? (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={onRunPreview}>
                {busy === "preview" ? "Running preview…" : "Run dry-run preview"}
              </Button>
            ) : null}
            <Button
              type="button"
              size="lg"
              className="min-w-[220px] bg-indigo-600 hover:bg-indigo-700"
              disabled={busy !== null || !previewReady || workOrderCount === 0}
              onClick={onApprove}
            >
              {busy === "approve" ? "Creating Work Orders…" : "Create Work Orders"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
