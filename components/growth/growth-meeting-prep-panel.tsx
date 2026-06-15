"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronUp, Loader2, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthKnowledgeContextSection } from "@/components/growth/growth-knowledge-context-section"
import { GrowthKnowledgeRecommendationsSection } from "@/components/growth/growth-knowledge-recommendations-section"
import type { AiMeetingPrepRow } from "@/lib/growth/meeting-intelligence/ai-meeting-prep-types"
import type { GrowthMeetingPrepBundle, MeetingPrepRiskPriority } from "@/lib/growth/meeting-intelligence/meeting-prep-types"

function riskTone(priority: MeetingPrepRiskPriority): "attention" | "healthy" | "medium" | "neutral" {
  switch (priority) {
    case "Critical":
      return "attention"
    case "High":
      return "healthy"
    case "Medium":
      return "medium"
    default:
      return "neutral"
  }
}

function PrepSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-lg border border-border/70 bg-background/80">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {open ? <div className="border-t border-border/60 px-3 py-2 text-sm">{children}</div> : null}
    </section>
  )
}

export function GrowthMeetingPrepPanel({
  meetingId,
  meetingStatus,
}: {
  meetingId: string
  meetingStatus: string
}) {
  const [prep, setPrep] = useState<GrowthMeetingPrepBundle | null>(null)
  const [aiMeetingPrep, setAiMeetingPrep] = useState<AiMeetingPrepRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingAiPrep, setGeneratingAiPrep] = useState(false)
  const [queueActionLoading, setQueueActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showMoreRisks, setShowMoreRisks] = useState(false)

  const showPrep = meetingStatus === "proposed" || meetingStatus === "scheduled"

  const load = useCallback(async () => {
    if (!showPrep) {
      setPrep(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/meetings/${meetingId}/prep`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        prep?: GrowthMeetingPrepBundle
        account_playbook_context?: GrowthMeetingPrepBundle["accountPlaybookContext"]
        ai_meeting_prep?: AiMeetingPrepRow | null
        message?: string
      }
      if (!res.ok || !data.ok || !data.prep) {
        throw new Error(data.message ?? "Could not load meeting prep.")
      }
      setPrep({
        ...data.prep,
        accountPlaybookContext:
          data.account_playbook_context ?? data.prep.accountPlaybookContext ?? null,
      })
      setAiMeetingPrep(data.ai_meeting_prep ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Meeting prep failed.")
      setPrep(null)
    } finally {
      setLoading(false)
    }
  }, [meetingId, showPrep])

  useEffect(() => {
    void load()
  }, [load])

  const runAiPrepAction = useCallback(
    async (action: "generate" | "approve_ai_meeting_prep" | "reject_ai_meeting_prep" | "regenerate_ai_meeting_prep") => {
      setQueueActionLoading(true)
      setGeneratingAiPrep(action === "generate")
      try {
        if (action === "generate") {
          const res = await fetch("/api/platform/growth/ai-meeting-prep/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ meetingId, regenerate: Boolean(aiMeetingPrep) }),
          })
          const data = (await res.json().catch(() => ({}))) as { prep?: AiMeetingPrepRow | null }
          if (!res.ok) throw new Error("Could not generate AI meeting prep.")
          setAiMeetingPrep(data.prep ?? null)
          return
        }

        if (!aiMeetingPrep?.prep_id) return
        const res = await fetch("/api/platform/growth/ai-meeting-prep/queue/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, prepId: aiMeetingPrep.prep_id }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          result?: { prep_id?: string | null; status?: AiMeetingPrepRow["status"] | null }
        }
        if (!res.ok || !data.ok) throw new Error("AI meeting prep action failed.")
        if (action === "regenerate_ai_meeting_prep") {
          await load()
        } else if (aiMeetingPrep) {
          setAiMeetingPrep({
            ...aiMeetingPrep,
            status: data.result?.status ?? aiMeetingPrep.status,
          })
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "AI meeting prep action failed.")
      } finally {
        setQueueActionLoading(false)
        setGeneratingAiPrep(false)
      }
    },
    [aiMeetingPrep, load, meetingId],
  )

  const topRisks = useMemo(() => prep?.openRisks.slice(0, 3) ?? [], [prep])
  const moreRisks = useMemo(() => prep?.openRisks.slice(3) ?? [], [prep])

  if (!showPrep) return null

  return (
    <div
      className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/10"
      data-qa-marker="growth-meeting-prep-v1"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">Meeting prep</p>
          <p className="text-xs text-indigo-900/80 dark:text-indigo-100/80">
            Unified context — scan in under a minute before the call.
          </p>
        </div>
        {prep?.meeting.calendarEventId ? (
          <GrowthBadge label="Calendar attached" tone="healthy" />
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading prep package…
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {prep ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-indigo-300/50 bg-slate-900 px-3 py-3 text-white dark:border-indigo-500/40">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Meeting ready</p>
            <div className="mt-1 flex flex-wrap items-baseline gap-2">
              <p className="text-3xl font-bold tabular-nums">{prep.readiness.score}%</p>
              <p className="text-sm font-medium text-emerald-300">{prep.readiness.label}</p>
            </div>
            <p className="mt-1 text-xs text-slate-300">{prep.readiness.summary}</p>
            {prep.readiness.missing.length > 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                Missing: {prep.readiness.missing.join(" · ")}
              </p>
            ) : null}
          </div>

          <PrepSection title="Recommended objectives">
            {prep.recommendedObjectives.length === 0 ? (
              <p className="text-muted-foreground">No objectives generated yet.</p>
            ) : (
              <ol className="space-y-2">
                {prep.recommendedObjectives.slice(0, 3).map((objective, index) => (
                  <li key={objective.objective} className="rounded-md border border-border/60 bg-card px-2.5 py-2">
                    <div className="flex items-start gap-2">
                      <Target className="mt-0.5 size-3.5 shrink-0 text-violet-600" />
                      <div className="min-w-0">
                        <p className="font-medium">
                          {index + 1}. {objective.objective}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{objective.reasons.join(" · ")}</p>
                        {objective.evidence.length > 0 ? (
                          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                            {objective.evidence.slice(0, 2).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </PrepSection>

          {prep.accountPlaybookContext?.available ? (
            <PrepSection title="Account Playbook Context">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {prep.accountPlaybookContext.playbookKey ? (
                    <GrowthBadge label={prep.accountPlaybookContext.playbookKey} tone="healthy" />
                  ) : null}
                  <GrowthBadge
                    label={`Coverage ${prep.accountPlaybookContext.coverageStatus}`}
                    tone={
                      prep.accountPlaybookContext.coverageStatus === "Strong"
                        ? "healthy"
                        : prep.accountPlaybookContext.coverageStatus === "Partial"
                          ? "medium"
                          : "attention"
                    }
                  />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {prep.accountPlaybookContext.committeeCoverageScore}/100
                  </span>
                </div>

                {prep.accountPlaybookContext.committeeStrategy ? (
                  <p className="text-xs text-muted-foreground">
                    {prep.accountPlaybookContext.committeeStrategy}
                  </p>
                ) : null}

                {prep.accountPlaybookContext.accountLevelObjective ? (
                  <div className="rounded-md border border-violet-200/70 bg-violet-50/50 px-2.5 py-2 dark:border-violet-500/30 dark:bg-violet-500/10">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-200">
                      Account-level meeting objective
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {prep.accountPlaybookContext.accountLevelObjective.objective}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {prep.accountPlaybookContext.accountLevelObjective.reasons.join(" · ")}
                    </p>
                  </div>
                ) : null}

                {prep.accountPlaybookContext.stakeholderFocus.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Stakeholder focus
                    </p>
                    <ul className="space-y-2">
                      {prep.accountPlaybookContext.stakeholderFocus.map((focus) => (
                        <li
                          key={focus.roleCategory}
                          className="rounded-md border border-border/60 bg-card px-2.5 py-2 text-xs"
                        >
                          <p className="font-medium">{focus.roleCategory}</p>
                          <p className="mt-0.5 text-muted-foreground">
                            Focus: {focus.focusAreas.join(" · ")}
                          </p>
                          {focus.messagingThemes.length > 0 ? (
                            <p className="mt-0.5 text-muted-foreground">
                              Themes: {focus.messagingThemes.join(" · ")}
                            </p>
                          ) : null}
                          {focus.members.length > 0 ? (
                            <p className="mt-0.5 text-muted-foreground">
                              Contacts:{" "}
                              {focus.members
                                .map((member) =>
                                  member.title ? `${member.fullName} (${member.title})` : member.fullName,
                                )
                                .join("; ")}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {prep.accountPlaybookContext.committeeCoverageRisks.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Prep risks
                    </p>
                    <ul className="space-y-1">
                      {prep.accountPlaybookContext.committeeCoverageRisks.map((risk) => (
                        <li key={risk.id} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                          <p className="text-muted-foreground">{risk.reason}</p>
                          <GrowthBadge label={risk.priority} tone={riskTone(risk.priority)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </PrepSection>
          ) : null}

          <PrepSection title="AI Meeting Prep">
            <div className="space-y-3" data-qa-marker="growth-ai-meeting-prep-m1c-v1">
              <div className="flex flex-wrap items-center gap-2">
                {aiMeetingPrep ? (
                  <GrowthBadge
                    label={aiMeetingPrep.status}
                    tone={
                      aiMeetingPrep.status === "approved"
                        ? "healthy"
                        : aiMeetingPrep.status === "rejected"
                          ? "attention"
                          : aiMeetingPrep.status === "stale"
                            ? "neutral"
                            : "medium"
                    }
                  />
                ) : (
                  <GrowthBadge label="Not generated" tone="neutral" />
                )}
                {aiMeetingPrep ? (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Confidence {(aiMeetingPrep.confidence_score * 100).toFixed(0)}%
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={generatingAiPrep || queueActionLoading}
                  onClick={() => void runAiPrepAction("generate")}
                >
                  {generatingAiPrep ? "Generating…" : aiMeetingPrep ? "Regenerate prep" : "Generate AI prep"}
                </Button>
                {aiMeetingPrep?.status === "draft" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={queueActionLoading}
                      onClick={() => void runAiPrepAction("approve_ai_meeting_prep")}
                    >
                      Approve prep
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={queueActionLoading}
                      onClick={() => void runAiPrepAction("reject_ai_meeting_prep")}
                    >
                      Reject prep
                    </Button>
                  </>
                ) : null}
              </div>

              {aiMeetingPrep ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-muted-foreground">Executive brief</p>
                    <p className="mt-1 leading-relaxed">{aiMeetingPrep.executive_brief}</p>
                  </div>
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-muted-foreground">Suggested agenda</p>
                    <ul className="mt-1 space-y-1">
                      {aiMeetingPrep.suggested_agenda.map((item) => (
                        <li key={item.segment}>
                          {item.duration_minutes}m · {item.segment} — {item.objective}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {aiMeetingPrep.stakeholder_analysis.length > 0 ? (
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-muted-foreground">Stakeholder analysis</p>
                      <ul className="mt-1 space-y-1">
                        {aiMeetingPrep.stakeholder_analysis.map((item) => (
                          <li key={`${item.role_category}-${item.contact_name ?? "unknown"}`}>
                            <span className="font-medium">{item.role_category}</span>
                            {item.contact_name ? ` · ${item.contact_name}` : ""}
                            {item.talking_points.length ? ` — ${item.talking_points[0]}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {aiMeetingPrep.likely_objections.length > 0 ? (
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-muted-foreground">Likely objections</p>
                      <ul className="mt-1 space-y-1">
                        {aiMeetingPrep.likely_objections.slice(0, 4).map((item) => (
                          <li key={item.objection}>
                            {item.objection}: {item.response_angle}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {aiMeetingPrep.discovery_questions.length > 0 ? (
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-muted-foreground">Discovery questions</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {aiMeetingPrep.discovery_questions.slice(0, 5).map((question) => (
                          <li key={question}>{question}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {aiMeetingPrep.competitive_risks.length > 0 ? (
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-muted-foreground">Competitive risks</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {aiMeetingPrep.competitive_risks.map((risk) => (
                          <li key={risk}>{risk}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div>
                    <p className="font-semibold uppercase tracking-wide text-muted-foreground">Recommended outcome</p>
                    <p className="mt-1">{aiMeetingPrep.recommended_outcome}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Generate reviewable AI prep artifacts from the deterministic prep bundle. No outreach, booking, or
                  calendar actions occur.
                </p>
              )}
            </div>
          </PrepSection>

          <PrepSection title="Open risks">
            {topRisks.length === 0 ? (
              <p className="text-muted-foreground">No prioritized risks flagged.</p>
            ) : (
              <ul className="space-y-1.5">
                {topRisks.map((risk) => (
                  <li key={risk.id} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-medium">{risk.label}</p>
                      <p className="text-muted-foreground">{risk.reason}</p>
                    </div>
                    <GrowthBadge label={risk.priority} tone={riskTone(risk.priority)} />
                  </li>
                ))}
              </ul>
            )}
            {moreRisks.length > 0 ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={() => setShowMoreRisks((value) => !value)}
                >
                  {showMoreRisks ? "Hide additional risks" : `Show ${moreRisks.length} more risks`}
                </Button>
                {showMoreRisks
                  ? moreRisks.map((risk) => (
                      <div key={risk.id} className="mt-1 flex flex-wrap items-start justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium">{risk.label}</p>
                          <p className="text-muted-foreground">{risk.reason}</p>
                        </div>
                        <GrowthBadge label={risk.priority} tone={riskTone(risk.priority)} />
                      </div>
                    ))
                  : null}
              </>
            ) : null}
          </PrepSection>

          <div className="grid gap-2 lg:grid-cols-2">
            <PrepSection title="Company snapshot" defaultOpen>
              <p className="font-medium">{prep.companySnapshot.companyName}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {prep.companySnapshot.website ? <li>{prep.companySnapshot.website}</li> : null}
                {prep.companySnapshot.industry ? <li>{prep.companySnapshot.industry}</li> : null}
                {prep.companySnapshot.location ? <li>{prep.companySnapshot.location}</li> : null}
                {prep.companySnapshot.employees ? <li>{prep.companySnapshot.employees} employees</li> : null}
              </ul>
            </PrepSection>

            <PrepSection title="Lead score & buying stage" defaultOpen>
              <p className="font-semibold tabular-nums">
                {prep.leadScore.score != null ? prep.leadScore.score : "—"}
                {prep.leadScore.label ? ` · ${prep.leadScore.label}` : ""}
              </p>
              {prep.leadScore.explanation ? (
                <p className="mt-1 text-xs text-muted-foreground">{prep.leadScore.explanation}</p>
              ) : null}
              <p className="mt-2 text-xs">
                <span className="font-medium">Buying stage:</span>{" "}
                {prep.buyingStage.stage?.replace(/_/g, " ") ?? "Unknown"}
                {prep.buyingStage.confidence != null
                  ? ` (${Math.round(prep.buyingStage.confidence * 100)}%)`
                  : ""}
              </p>
              {prep.buyingStage.reason ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{prep.buyingStage.reason}</p>
              ) : null}
            </PrepSection>
          </div>

          <PrepSection title="Decision makers" defaultOpen={prep.decisionMakers.length > 0}>
            {prep.decisionMakers.length === 0 ? (
              <p className="text-muted-foreground">No indexed decision makers.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {prep.decisionMakers.slice(0, 4).map((dm) => (
                  <li key={dm.id} className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{dm.name}</span>
                    {dm.title ? <span className="text-muted-foreground">{dm.title}</span> : null}
                    {dm.isPrimary ? <GrowthBadge label="Primary" tone="healthy" /> : null}
                  </li>
                ))}
              </ul>
            )}
          </PrepSection>

          {prep.contactIntelligence?.committee_roles.length ? (
            <PrepSection title="Buying committee" defaultOpen={false}>
              <p className="mb-1 text-xs text-muted-foreground">
                {prep.contactIntelligence.committee_completeness_pct != null
                  ? `${prep.contactIntelligence.committee_completeness_pct}% complete`
                  : "Role mapping"}
              </p>
              <ul className="space-y-1 text-xs">
                {prep.contactIntelligence.committee_roles.slice(0, 5).map((role) => (
                  <li key={`${role.recommended_order}-${role.role}`}>
                    {role.recommended_order}. {role.role}
                    {role.contact_name ? ` (${role.contact_name})` : ""}
                  </li>
                ))}
              </ul>
            </PrepSection>
          ) : null}

          {prep.territoryContext.label ? (
            <PrepSection title="Territory context" defaultOpen={false}>
              <p>{prep.territoryContext.label}</p>
            </PrepSection>
          ) : null}

          {prep.signals.length > 0 ? (
            <PrepSection title="Signals" defaultOpen={false}>
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                {prep.signals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
            </PrepSection>
          ) : null}

          {prep.researchSummary.summary ? (
            <PrepSection title="Research summary" defaultOpen={false}>
              <p className="text-xs leading-relaxed">{prep.researchSummary.summary}</p>
              {prep.researchSummary.pitchAngle ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Pitch angle: {prep.researchSummary.pitchAngle}
                </p>
              ) : null}
            </PrepSection>
          ) : null}

          <div className="pt-2">
            <GrowthKnowledgeContextSection
              consumer="meeting_prep"
              title="Supporting Documents"
              leadId={prep.meeting.leadId}
              compact
            />
            <GrowthKnowledgeRecommendationsSection
              consumer="meeting_prep"
              title="Recommended Talking Points"
              leadId={prep.meeting.leadId}
              compact
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
